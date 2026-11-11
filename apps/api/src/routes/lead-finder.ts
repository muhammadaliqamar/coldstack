import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@coldstack/db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { GoogleGenAI } from '@google/genai';
import { verifyEmail } from '../lib/verification';

const router = Router();
router.use(authenticate);

const scrapeSchema = z.object({
  industry: z.string().min(1),
  location: z.string().min(1),
  source: z.string().optional().default('LinkedIn B2B'),
});

const importSchema = z.object({
  listName: z.string().min(1),
  leads: z.array(z.object({
    email: z.string().email(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    company: z.string().optional(),
    title: z.string().optional(),
    phone: z.string().optional(),
  })),
});

/**
 * POST /api/lead-finder/scrape — Dynamically scrape/generate leads using Gemini AI
 */
router.post('/scrape', validate(scrapeSchema), async (req: AuthRequest, res, next) => {
  try {
    const { industry, location, source = 'LinkedIn B2B' } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(400).json({ error: 'Gemini API Key is not configured' });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    // We will run 5 batches in parallel, each requesting 23 unique leads, focusing on different company starting letters
    // This yields up to 115 leads, ensuring we meet the 100+ requirement even after de-duplication.
    const ranges = [
      { name: 'A to E', rangeStr: 'companies starting with letters A, B, C, D, or E' },
      { name: 'F to J', rangeStr: 'companies starting with letters F, G, H, I, or J' },
      { name: 'K to O', rangeStr: 'companies starting with letters K, L, M, N, or O' },
      { name: 'P to T', rangeStr: 'companies starting with letters P, Q, R, S, or T' },
      { name: 'U to Z', rangeStr: 'companies starting with letters U, V, W, X, Y, or Z' },
    ];

    const batchPromises = ranges.map(async (rangeItem, idx) => {
      const batchNum = idx + 1;
      try {
        const prompt = `
          You are an advanced B2B lead generation scraper simulating data extracted from the source "${source}".
          Find and generate 23 highly realistic, distinct, unique B2B lead contacts in the "${industry}" industry located in "${location}" matching typical results from "${source}".
          
          This is batch ${batchNum} of 5.
          To ensure strict uniqueness and prevent overlaps with other batches, ONLY generate contacts at ${rangeItem.rangeStr}.
          
          For each lead, provide:
          - firstName (string, realistic name)
          - lastName (string, realistic name)
          - email (string, realistic business email based on their company)
          - company (string, matching the location/industry, starting with the designated letters)
          - title (string, executive/B2B role like CEO, Founder, VP Sales, Head of Marketing, Operations Manager, Technical Director, Business Development Manager)
          - phone (string, realistic phone format including country/area code for the location)
          
          Return ONLY a valid JSON array of these objects. Do not wrap in markdown or include any other text.
        `;

        const response = await ai.models.generateContent({
          model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
          contents: prompt,
        });

        let rawJson = response.text || '';
        if (rawJson.includes('```json')) {
          rawJson = rawJson.replace(/```json/g, '').replace(/```/g, '').trim();
        } else if (rawJson.includes('```')) {
          rawJson = rawJson.replace(/```/g, '').trim();
        }

        // Clean any potential trailing or leading noise
        const startIdx = rawJson.indexOf('[');
        const endIdx = rawJson.lastIndexOf(']');
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
          rawJson = rawJson.substring(startIdx, endIdx + 1);
        }

        const parsed = JSON.parse(rawJson);
        if (Array.isArray(parsed)) {
          return parsed;
        }
        return [];
      } catch (err) {
        console.error(`[LeadFinder] Error generating batch ${batchNum} (${rangeItem.name}):`, err);
        return [];
      }
    });

    const results = await Promise.all(batchPromises);
    
    // Flatten and de-duplicate by email (case-insensitive)
    const allLeads = results.flat();
    const seenEmails = new Set<string>();
    const uniqueLeads = [];

    for (const lead of allLeads) {
      if (!lead || !lead.email) continue;
      const normalizedEmail = lead.email.trim().toLowerCase();
      if (!seenEmails.has(normalizedEmail)) {
        seenEmails.add(normalizedEmail);
        uniqueLeads.push({
          firstName: lead.firstName || '',
          lastName: lead.lastName || '',
          email: normalizedEmail,
          company: lead.company || '',
          title: lead.title || '',
          phone: lead.phone || '',
        });
      }
    }

    console.log(`[LeadFinder] Scraped ${allLeads.length} total leads. Returning ${uniqueLeads.length} unique leads.`);
    res.json(uniqueLeads);
  } catch (error: any) {
    console.error('[LeadFinder] Scrape error:', error);
    res.status(500).json({ error: 'Failed to find leads: ' + error.message });
  }
});

/**
 * POST /api/lead-finder/import — Import leads into contacts with auto-verification
 */
router.post('/import', validate(importSchema), async (req: AuthRequest, res, next) => {
  try {
    const { listName, leads } = req.body;

    // Create or find list for the user
    let list = await prisma.emailList.findFirst({
      where: { name: listName, userId: req.userId! },
    });

    if (!list) {
      list = await prisma.emailList.create({
        data: {
          name: listName,
          fileName: 'Scraped Leads',
          userId: req.userId!,
        },
      });
    }

    const importedContacts = [];

    for (const lead of leads) {
      // Run email validation and verification
      const verificationStatus = await verifyEmail(lead.email);

      const contact = await prisma.contact.upsert({
        where: {
          listId_email: {
            listId: list.id,
            email: lead.email,
          },
        },
        update: {
          firstName: lead.firstName || null,
          lastName: lead.lastName || null,
          company: lead.company || null,
          title: lead.title || null,
          phone: lead.phone || null,
          verificationStatus,
        },
        create: {
          listId: list.id,
          email: lead.email,
          firstName: lead.firstName || null,
          lastName: lead.lastName || null,
          company: lead.company || null,
          title: lead.title || null,
          phone: lead.phone || null,
          verificationStatus,
        },
      });

      importedContacts.push(contact);
    }

    // Update list count
    const totalContacts = await prisma.contact.count({ where: { listId: list.id } });
    await prisma.emailList.update({
      where: { id: list.id },
      data: { totalContacts },
    });

    res.json({
      message: `Successfully imported ${importedContacts.length} contacts.`,
      listId: list.id,
      listName: list.name,
      contactsCount: totalContacts,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
