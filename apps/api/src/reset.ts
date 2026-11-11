import { prisma } from '@coldstack/db';
import { warmupQueue } from '@coldstack/queue';

async function resetAll() {
  console.log('Resetting all inboxes...');

  // 1. Clear all warmup logs
  const deletedLogs = await prisma.warmupLog.deleteMany({});
  console.log(`Deleted ${deletedLogs.count} warmup logs.`);

  // 2. Reset all inboxes
  const updatedInboxes = await prisma.inbox.updateMany({
    data: {
      warmupStatus: 'idle',
      warmupScore: 0,
      warmupWeek: 0,
      weekApproved: false,
      dailySendLimit: 2,
      totalSent: 0,
      totalBounced: 0,
      totalReplied: 0
    }
  });
  console.log(`Reset ${updatedInboxes.count} inboxes to starting stats.`);

  // 3. Clear the queue
  console.log('Fetching repeatable jobs...');
  const repeatableJobs = await warmupQueue.getRepeatableJobs();
  let count = 0;
  for (const job of repeatableJobs) {
    if (job.name.startsWith('warmup-')) {
      await warmupQueue.removeRepeatableByKey(job.key);
      count++;
    }
  }
  console.log(`Removed ${count} scheduled warmup jobs.`);

  // Also clear any delayed/waiting jobs
  await warmupQueue.obliterate({ force: true });
  console.log('Obliterated warmup queue completely.');

  console.log('Done!');
  process.exit(0);
}

resetAll().catch(err => {
  console.error(err);
  process.exit(1);
});
