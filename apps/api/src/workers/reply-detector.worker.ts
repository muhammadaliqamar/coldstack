import { prisma } from '@coldstack/db';
import { createWorker, QUEUE_NAMES, ReplyDetectorJobData } from '@coldstack/queue';

/**
 * Reply Detector Worker — Polls for replies on active inboxes.
 * In production, this would use IMAP via imapflow. Here we provide the structure.
 */
export const replyDetectorWorker = createWorker(
  QUEUE_NAMES.REPLY_DETECTOR,
  async (job) => {
    const { inboxId } = job.data as ReplyDetectorJobData;
    console.log(`[ReplyDetector] Checking replies for inbox ${inboxId}`);

    const inbox = await prisma.inbox.findUnique({ where: { id: inboxId } });
    if (!inbox) return;

    // In production: connect via IMAP and check for new messages
    // const { ImapFlow } = require('imapflow');
    // const client = new ImapFlow({
    //   host: inbox.smtpHost.replace('smtp', 'imap'),
    //   port: 993,
    //   secure: true,
    //   auth: { user: inbox.smtpUser, pass: decrypt(inbox.smtpPass) },
    // });
    // await client.connect();
    // ... check INBOX for new messages, match by In-Reply-To header
    // await client.logout();

    // Find recent sent emails that haven't been replied to
    const pendingReplies = await prisma.emailLog.findMany({
      where: {
        inboxId,
        repliedAt: null,
        status: { in: ['delivered', 'opened', 'clicked'] },
        sentAt: { gte: new Date(Date.now() - 7 * 86400000) },
      },
      include: { lead: true },
    });

    console.log(`[ReplyDetector] ${pendingReplies.length} emails pending reply check for inbox ${inboxId}`);
    // In production, match incoming emails against messageId/In-Reply-To headers
  },
  2
);
