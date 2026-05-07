import { prisma } from '@coldstack/db';
import { createWorker, QUEUE_NAMES, BounceProcessorJobData } from '@coldstack/queue';

/**
 * Bounce Processor Worker — Handles bounce/complaint webhooks.
 */
export const bounceProcessorWorker = createWorker(
  QUEUE_NAMES.BOUNCE_PROCESSOR,
  async (job) => {
    const { emailLogId, bounceType, bounceMessage } = job.data as BounceProcessorJobData;
    console.log(`[BounceProcessor] Processing bounce for ${emailLogId}`);

    const emailLog = await prisma.emailLog.findUnique({
      where: { id: emailLogId },
      include: { lead: true, inbox: true },
    });

    if (!emailLog) return;

    await prisma.emailLog.update({
      where: { id: emailLogId },
      data: { bouncedAt: new Date(), status: 'bounced' },
    });

    await prisma.lead.update({
      where: { id: emailLog.leadId },
      data: { stage: 'lost', notes: `Bounced: ${bounceType} - ${bounceMessage}` },
    });

    await prisma.contact.update({
      where: { id: emailLog.lead.contactId },
      data: { status: 'bounced' },
    });

    if (emailLog.inbox) {
      await prisma.inbox.update({
        where: { id: emailLog.inboxId },
        data: { totalBounced: { increment: 1 } },
      });
    }

    await prisma.webhookEvent.create({
      data: { type: 'bounce', payload: { emailLogId, bounceType, bounceMessage } },
    });

    console.log(`[BounceProcessor] Processed bounce for lead ${emailLog.leadId}`);
  },
  3
);
