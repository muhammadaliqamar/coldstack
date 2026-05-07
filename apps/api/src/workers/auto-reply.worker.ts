import { prisma } from '@coldstack/db';
import { createWorker, QUEUE_NAMES, AutoReadJobData, AutoReplyJobData, autoReplyWarmupQueue } from '@coldstack/queue';
import { ImapFlow } from 'imapflow';
import { getGeminiReply } from '../lib/gemini';
import { decrypt } from '@coldstack/mailer/encryption';
import nodemailer from 'nodemailer';

/**
 * Worker to simulate a human reading an email.
 * Connects via IMAP, finds the unread email, marks it as read, 
 * and enqueues an auto-reply job to simulate human typing time.
 */
export const autoReadWorker = createWorker(
  QUEUE_NAMES.AUTO_READ_WARMUP,
  async (job) => {
    const { recipientEmail, senderEmail, subject } = job.data as AutoReadJobData;
    console.log(`[AutoRead] Simulating open for ${recipientEmail}`);

    // Find credentials. Could be an internal Inbox or an external SeedAccount.
    let creds = await prisma.inbox.findUnique({ where: { emailAddress: recipientEmail } });
    let isSeed = false;
    let seedCreds = null;

    if (!creds) {
      seedCreds = await prisma.seedAccount.findUnique({ where: { email: recipientEmail } });
      if (!seedCreds) {
        console.log(`[AutoRead] Credentials not found for ${recipientEmail}`);
        return;
      }
      isSeed = true;
    }

    const host = isSeed ? seedCreds!.imapHost : (creds!.imapHost || creds!.smtpHost.replace('smtp', 'imap').replace('mail', 'imap'));
    const port = isSeed ? seedCreds!.imapPort : (creds!.imapPort || 993);
    const user = isSeed ? (seedCreds!.imapUser || seedCreds!.smtpUser) : (creds!.imapUser || creds!.smtpUser);
    const pass = isSeed ? (seedCreds!.imapPass ? decrypt(seedCreds!.imapPass) : decrypt(seedCreds!.smtpPass)) : (creds!.imapPass ? decrypt(creds!.imapPass) : decrypt(creds!.smtpPass));

    if (!host) {
      console.log(`[AutoRead] No IMAP host configured for ${recipientEmail}`);
      return;
    }

    const client = new ImapFlow({
      host,
      port,
      secure: port === 993,
      auth: { user, pass },
      logger: false,
    });

    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      try {
        let messageId: string | null = null;
        // Search for unseen messages from the sender
        for await (const msg of client.fetch({ from: senderEmail, seen: false }, { envelope: true, uid: true })) {
          if (msg.envelope && msg.envelope.subject === subject) {
            console.log(`[AutoRead] Found match, marking as read: UID ${msg.uid}`);
            await client.messageFlagsAdd(msg.uid, ['\\Seen']);
            messageId = msg.envelope.messageId || null;
            break;
          }
        }

        if (messageId) {
          // Schedule the reply job
          const replyDelay = Math.random() * (10800000 - 1800000) + 1800000; // 30min to 3h
          await autoReplyWarmupQueue.add('auto-reply', {
            recipientEmail,
            senderEmail,
            subject,
            messageId,
          }, { delay: replyDelay });
          console.log(`[AutoRead] Reply scheduled for ${recipientEmail} in ${Math.round(replyDelay / 60000)} minutes`);
        }
      } finally {
        lock.release();
        await client.logout();
      }
    } catch (err) {
      console.error(`[AutoRead] IMAP error for ${recipientEmail}:`, err);
    }
  },
  2
);

/**
 * Worker to simulate a human replying to an email.
 * Uses Gemini API to generate a contextual reply.
 */
export const autoReplyWorker = createWorker(
  QUEUE_NAMES.AUTO_REPLY_WARMUP,
  async (job) => {
    const { recipientEmail, senderEmail, subject, messageId } = job.data as AutoReplyJobData;
    console.log(`[AutoReply] Generating reply from ${recipientEmail} to ${senderEmail}`);

    // Generate reply text
    const replyBody = await getGeminiReply(subject);
    const replySubject = subject.toLowerCase().startsWith('re:') ? subject : `Re: ${subject}`;

    // Get credentials to send
    let creds = await prisma.inbox.findUnique({ where: { emailAddress: recipientEmail } });
    let isSeed = false;
    let seedCreds = null;

    if (!creds) {
      seedCreds = await prisma.seedAccount.findUnique({ where: { email: recipientEmail } });
      if (!seedCreds) return;
      isSeed = true;
    }

    const host = isSeed ? seedCreds!.smtpHost : creds!.smtpHost;
    const port = isSeed ? seedCreds!.smtpPort : creds!.smtpPort;
    const user = isSeed ? seedCreds!.smtpUser : creds!.smtpUser;
    const pass = isSeed ? decrypt(seedCreds!.smtpPass) : decrypt(creds!.smtpPass);

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    try {
      await transporter.sendMail({
        from: recipientEmail,
        to: senderEmail,
        subject: replySubject,
        text: replyBody,
        inReplyTo: messageId,
        references: messageId,
      });
      console.log(`[AutoReply] Successfully sent reply from ${recipientEmail}`);
      
      // Update stats in WarmupLog if this was an internal Inbox
      if (!isSeed) {
        const log = await prisma.warmupLog.findFirst({
          where: { inboxId: creds!.id },
          orderBy: { date: 'desc' }
        });
        if (log) {
          await prisma.warmupLog.update({
            where: { id: log.id },
            data: { emailsReceived: log.emailsReceived + 1 }
          });
        }
      }
      
    } catch (err) {
      console.error(`[AutoReply] Failed to send reply from ${recipientEmail}:`, err);
    } finally {
      transporter.close();
    }
  },
  2
);
