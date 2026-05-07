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

/**
 * Replace personalization tokens in email content.
 * Tokens: {{firstName}}, {{lastName}}, {{company}}, {{title}}, {{email}}
 */
export function personalizeContent(
  content: string,
  data: Record<string, string | null | undefined>
): string {
  return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return data[key] || match;
  });
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
