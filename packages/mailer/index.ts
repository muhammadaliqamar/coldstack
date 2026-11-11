import nodemailer, { Transporter } from 'nodemailer';
import { decrypt } from './encryption';

export { encrypt, decrypt } from './encryption';

// ─── Transport Cache ────────────────────────────────────

const transporterCache = new Map<string, Transporter>();

/**
 * Create or retrieve a cached Nodemailer transporter for an inbox.
 */
export function getTransporter(inbox: {
  id: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string; // encrypted
}): Transporter {
  if (transporterCache.has(inbox.id)) {
    return transporterCache.get(inbox.id)!;
  }

  const transporter = nodemailer.createTransport({
    host: inbox.smtpHost,
    port: inbox.smtpPort,
    secure: inbox.smtpPort === 465,
    auth: {
      user: inbox.smtpUser,
      pass: decrypt(inbox.smtpPass),
    },
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
    rateDelta: 1000,
    rateLimit: 5,
  });

  transporterCache.set(inbox.id, transporter);
  return transporter;
}

/**
 * Clear a cached transporter (e.g., when SMTP creds change).
 */
export function clearTransporter(inboxId: string): void {
  const transporter = transporterCache.get(inboxId);
  if (transporter) {
    transporter.close();
    transporterCache.delete(inboxId);
  }
}

/**
 * Test SMTP connection for given credentials.
 */
export async function testSmtpConnection(config: {
  host: string;
  port: number;
  user: string;
  pass: string; // plaintext for testing
}): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });

    await transporter.verify();
    transporter.close();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Send an email through a specific inbox.
 */
export async function sendEmail(
  inbox: {
    id: string;
    emailAddress: string;
    fromName?: string | null;
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPass: string;
  },
  options: {
    to: string;
    subject: string;
    html: string;
    text?: string;
    trackingPixel?: string;
    replyTo?: string;
  }
): Promise<{ messageId: string }> {
  const transporter = getTransporter(inbox);

  let html = options.html;
  if (options.trackingPixel) {
    html += `<img src="${options.trackingPixel}" width="1" height="1" style="display:none" alt="" />`;
  }

  const fromAddress = inbox.fromName 
    ? `"${inbox.fromName}" <${inbox.emailAddress}>`
    : inbox.emailAddress;

  const info = await transporter.sendMail({
    from: fromAddress,
    to: options.to,
    subject: options.subject,
    html,
    text: options.text,
    replyTo: options.replyTo || inbox.emailAddress,
  });

  return { messageId: info.messageId };
}

// ─── Personalization ────────────────────────────────────

function resolveSpintax(text: string): string {
  let current = text;
  const regex = /\{([^{}]+)\}/g;
  while (regex.test(current)) {
    current = current.replace(regex, (match, choices) => {
      const parts = choices.split('|');
      return parts[Math.floor(Math.random() * parts.length)];
    });
  }
  return current;
}

function resolveConditionals(content: string, data: Record<string, any>): string {
  let current = content;
  const regex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g;
  while (regex.test(current)) {
    current = current.replace(regex, (match, key, trueBranch, falseBranch = '') => {
      const val = data[key];
      const isTrue = val && String(val).trim().length > 0;
      return isTrue ? trueBranch : falseBranch;
    });
  }
  return current;
}

