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
    const { leadId, sequenceId, inboxId, subjectOverride, funnelStepId } = job.data as any;

    const [lead, inbox] = await Promise.all([
      prisma.lead.findUnique({ where: { id: leadId }, include: { contact: true, campaign: true } }),
      prisma.inbox.findUnique({ where: { id: inboxId } }),
    ]);

    if (!lead || !inbox) {
      console.error(`[EmailSend] Missing data: lead=${!!lead} inbox=${!!inbox}`);
      return;
    }

    let sequence = null;
    let funnelStep = null;
    let subject = '';
    let html = '';
    let bodyText = '';

    if (funnelStepId) {
      funnelStep = await prisma.funnelStep.findUnique({ where: { id: funnelStepId } });
      if (!funnelStep) {
        console.error(`[EmailSend] FunnelStep ${funnelStepId} not found`);
        return;
      }
      subject = funnelStep.subject;
      html = funnelStep.bodyHtml;
      bodyText = funnelStep.bodyText || '';
    } else if (sequenceId) {
      sequence = await prisma.sequence.findUnique({ where: { id: sequenceId } });
      if (!sequence) {
        console.error(`[EmailSend] Sequence ${sequenceId} not found`);
        return;
      }
      subject = subjectOverride || sequence.subject;
      html = sequence.bodyHtml;
      bodyText = sequence.bodyText || '';
    } else {
      console.error(`[EmailSend] Neither sequenceId nor funnelStepId provided`);
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

    const placeholderSeqId = sequenceId || (await prisma.sequence.findFirst({ where: { campaignId: lead.campaignId } }))?.id || '';

    // Create email log first
    const emailLog = await prisma.emailLog.create({
      data: { leadId, inboxId, sequenceId: placeholderSeqId, status: 'sent', subject, preview: bodyText.substring(0, 100) },
    });

    // Personalize content
    const personData = {
      firstName: lead.contact.firstName || '',
      lastName: lead.contact.lastName || '',
      company: lead.contact.company || '',
      title: lead.contact.title || '',
      email: lead.contact.email,
    };

    html = personalizeContent(html, personData);
    const personalizedSubject = personalizeContent(subject, personData);

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
        subject: personalizedSubject,
        html,
        text: bodyText ? personalizeContent(bodyText, personData) : undefined,
        trackingPixel,
      });

      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: { messageId: result.messageId, sentAt: new Date(), status: 'delivered' },
      });

      // Update lead
      if (funnelStepId) {
        await prisma.lead.update({
          where: { id: leadId },
          data: {
            stage: lead.stage === 'new_lead' ? 'contacted' : undefined,
            lastContactedAt: new Date(),
          },
        });
      } else {
        const nextSeq = await prisma.sequence.findFirst({
          where: { campaignId: lead.campaignId, stepNumber: sequence!.stepNumber + 1 },
        });

        await prisma.lead.update({
          where: { id: leadId },
          data: {
            stage: lead.stage === 'new_lead' ? 'contacted' : undefined,
            lastContactedAt: new Date(),
            nextFollowUpAt: nextSeq ? new Date(Date.now() + nextSeq.delayDays * 86400000) : null,
          },
        });
      }

      await prisma.inbox.update({
        where: { id: inboxId },
        data: { totalSent: { increment: 1 }, lastUsedAt: new Date() },
      });

      console.log(`[EmailSend] Sent to ${lead.contact.email} (funnelStep=${!!funnelStepId})`);
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
