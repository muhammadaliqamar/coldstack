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
    const { recipientEmail, senderEmail, subject, messageId: passedMessageId, originalBody } = job.data as AutoReadJobData;
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

    // Handle connection errors/timeouts gracefully
    client.on('error', err => {
      console.error(`[AutoRead] IMAP client error for ${recipientEmail}:`, err.message);
    });

    try {
      // Set a 10s timeout for the connection attempt
      await Promise.race([
        client.connect(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 10000))
      ]);

      const searchMailbox = async (mailboxPath: string, moveIfFound: boolean) => {
        try {
          const lock = await client.getMailboxLock(mailboxPath);
          try {
            let foundMsgId: string | null = null;
            // Search for unseen messages
            for await (const msg of client.fetch({ seen: false }, { envelope: true, uid: true })) {
              let match = false;
              if (passedMessageId && msg.envelope?.messageId && msg.envelope.messageId.includes(passedMessageId.replace(/[<>]/g, ''))) {
                match = true;
              } else if (msg.envelope && msg.envelope.subject === subject) {
                match = true;
              }

              if (match) {
                console.log(`[AutoRead] Found match in ${mailboxPath}, marking as read: UID ${msg.uid}`);
                await client.messageFlagsAdd(msg.uid, ['\\Seen']);
                foundMsgId = msg.envelope?.messageId || passedMessageId || null;
                if (moveIfFound) {
                  await client.messageMove(msg.uid, 'INBOX');
                  console.log(`[AutoRead] Rescued from ${mailboxPath} to INBOX for ${recipientEmail}`);
                }
                break;
              }
            }
            return foundMsgId;
          } finally {
            lock.release();
          }
        } catch (e) {
          // Mailbox might not exist
          return null;
        }
      };

      let foundMessageId = await searchMailbox('INBOX', false);
      
      if (!foundMessageId) {
        // Fallback to checking common Spam/Junk folders to rescue it
        foundMessageId = await searchMailbox('Spam', true) 
          || await searchMailbox('Junk', true)
          || await searchMailbox('Junk Email', true);
      }

      if (foundMessageId) {
        // Schedule the reply job
        const replyDelay = Math.random() * (900000 - 300000) + 300000; // 5min to 15min
        await autoReplyWarmupQueue.add('auto-reply', {
          recipientEmail,
          senderEmail,
          subject,
          messageId: foundMessageId,
          originalBody
        }, { delay: replyDelay });
        console.log(`[AutoRead] Reply scheduled for ${recipientEmail} in ${Math.round(replyDelay / 60000)} minutes`);
      } else {
        console.log(`[AutoRead] Message not found for ${recipientEmail}`);
      }

      if (client.usable) {
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
 * Sends as proper HTML threaded reply (like Gmail) with In-Reply-To/References headers.
 */
export const autoReplyWorker = createWorker(
  QUEUE_NAMES.AUTO_REPLY_WARMUP,
  async (job) => {
    const { recipientEmail, senderEmail, subject, messageId, originalBody } = job.data as AutoReplyJobData;
    console.log(`[AutoReply] Generating reply from ${recipientEmail} to ${senderEmail}`);

    // Generate reply text
    const geminiReply = await getGeminiReply(subject);
    const replySubject = subject.toLowerCase().startsWith('re:') ? subject : `Re: ${subject}`;

    // Format as proper HTML threaded reply (like Gmail does)
    const dateStr = new Date().toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', timeZoneName: 'short' });
    
    // HTML version — looks like a real Gmail/Outlook thread
    const replyHtml = `<div dir="ltr">${geminiReply.replace(/\n/g, '<br>')}</div>${originalBody ? `
<br>
<div class="gmail_quote">
  <div dir="ltr" class="gmail_attr">On ${dateStr}, &lt;${senderEmail}&gt; wrote:<br></div>
  <blockquote class="gmail_quote" style="margin:0px 0px 0px 0.8ex;border-left:1px solid rgb(204,204,204);padding-left:1ex">
    <div dir="ltr">${originalBody.replace(/\n/g, '<br>')}</div>
  </blockquote>
</div>` : ''}`;

    // Plain text version as fallback
    const quotedOriginal = originalBody ? `\n\nOn ${dateStr}, ${senderEmail} wrote:\n> ${originalBody.replace(/\n/g, '\n> ')}` : '';
    const replyText = `${geminiReply}${quotedOriginal}`;

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

    // Ensure messageId has angle brackets for proper threading
    const formattedMessageId = messageId && !messageId.startsWith('<') ? `<${messageId}>` : messageId;

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    try {
      const fromString = isSeed ? recipientEmail : (creds?.fromName ? `"${creds.fromName}" <${recipientEmail}>` : recipientEmail);
      
      await transporter.sendMail({
        from: fromString,
        to: senderEmail,
        subject: replySubject,
        text: replyText,
        html: replyHtml,
        inReplyTo: formattedMessageId,
        references: formattedMessageId,
      });
      console.log(`[AutoReply] Successfully sent reply from ${recipientEmail} to ${senderEmail}`);
      
      // ── Update stats for the SENDER's inbox (the one that originally sent) ──
      const senderInbox = await prisma.inbox.findUnique({ where: { emailAddress: senderEmail } });
      if (senderInbox) {
        // Update totalReplied on the sender inbox (they received a reply)
        await prisma.inbox.update({
          where: { id: senderInbox.id },
          data: { totalReplied: senderInbox.totalReplied + 1 },
        });

        // Find the original WarmupLog for this send and mark it as replied
        const originalLog = await prisma.warmupLog.findFirst({
          where: {
            inboxId: senderInbox.id,
            recipientEmail: recipientEmail,
            status: 'sent',
          },
          orderBy: { date: 'desc' },
        });
        if (originalLog) {
          await prisma.warmupLog.update({
            where: { id: originalLog.id },
            data: { status: 'replied', emailsReceived: originalLog.emailsReceived + 1 },
          });
        }
      }

      // ── Update stats for the REPLIER's inbox if it's an internal Inbox ──
      if (!isSeed && creds) {
        const log = await prisma.warmupLog.findFirst({
          where: { inboxId: creds.id },
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
