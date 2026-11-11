import { prisma } from '@coldstack/db';
import { GoogleGenAI } from '@google/genai';

/**
 * Generates an initial BOFU high-converting closing offer email draft.
 */
export async function generateCloserDraft(leadId: string): Promise<void> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { contact: true, campaign: true },
  });

  if (!lead) {
    console.error(`[AICloser] Lead ${leadId} not found`);
    return;
  }

  if (!process.env.GEMINI_API_KEY) {
    console.warn('[AICloser] Gemini API key not found, using template fallback.');
    const fallbackDraft = `Hi ${lead.contact.firstName || 'there'},\n\nI wanted to personally reach out as we wrap up our campaign. Based on your interest in ${lead.campaign.name}, I'd love to schedule a quick 10-minute call this week to align on custom pricing and finalize the details.\n\nWould tomorrow at 2 PM work for you?\n\nBest regards,`;
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        aiStatus: 'pending_approval',
        aiDraftReply: fallbackDraft,
      },
    });
    return;
  }

  console.log(`[AICloser] Generating BOFU closing draft for lead ${leadId}...`);
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const prompt = `
    You are an expert sales closer. You need to write a personalized, high-converting B2B closing offer email to a prospect.
    Prospect Details:
    - Name: ${lead.contact.firstName} ${lead.contact.lastName}
    - Company: ${lead.contact.company}
    - Title: ${lead.contact.title}
    - Campaign Area: ${lead.campaign.name} (${lead.campaign.description || ''})

    Write a direct, compelling email offering to schedule a final call, close the deal, or offering a custom package/pricing matching their company.
    Keep the tone extremely professional, confident, and direct (2-3 paragraphs max). 
    Do not include subject headers or signatures, just return the body text of the email draft.
  `;

  try {
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
      contents: prompt,
    });

    const draftText = response.text?.trim() || '';
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        aiStatus: 'pending_approval',
        aiDraftReply: draftText,
      },
    });
    console.log(`[AICloser] Successfully saved closer draft for lead ${leadId}`);
  } catch (err) {
    console.error('[AICloser] Draft generation error:', err);
  }
}

/**
 * Generates a contextual reply to a negotiation reply/objection from a lead.
 */
export async function generateNegotiationDraft(leadId: string, replyText: string): Promise<void> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { contact: true, campaign: true },
  });

  if (!lead) return;

  if (!process.env.GEMINI_API_KEY) {
    const fallbackDraft = `Hi ${lead.contact.firstName || 'there'},\n\nThank you for your reply. I completely understand. Let's arrange a brief chat to see how we can align our custom solution to match your specific requirements and budget.\n\nBest,`;
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        aiStatus: 'pending_approval',
        aiDraftReply: fallbackDraft,
      },
    });
    return;
  }

  console.log(`[AICloser] Generating negotiation response for lead ${leadId}...`);
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const prompt = `
    You are an expert sales negotiator. 
    A prospect just replied to our sales closing email with the following response:
    "${replyText}"

    Prospect details:
    - Name: ${lead.contact.firstName} ${lead.contact.lastName}
    - Company: ${lead.contact.company}
    - Title: ${lead.contact.title}
    - Campaign Area: ${lead.campaign.name}

    Write a professional, highly strategic sales reply that handles their objection (pricing, timing, features, etc.) and moves them closer to signing the deal.
    Keep it concise (1-2 paragraphs max).
    Do not include subject line or signatures, just return the body text of the reply.
  `;

  try {
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
      contents: prompt,
    });

    const draftText = response.text?.trim() || '';
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        aiStatus: 'pending_approval',
        aiDraftReply: draftText,
      },
    });
    console.log(`[AICloser] Successfully saved negotiation draft for lead ${leadId}`);
  } catch (err) {
    console.error('[AICloser] Negotiation draft error:', err);
  }
}
