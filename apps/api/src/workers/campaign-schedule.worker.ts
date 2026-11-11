import { prisma } from '@coldstack/db';
import { createWorker, emailSendQueue, QUEUE_NAMES, CampaignScheduleJobData } from '@coldstack/queue';

/**
 * Campaign Schedule Worker — Dispatches email-send and nurturing funnel jobs.
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

    // Track daily send limits
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const sentTodayCount = await prisma.lead.count({
      where: {
        campaignId,
        createdAt: { gte: todayStart },
      },
    });

    if (sentTodayCount >= campaign.dailyLimit) {
      console.log(`[CampaignSchedule] Campaign ${campaignId} already reached its daily limit of ${campaign.dailyLimit} today (${sentTodayCount} sent).`);
      return;
    }

    // Random skip run to mimic human behavior (10% chance)
    if (Math.random() < 0.1) {
      console.log(`[CampaignSchedule] Randomly skipping sending run for campaign ${campaignId} to simulate natural human activity.`);
      return;
    }

    const limitRemaining = campaign.dailyLimit - sentTodayCount;

    // CRITICAL: Only dispatch to contacts that have been VERIFIED!
    const newContacts = await prisma.contact.findMany({
      where: {
        listId: campaign.emailListId!,
        id: { notIn: existingLeadContactIds },
        status: { not: 'unsubscribed' },
        verificationStatus: 'verified', // Verified-only filter
      },
      take: limitRemaining,
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
          funnelStage: 'campaign',
          funnelStep: 0,
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

    // Check existing active leads for follow-ups or nurturing progression
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

      // ── Funnel Stage: Standard Campaign + Human Nature Resends ──
      if (lead.funnelStage === 'campaign') {
        if (!lastLog) {
          // If somehow no log exists, re-enqueue first sequence step
          const firstSeq = campaign.sequences[0];
          if (firstSeq) {
            await emailSendQueue.add(`send-${lead.id}-${firstSeq.id}`, {
              leadId: lead.id,
              sequenceId: firstSeq.id,
              inboxId: lead.inboxId || readyInboxes[0].id,
            });
          }
          continue;
        }

        const lastSeq = await prisma.sequence.findUnique({ where: { id: lastLog.sequenceId } });
        if (!lastSeq) continue;

        const nextSeq = campaign.sequences.find((s) => s.stepNumber === lastSeq.stepNumber + 1);

        if (nextSeq) {
          // Standard Sequence step handling
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
              inboxId: lead.inboxId || readyInboxes[0].id,
            });
          }
        } else {
          // No next standard sequence step — standard campaign run is complete!
          // Implement Human-Nature Resends (Run 2 and Run 3) for non-openers
          if (lead.funnelStep < 2) {
            const totalOpens = await prisma.emailLog.count({
              where: { leadId: lead.id, openedAt: { not: null } },
            });

            if (totalOpens === 0) {
              const newRun = lead.funnelStep + 1;
              const resendSubject = `Re: ${lastLog.subject || lastSeq.subject}`;

              // Resend with a human-mimicking follow-up subject
              await emailSendQueue.add(`resend-${lead.id}-${newRun}`, {
                leadId: lead.id,
                sequenceId: lastSeq.id, // Reuse last sequence
                inboxId: lead.inboxId || readyInboxes[0].id,
                subjectOverride: resendSubject,
              });

              await prisma.lead.update({
                where: { id: lead.id },
                data: {
                  funnelStep: newRun,
                  nextFollowUpAt: new Date(Date.now() + 3 * 86400000), // Delay 3 days for next run
                },
              });
              console.log(`[CampaignSchedule] Resending Run ${newRun + 1} to non-opener ${lead.id}`);
            } else {
              // Lead opened campaign emails — proceed to TOFU nurturing funnel starting tomorrow
              await prisma.lead.update({
                where: { id: lead.id },
                data: {
                  funnelStage: 'tofu',
                  funnelStep: 0,
                  nextFollowUpAt: new Date(Date.now() + 86400000), // Day 1 after campaign
                },
              });
            }
          } else {
            // Already completed 3 runs — proceed to TOFU nurturing funnel starting tomorrow
            await prisma.lead.update({
              where: { id: lead.id },
              data: {
                funnelStage: 'tofu',
                funnelStep: 0,
                nextFollowUpAt: new Date(Date.now() + 86400000), // Day 1 after campaign
              },
            });
          }
        }
      }
      // ── Funnel Stages: Nurturing (TOFU / MOFU / BOFU) ──
      else if (['tofu', 'mofu', 'bofu'].includes(lead.funnelStage)) {
        const currentStage = lead.funnelStage;
        const currentStepNum = lead.funnelStep + 1;

        // Fetch funnel step configuration
        const stepConfig = await prisma.funnelStep.findFirst({
          where: {
            funnel: currentStage as any,
            step: currentStepNum,
          },
        });

        if (stepConfig) {
          // Condition: Only send the follow-up step if the lead did NOT open the previous email!
          let shouldSend = true;
          if (lastLog) {
            shouldSend = !lastLog.openedAt;
          }

          if (shouldSend) {
            await emailSendQueue.add(`funnel-${lead.id}-${currentStage}-${currentStepNum}`, {
              leadId: lead.id,
              inboxId: lead.inboxId || readyInboxes[0].id,
              funnelStepId: stepConfig.id,
            });
          }

          const nextStepNum = currentStepNum + 1;
          const nextStepExists = await prisma.funnelStep.findFirst({
            where: {
              funnel: currentStage as any,
              step: nextStepNum,
            },
          });

          if (nextStepExists && nextStepNum <= 10) {
            await prisma.lead.update({
              where: { id: lead.id },
              data: {
                funnelStep: currentStepNum,
                nextFollowUpAt: new Date(Date.now() + stepConfig.delayDays * 86400000),
              },
            });
          } else {
            // Completed current funnel stage — transition to the next stage
            let nextStage: any = 'mofu';
            if (currentStage === 'mofu') nextStage = 'bofu';
            else if (currentStage === 'bofu') nextStage = 'closed';

            await prisma.lead.update({
              where: { id: lead.id },
              data: {
                funnelStage: nextStage,
                funnelStep: 0,
                nextFollowUpAt: nextStage === 'closed' ? null : new Date(Date.now() + 86400000),
              },
            });

            // If transitioned to closed (BOFU completed), trigger AI Closer deal negotiation!
            if (nextStage === 'closed') {
              await prisma.lead.update({
                where: { id: lead.id },
                data: {
                  aiStatus: 'pending_approval',
                },
              });
              const { generateCloserDraft } = await import('./ai-closer.worker');
              await generateCloserDraft(lead.id).catch(console.error);
            }
          }
        } else {
          // If no step config is saved by the user yet, skip to avoid blocking other items
          await prisma.lead.update({
            where: { id: lead.id },
            data: {
              nextFollowUpAt: new Date(Date.now() + 86400000), // check again tomorrow
            },
          });
        }
      }
    }

    console.log(`[CampaignSchedule] Processed: ${newContacts.length} new verified leads, ${existingLeads.length} active leads`);
  },
  3
);
