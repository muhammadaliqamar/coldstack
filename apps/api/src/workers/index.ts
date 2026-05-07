import { warmupWorker } from './warmup.worker';
import { campaignScheduleWorker } from './campaign-schedule.worker';
import { emailSendWorker } from './email-send.worker';
import { bounceProcessorWorker } from './bounce-processor.worker';
import { replyDetectorWorker } from './reply-detector.worker';
import { analyticsRollupWorker } from './analytics-rollup.worker';
import { autoReadWorker, autoReplyWorker } from './auto-reply.worker';
import { deliverabilityWorker } from './deliverability.worker';
import { analyticsRollupQueue, replyDetectorQueue } from '@coldstack/queue';
import { prisma } from '@coldstack/db';

console.log('🔧 Starting ColdStack Workers...');

// Log worker events
const workers = [
  { name: 'Warmup', worker: warmupWorker },
  { name: 'CampaignSchedule', worker: campaignScheduleWorker },
  { name: 'EmailSend', worker: emailSendWorker },
  { name: 'BounceProcessor', worker: bounceProcessorWorker },
  { name: 'ReplyDetector', worker: replyDetectorWorker },
  { name: 'AnalyticsRollup', worker: analyticsRollupWorker },
  { name: 'AutoRead', worker: autoReadWorker },
  { name: 'AutoReply', worker: autoReplyWorker },
  { name: 'Deliverability', worker: deliverabilityWorker },
];

for (const { name, worker } of workers) {
  worker.on('completed', (job) => {
    console.log(`✅ [${name}] Job ${job.id} completed`);
  });
  worker.on('failed', (job, err) => {
    console.error(`❌ [${name}] Job ${job?.id} failed:`, err.message);
  });
  console.log(`  ✓ ${name} worker ready`);
}

// Schedule recurring jobs
async function scheduleRecurringJobs() {
  // Analytics rollup every hour
  await analyticsRollupQueue.add('hourly-rollup', { timestamp: new Date().toISOString() }, {
    repeat: { pattern: '0 * * * *' },
  });

  // Monday deliverability health checks at 6 AM UTC
  await analyticsRollupQueue.add('monday-health-check', { timestamp: new Date().toISOString() }, {
    repeat: { pattern: '0 6 * * 1' },
  });

  // Reply detection every 10 minutes for all active inboxes
  const activeInboxes = await prisma.inbox.findMany({
    where: { warmupStatus: { in: ['warming', 'ready'] } },
    select: { id: true },
  });

  for (const inbox of activeInboxes) {
    await replyDetectorQueue.add(`reply-check-${inbox.id}`, { inboxId: inbox.id }, {
      repeat: { pattern: '*/10 * * * *' },
    });
  }

  console.log(`📅 Scheduled recurring jobs (${activeInboxes.length} inbox reply checks)`);
}

scheduleRecurringJobs().catch(console.error);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down workers...');
  await Promise.all(workers.map(({ worker }) => worker.close()));
  process.exit(0);
});

console.log('🚀 All workers running');
