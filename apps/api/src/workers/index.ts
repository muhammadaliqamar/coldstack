import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

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

  // ── Restore warmup jobs safely (prevent duplicate sends on restart) ──
  const warmingInboxes = await prisma.inbox.findMany({
    where: { warmupStatus: 'warming' },
    select: { id: true, dailySendLimit: true },
  });

  // Drain any stale pending individual warmup-email-send jobs from the queue
  // These are leftover from the previous process and would cause duplicate sends
  const { warmupQueue: wq } = await import('@coldstack/queue');
  const waitingJobs = await wq.getWaiting();
  const delayedJobs = await wq.getDelayed();
  const staleJobs = [...waitingJobs, ...delayedJobs].filter(
    j => j.name === 'warmup-email-send'
  );
  if (staleJobs.length > 0) {
    for (const job of staleJobs) {
      try { await job.remove(); } catch (e) { /* already processing */ }
    }
    console.log(`🧹 Removed ${staleJobs.length} stale warmup-email-send jobs from previous session`);
  }

  // Re-add repeatable daily schedule and conditionally trigger immediate run
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  for (const inbox of warmingInboxes) {
    // Always re-add the daily repeatable schedule
    await wq.add(`warmup-${inbox.id}`, { inboxId: inbox.id }, {
      repeat: { pattern: '0 9 * * *' },
    });

    // Only trigger an immediate run if today's limit hasn't been met
    const todaySentCount = await prisma.warmupLog.count({
      where: { inboxId: inbox.id, date: { gte: todayStart } },
    });

    if (todaySentCount < (inbox.dailySendLimit || 2)) {
      await wq.add(`warmup-${inbox.id}-immediate`, { inboxId: inbox.id });
      console.log(`  ↳ Inbox ${inbox.id}: ${todaySentCount}/${inbox.dailySendLimit} sent today — triggering catch-up`);
    } else {
      console.log(`  ↳ Inbox ${inbox.id}: ${todaySentCount}/${inbox.dailySendLimit} sent today — skipping (limit reached)`);
    }
  }

  console.log(`📅 Scheduled recurring jobs (${activeInboxes.length} inbox reply checks, ${warmingInboxes.length} warmup queues restored safely)`);
}

scheduleRecurringJobs().catch(console.error);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down workers...');
  await Promise.all(workers.map(({ worker }) => worker.close()));
  process.exit(0);
});

console.log('🚀 All workers running');
