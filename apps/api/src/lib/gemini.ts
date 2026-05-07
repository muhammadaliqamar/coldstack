import { GoogleGenAI } from '@google/genai';
import { createRedisConnection } from '@coldstack/queue';

const redis = createRedisConnection();
const CACHE_KEY = 'gemini_warmup_pool';

export interface WarmupEmail {
  subject: string;
  body: string;
}

/**
 * Gets a random warmup email from the Gemini-generated pool.
 * If the pool is empty or missing, it triggers a background generation 
 * and falls back to a default while the pool populates.
 */
export async function getGeminiWarmupEmail(): Promise<WarmupEmail> {
  const cached = await redis.get(CACHE_KEY);
  let pool: WarmupEmail[] = [];

  if (cached) {
    try {
      pool = JSON.parse(cached);
    } catch (e) {
      console.error('[Gemini] Failed to parse cached pool', e);
    }
  }

  // If pool is empty or low, trigger async generation
  if (pool.length < 5) {
    generateAndCacheWarmupPool().catch(err => console.error('[Gemini] Generation error:', err));
  }

  if (pool.length > 0) {
    const email = pool.pop()!;
    // Save the depleted pool back to cache
    await redis.set(CACHE_KEY, JSON.stringify(pool));
    return email;
  }

  // Fallback while generating
  return {
    subject: 'Following up on our conversation',
    body: 'Hi, I just wanted to check in and see if you had time to review the document I sent over earlier. Let me know if you have any questions!',
  };
}

async function generateAndCacheWarmupPool(): Promise<void> {
  if (!process.env.GEMINI_API_KEY) {
    console.warn('[Gemini] No GEMINI_API_KEY found, skipping warmup pool generation.');
    return;
  }

  console.log('[Gemini] Generating new warmup email pool...');
  
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const prompt = `
    You are an expert at writing highly realistic, natural-sounding B2B conversation emails.
    Generate a JSON array of 30 distinct warmup emails. 
    These should not look like marketing templates. They should look like normal day-to-day office communications (e.g., following up on a meeting, asking a quick question about a project, scheduling a call, reviewing a document, sharing a link).
    Keep the bodies relatively short (2-4 sentences).
    
    Return ONLY a valid JSON array of objects with "subject" and "body" keys. No markdown blocks, no other text.
  `;

  try {
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      contents: prompt,
    });

    let rawJson = response.text || '';
    
    // Clean up potential markdown formatting from the response
    if (rawJson.includes('\`\`\`json')) {
      rawJson = rawJson.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
    } else if (rawJson.includes('\`\`\`')) {
      rawJson = rawJson.replace(/\`\`\`/g, '').trim();
    }

    const newPool: WarmupEmail[] = JSON.parse(rawJson);
    
    if (Array.isArray(newPool) && newPool.length > 0) {
      const existingStr = await redis.get(CACHE_KEY);
      let existing: WarmupEmail[] = [];
      if (existingStr) {
        try { existing = JSON.parse(existingStr); } catch (e) {}
      }

      const merged = [...existing, ...newPool];
      await redis.set(CACHE_KEY, JSON.stringify(merged));
      console.log(`[Gemini] Successfully cached ${newPool.length} new warmup emails. Total in pool: ${merged.length}`);
    }
  } catch (error) {
    console.error('[Gemini] Failed to generate emails via Gemini:', error);
  }
}

/**
 * Generates a contextual reply to a given subject line using Gemini API.
 */
export async function getGeminiReply(subject: string): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    return 'Thanks for reaching out! Things are going well on my end. Let\'s definitely catch up soon.';
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const prompt = `
    You are an expert at writing highly realistic, natural-sounding B2B conversation replies.
    You just received an email with the subject: "${subject}"
    
    Write a short (1-3 sentences) reply. Do not include subject, greeting, or sign-off formatting, just the raw text of the reply body. 
    It should look like a fast, casual business response.
  `;

  try {
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text?.trim() || 'Sounds good to me!';
  } catch (err) {
    console.error('[Gemini] Reply generation error:', err);
    return 'Great to hear from you. Let\'s schedule a call soon.';
  }
}
