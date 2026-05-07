import { prisma } from '@coldstack/db';
import { createWorker, QUEUE_NAMES } from '@coldstack/queue';

/**
 * Analytics Rollup Worker — Hourly aggregation of email stats.
 */
export const analyticsRollupWorker = createWorker(
  QUEUE_NAMES.ANALYTICS_ROLLUP,
  async (job) => {
    console.log(`[AnalyticsRollup] Running hourly rollup`);

    // Update inbox stats
    const inboxes = await prisma.inbox.findMany({ select: { id: true } });

    for (const inbox of inboxes) {
      const [sent, bounced, replied] = await Promise.all([
        prisma.emailLog.count({ where: { inboxId: inbox.id, status: { not: 'failed' } } }),
        prisma.emailLog.count({ where: { inboxId: inbox.id, bouncedAt: { not: null } } }),
        prisma.emailLog.count({ where: { inboxId: inbox.id, repliedAt: { not: null } } }),
      ]);

      await prisma.inbox.update({
        where: { id: inbox.id },
        data: { totalSent: sent, totalBounced: bounced, totalReplied: replied },
      });
    }

    // Auto-complete campaigns where all contacts have been processed
    const runningCampaigns = await prisma.campaign.findMany({
      where: { status: 'running' },
      include: {
        emailList: { select: { totalContacts: true } },
        _count: { select: { leads: true } },
      },
    });

    for (const campaign of runningCampaigns) {
      if (campaign.emailList && campaign._count.leads >= campaign.emailList.totalContacts) {
        const pendingLeads = await prisma.lead.count({
          where: { campaignId: campaign.id, nextFollowUpAt: { not: null } },
        });
        if (pendingLeads === 0) {
          await prisma.campaign.update({
            where: { id: campaign.id },
            data: { status: 'completed' },
          });
        }
      }
    }

    console.log(`[AnalyticsRollup] Updated ${inboxes.length} inboxes, checked ${runningCampaigns.length} campaigns`);
  },
  1
);
