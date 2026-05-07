import { prisma } from '@coldstack/db';
import { createWorker, emailSendQueue, QUEUE_NAMES, CampaignScheduleJobData } from '@coldstack/queue';

/**
 * Campaign Schedule Worker — Dispatches email-send jobs for running campaigns.
 * Runs every 15 minutes, checks which leads need emails.
 */
export const campaignScheduleWorker = createWorker(
  QUEUE_NAMES.CAMPAIGN_SCHEDULE,
  async (job) => {
    const { campaignId } = job.data as CampaignScheduleJobData;
    console.log(`[CampaignSchedule] Processing campaign ${campaignId}`);

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        sequences: { orderBy: { stepNumber: 'asc' } },
        campaignInboxes: { include: { inbox: true } },
        emailList: true,
      },
    });

    if (!campaign || campaign.status !== 'running') return;
    if (!campaign.sequences.length || !campaign.campaignInboxes.length) return;

    const readyInboxes = campaign.campaignInboxes
      .map((ci) => ci.inbox)
      .filter((i) => i.warmupStatus === 'ready' || i.warmupStatus === 'warming');

    if (readyInboxes.length === 0) return;

    // Get contacts that haven't been turned into leads yet
    const existingLeadContactIds = (await prisma.lead.findMany({
      where: { campaignId },
      select: { contactId: true },
    })).map((l) => l.contactId);

    const newContacts = await prisma.contact.findMany({
      where: {
        listId: campaign.emailListId!,
        id: { notIn: existingLeadContactIds },
        status: { not: 'unsubscribed' },
      },
      take: campaign.dailyLimit,
    });

    // Create leads for new contacts
    let inboxIndex = 0;
    for (const contact of newContacts) {
      const inbox = readyInboxes[inboxIndex % readyInboxes.length];
      inboxIndex++;

      const lead = await prisma.lead.create({
        data: {
          campaignId,
          contactId: contact.id,
          inboxId: inbox.id,
          stage: 'new_lead',
        },
      });

      // Queue first sequence step
      const firstSeq = campaign.sequences[0];
      if (firstSeq) {
        await emailSendQueue.add(`send-${lead.id}-${firstSeq.id}`, {
          leadId: lead.id,
          sequenceId: firstSeq.id,
          inboxId: inbox.id,
        });
      }
    }

    // Check existing leads for follow-ups
    const existingLeads = await prisma.lead.findMany({
      where: {
        campaignId,
        stage: { notIn: ['converted', 'lost', 'unsubscribed'] },
        nextFollowUpAt: { lte: new Date() },
      },
      include: { emailLogs: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    for (const lead of existingLeads) {
      const lastLog = lead.emailLogs[0];
      if (!lastLog) continue;

      const lastSeq = await prisma.sequence.findUnique({ where: { id: lastLog.sequenceId } });
      if (!lastSeq) continue;

      const nextSeq = campaign.sequences.find((s) => s.stepNumber === lastSeq.stepNumber + 1);
      if (!nextSeq) continue;

      // Check condition
      let shouldSend = false;
      switch (nextSeq.condition) {
        case 'always': shouldSend = true; break;
        case 'not_opened': shouldSend = !lastLog.openedAt; break;
        case 'not_replied': shouldSend = !lastLog.repliedAt; break;
        case 'opened_not_replied': shouldSend = !!lastLog.openedAt && !lastLog.repliedAt; break;
      }

      if (shouldSend) {
        await emailSendQueue.add(`send-${lead.id}-${nextSeq.id}`, {
          leadId: lead.id,
          sequenceId: nextSeq.id,
          inboxId: lead.inboxId,
        });
      }
    }

    console.log(`[CampaignSchedule] Processed: ${newContacts.length} new, ${existingLeads.length} follow-ups`);
  },
  3
);
