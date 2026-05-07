import { Router } from 'express';
import { prisma } from '@coldstack/db';

const router = Router();

// 1x1 transparent pixel (GIF)
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

/**
 * GET /t/open/:emailLogId — Serve tracking pixel, mark email as opened
 */
router.get('/open/:emailLogId', async (req, res) => {
  try {
    const { emailLogId } = req.params;
    const emailLog = await prisma.emailLog.findUnique({ where: { id: emailLogId } });

    if (emailLog && !emailLog.openedAt) {
      await prisma.emailLog.update({
        where: { id: emailLogId },
        data: { openedAt: new Date(), status: 'opened' },
      });

      // Update lead stage if still at 'contacted'
      const lead = await prisma.lead.findUnique({ where: { id: emailLog.leadId } });
      if (lead && lead.stage === 'contacted') {
        await prisma.lead.update({
          where: { id: lead.id },
          data: { stage: 'opened' },
        });
      }
    }
  } catch (err) {
    console.error('Tracking pixel error:', err);
  }

  res.writeHead(200, {
    'Content-Type': 'image/gif',
    'Content-Length': PIXEL.length,
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  });
  res.end(PIXEL);
});

/**
 * GET /t/click/:emailLogId?url= — Redirect to URL, mark link as clicked
 */
router.get('/click/:emailLogId', async (req, res) => {
  const { emailLogId } = req.params;
  const { url } = req.query;

  try {
    const emailLog = await prisma.emailLog.findUnique({ where: { id: emailLogId } });

    if (emailLog && !emailLog.clickedAt) {
      await prisma.emailLog.update({
        where: { id: emailLogId },
        data: { clickedAt: new Date(), status: 'clicked' },
      });

      const lead = await prisma.lead.findUnique({ where: { id: emailLog.leadId } });
      if (lead && ['contacted', 'opened'].includes(lead.stage)) {
        await prisma.lead.update({
          where: { id: lead.id },
          data: { stage: 'clicked' },
        });
      }
    }
  } catch (err) {
    console.error('Click tracking error:', err);
  }

  if (url && typeof url === 'string') {
    res.redirect(302, decodeURIComponent(url));
  } else {
    res.status(400).send('Missing URL');
  }
});

export default router;
