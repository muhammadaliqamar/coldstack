import { prisma } from '@coldstack/db';
import { createWorker, QUEUE_NAMES, EmailSendJobData } from '@coldstack/queue';
import { sendEmail, personalizeContent, injectLinkTracking } from '@coldstack/mailer';

const TRACKING_DOMAIN = process.env.TRACKING_DOMAIN || 'http://localhost:4000';

/**
 * Email Send Worker — Sends individual emails with tracking.
 */
export const emailSendWorker = createWorker(
  QUEUE_NAMES.EMAIL_SEND,
  async (job) => {
    const { leadId, sequenceId, inboxId } = job.data as EmailSendJobData;

    const [lead, sequence, inbox] = await Promise.all([
      prisma.lead.findUnique({ where: { id: leadId }, include: { contact: true, campaign: true } }),
      prisma.sequence.findUnique({ where: { id: sequenceId } }),
      prisma.inbox.findUnique({ where: { id: inboxId } }),
    ]);

    if (!lead || !sequence || !inbox) {
      console.error(`[EmailSend] Missing data: lead=${!!lead} seq=${!!sequence} inbox=${!!inbox}`);
      return;
    }

    // Check daily send limit
    const todaySent = await prisma.emailLog.count({
      where: { inboxId, createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
    });
    if (todaySent >= inbox.dailySendLimit) {
      console.log(`[EmailSend] Inbox ${inboxId} daily limit reached`);
      throw new Error('Daily send limit reached, will retry');
    }

    // Create email log first
    const emailLog = await prisma.emailLog.create({
      data: { leadId, inboxId, sequenceId, status: 'sent', subject: sequence.subject, preview: sequence.bodyText?.substring(0, 100) },
    });

    // Personalize content
    const personData = {
      firstName: lead.contact.firstName || '',
      lastName: lead.contact.lastName || '',
      company: lead.contact.company || '',
      title: lead.contact.title || '',
      email: lead.contact.email,
    };

    let html = personalizeContent(sequence.bodyHtml, personData);
    const subject = personalizeContent(sequence.subject, personData);

    // Inject click tracking
    if (lead.campaign.trackClicks) {
      html = injectLinkTracking(html, emailLog.id, TRACKING_DOMAIN);
    }

    // Add unsubscribe footer
    html += `<br/><p style="font-size:11px;color:#999;">${lead.campaign.unsubFooter || ''}</p>`;

    // Build tracking pixel URL
    const trackingPixel = lead.campaign.trackOpens ? `${TRACKING_DOMAIN}/t/open/${emailLog.id}` : undefined;

    try {
      const result = await sendEmail(inbox, {
        to: lead.contact.email,
        subject,
        html,
        text: sequence.bodyText ? personalizeContent(sequence.bodyText, personData) : undefined,
        trackingPixel,
      });

      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: { messageId: result.messageId, sentAt: new Date(), status: 'delivered' },
      });

      // Update lead
      const nextSeq = await prisma.sequence.findFirst({
        where: { campaignId: lead.campaignId, stepNumber: sequence.stepNumber + 1 },
      });

      await prisma.lead.update({
        where: { id: leadId },
        data: {
          stage: lead.stage === 'new_lead' ? 'contacted' : undefined,
          lastContactedAt: new Date(),
          nextFollowUpAt: nextSeq ? new Date(Date.now() + nextSeq.delayDays * 86400000) : null,
        },
      });

      await prisma.inbox.update({
        where: { id: inboxId },
        data: { totalSent: { increment: 1 }, lastUsedAt: new Date() },
      });

      console.log(`[EmailSend] Sent to ${lead.contact.email} (step ${sequence.stepNumber})`);
    } catch (err: any) {
      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: { status: 'failed' },
      });
      throw err;
    }
  },
  5
);