function resolveMergeTags(content: string, data: Record<string, any>): string {
  // Matches {{variable}} or {{variable|"fallback"}} or {{variable|'fallback'}}
  return content.replace(/\{\{(\w+)(?:\s*\|\s*(['"])(.*?)\2)?\}\}/g, (match, key, quote, fallback) => {
    const val = data[key];
    if (val !== undefined && val !== null && String(val).trim().length > 0) {
      return String(val);
    }
    if (fallback !== undefined) {
      return fallback;
    }
    return match;
  });
}

/**
 * Replace personalization tokens in email content.
 * Supports:
 * - Block conditionals: {{#if company}}...{{else}}...{{/if}}
 * - Merge tag fallbacks: {{firstName|"there"}}
 * - Spintax: {Hey|Hi|Hello}
 */
export function personalizeContent(
  content: string,
  data: Record<string, string | null | undefined>
): string {
  if (!content) return '';
  
  // Normalize key names for flexible merge tag casing
  const normalizedData: Record<string, any> = { ...data };
  if (data.firstName) normalizedData.first_name = data.firstName;
  if (data.first_name) normalizedData.firstName = data.first_name;
  if (data.lastName) normalizedData.last_name = data.lastName;
  if (data.last_name) normalizedData.lastName = data.last_name;
  if (data.title) normalizedData.job_title = data.title;
  if (data.job_title) normalizedData.title = data.job_title;

  let result = content;
  // 1. Conditionals
  result = resolveConditionals(result, normalizedData);
  // 2. Merge tags with fallbacks
  result = resolveMergeTags(result, normalizedData);
  // 3. Spintax
  result = resolveSpintax(result);
  
  return result;
}

// ─── Link Tracking ──────────────────────────────────────

/**
 * Replace links in HTML with tracked redirect URLs.
 */
export function injectLinkTracking(
  html: string,
  emailLogId: string,
  trackingDomain: string
): string {
  return html.replace(
    /href="(https?:\/\/[^"]+)"/g,
    (match, url) => {
      const encodedUrl = encodeURIComponent(url);
      return `href="${trackingDomain}/t/click/${emailLogId}?url=${encodedUrl}"`;
    }
  );
}

// ─── Warmup Templates ───────────────────────────────────

export const WARMUP_SUBJECTS = [
  'Quick question about the project',
  'Following up on our conversation',
  'Checking in on the timeline',
  'RE: Meeting notes from today',
  'Thoughts on the proposal?',
  'Can you take a look at this?',
  'Updated schedule for next week',
  'RE: Budget review',
  'A few questions about the report',
  'Thanks for the update',
  'Scheduling follow-up discussion',
  'RE: Action items from call',
  'Quick update on progress',
  'RE: Resource allocation',
  'Document review needed',
  'Confirming our meeting time',
  'Some ideas for the new feature',
  'RE: Feedback on the draft',
  'Heads up on the change',
  'Just circling back on this',
  'FYI: Updated guidelines',
  'RE: Next steps',
  'Loop back on this when you can',
  'Shared the file with you',
  'RE: Planning session recap',
];

export const WARMUP_BODIES = [
  'Hey, just wanted to follow up on our earlier discussion. Let me know your thoughts when you get a chance.',
  'Hi there! I had a quick question about the project timeline. Can we sync up sometime this week?',
  'Thanks for sending that over. I took a look and everything seems good. Let me know if you need anything else.',
  'Just checking in to see how things are progressing. Happy to jump on a call if that helps.',
  'I reviewed the document you shared. A few minor suggestions, but overall it looks great.',
  'Wanted to share a quick update on where we stand. Things are moving in the right direction.',
  'Hey! Do you have time for a quick chat tomorrow? I have a few ideas I\'d like to run by you.',
  'Following up on the action items from our last meeting. I\'ve completed my part. How about yours?',
  'Just a heads up — I made some updates to the shared doc. Take a look when you get a chance.',
  'Thanks for the feedback! I\'ve incorporated your suggestions and the revised version is ready.',
  'Hi, I noticed the schedule shifted a bit. Can we confirm the new dates?',
  'Great call today. I\'ll send over the summary notes by end of day.',
  'Let me know if there\'s anything else you need from my end. Happy to help.',
  'I appreciate you taking the time to review this. Your input is always valuable.',
  'Just wanted to say thanks for the smooth collaboration. Looking forward to the next phase.',
  'Quick reminder about our meeting tomorrow at 2 PM. See you then!',
  'I\'ve attached the updated file. Let me know if the changes look right.',
  'Hey, just saw your message. I\'ll get back to you with a detailed response by tomorrow.',
  'Sounds good to me! Let\'s move forward with the plan as discussed.',
  'I\'ll loop in the rest of the team on this. Thanks for flagging it.',
];

export function getRandomWarmupSubject(): string {
  return WARMUP_SUBJECTS[Math.floor(Math.random() * WARMUP_SUBJECTS.length)];
}

export function getRandomWarmupBody(): string {
  return WARMUP_BODIES[Math.floor(Math.random() * WARMUP_BODIES.length)];
}
