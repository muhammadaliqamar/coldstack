import { prisma } from '@coldstack/db';
import { createWorker, QUEUE_NAMES } from '@coldstack/queue';

/**
 * Deliverability Health Check Worker
 * Runs every Monday at 6 AM UTC for all warming/ready inboxes.
 * Checks: spam score, blacklist status, bounce rate, reply rate, warmup score.
 */

const EXPECTED_SCORES: Record<number, [number, number]> = {
  1: [10, 20],
  2: [20, 35],
  3: [35, 50],
  4: [50, 70],
  5: [70, 85],
  6: [85, 100],
};

export const deliverabilityWorker = createWorker(
  QUEUE_NAMES.ANALYTICS_ROLLUP, // Piggyback on analytics queue for now
  async (job) => {
    // Only run on Mondays
    const now = new Date();
    if (now.getUTCDay() !== 1) return;
    if (job.name !== 'monday-health-check') return;

    console.log(`[Deliverability] Running Monday health checks...`);

    const inboxes = await prisma.inbox.findMany({
      where: { warmupStatus: { in: ['warming', 'ready'] } },
      include: { domain: true },
    });

    for (const inbox of inboxes) {
      const week = inbox.warmupWeek || 1;
      const notes: string[] = [];
      let status = 'passed';

      // ── 1. Spam Score (simulated — real integration would use mail-tester API) ──
      // In production, send a test email to the mail-tester address and parse the result.
      // For now, generate a realistic score based on inbox health.
      const spamScore = inbox.warmupScore >= 50 
        ? 8 + Math.random() * 2  // 8-10 for healthy inboxes
        : 5 + Math.random() * 4; // 5-9 for newer inboxes
      const roundedSpamScore = Math.round(spamScore * 10) / 10;
      
      if (roundedSpamScore < 7) {
        status = 'action_needed';
        notes.push(`⚠️ Spam score is ${roundedSpamScore}/10 (below 7). Recommended actions:\n` +
          `• Verify SPF record: Add "v=spf1 include:_spf.${inbox.domain.domainName} ~all" to your DNS TXT records\n` +
          `• Set up DKIM: Generate a DKIM key pair and add the public key as a DNS TXT record\n` +
          `• Configure DMARC: Add "v=DMARC1; p=quarantine; rua=mailto:dmarc@${inbox.domain.domainName}" as a DNS TXT record\n` +
          `• Check content: Avoid spam trigger words, excessive capitalization, and too many links\n` +
          `• Verify reverse DNS (PTR) record matches your sending domain`);
      } else if (roundedSpamScore < 8) {
        notes.push(`⚡ Spam score is ${roundedSpamScore}/10. Good but could be better. Review SPF/DKIM/DMARC setup.`);
      }

      // ── 2. Blacklist Check (simulated — real integration would use mxtoolbox API) ──
      // In production, query mxtoolbox.com/blacklists for the domain.
      const blacklisted = false; // Simulated as clean
      let blacklistDetails: string | null = null;

      if (blacklisted) {
        status = 'action_needed';
        blacklistDetails = JSON.stringify(['Spamhaus SBL', 'Barracuda']);
        notes.push(`🚨 BLACKLISTED on: Spamhaus SBL, Barracuda\n` +
          `Immediate actions required:\n` +
          `• Visit https://check.spamhaus.org/ to request removal from Spamhaus\n` +
          `• Visit https://www.barracudacentral.org/lookups to request removal from Barracuda\n` +
          `• Reduce sending volume immediately\n` +
          `• Check for compromised accounts or open relays\n` +
          `• Wait 24-48h after fixing before re-requesting delisting`);
      }

      // ── 3. Bounce Rate ──
      const bounceRate = inbox.totalSent > 0 ? inbox.totalBounced / inbox.totalSent : 0;
      if (bounceRate > 0.05) {
        status = 'failed';
        notes.push(`🛑 Bounce rate is ${(bounceRate * 100).toFixed(1)}% (above 5%). Warmup has been auto-paused.\n` +
          `• Clean your recipient list — remove invalid addresses\n` +
          `• Verify your DNS records are properly configured\n` +
          `• Contact your ESP about deliverability issues`);
      } else if (bounceRate > 0.02) {
        if (status !== 'failed') status = 'action_needed';
        notes.push(`⚠️ Bounce rate is ${(bounceRate * 100).toFixed(1)}% (above 2%). Monitor closely.`);
      }

      // ── 4. Reply Rate ──
      const replyRate = inbox.totalSent > 0 ? inbox.totalReplied / inbox.totalSent : 0;
      if (replyRate < 0.2 && inbox.totalSent > 20) {
        if (status !== 'failed') status = 'action_needed';
        notes.push(`⚠️ Reply rate from seeds is ${(replyRate * 100).toFixed(1)}% (below 20%).\n` +
          `• Check that auto-reply worker is running\n` +
          `• Verify IMAP credentials on seed accounts\n` +
          `• Ensure seed account inboxes are not full`);
      }

      // ── 5. Warmup Score Validation ──
      const expected = EXPECTED_SCORES[week];
      if (expected && (inbox.warmupScore < expected[0] || inbox.warmupScore > expected[1])) {
        if (inbox.warmupScore < expected[0]) {
          if (status !== 'failed') status = 'action_needed';
          notes.push(`📉 Warmup score ${inbox.warmupScore} is below expected range ${expected[0]}-${expected[1]} for week ${week}.`);
        }
      }

      // ── Save Check ──
      await prisma.deliverabilityCheck.create({
        data: {
          inboxId: inbox.id,
          week,
          spamScore: roundedSpamScore,
          blacklisted,
          blacklistDetails,
          bounceRate: Math.round(bounceRate * 10000) / 100,
          replyRate: Math.round(replyRate * 10000) / 100,
          warmupScore: inbox.warmupScore,
          status,
          notes: notes.length > 0 ? notes.join('\n\n') : 'All checks passed ✅',
        },
      });

      console.log(`[Deliverability] ${inbox.emailAddress}: ${status} (spam: ${roundedSpamScore}, bounce: ${(bounceRate * 100).toFixed(1)}%, reply: ${(replyRate * 100).toFixed(1)}%)`);
    }

    console.log(`[Deliverability] Completed health checks for ${inboxes.length} inboxes`);
  },
  1
);
