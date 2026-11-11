import { PrismaClient } from '@prisma/client';
import { warmupQueue, autoReadWarmupQueue, autoReplyWarmupQueue } from '@coldstack/queue';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Starting Warmup Reset...');

  // 1. Clear Warmup Logs
  const deletedLogs = await prisma.warmupLog.deleteMany({});
  console.log(`✅ Deleted ${deletedLogs.count} warmup logs`);

  // 2. Reset Inbox Stats & Pause Warmup
  const updatedInboxes = await prisma.inbox.updateMany({
    data: {
      warmupStatus: 'idle',
      warmupScore: 0,
      warmupWeek: 0,
      weekApproved: false,
      dailySendLimit: 5,
      totalSent: 0,
      totalBounced: 0,
      totalReplied: 0,
    },
  });
  console.log(`✅ Reset stats and paused warmup for ${updatedInboxes.count} inboxes`);

  // 3. Clear BullMQ Repeatable and Delayed Jobs
  console.log('🧹 Clearing background queues...');
  
  const repeatableJobs = await warmupQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await warmupQueue.removeRepeatableByKey(job.key);
  }
  await warmupQueue.obliterate({ force: true });
  console.log(`✅ Cleared warmup queue (removed ${repeatableJobs.length} scheduled routines)`);

  await autoReadWarmupQueue.obliterate({ force: true });
  console.log(`✅ Cleared auto-read queue`);
  
  await autoReplyWarmupQueue.obliterate({ force: true });
  console.log(`✅ Cleared auto-reply queue`);

  console.log('🎉 Reset complete! All inboxes are starting fresh.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
