import { prisma } from '@coldstack/db';

/**
 * Evaluates lead engagement score and creates segmented contact lists (Warm/Qualified) based on responses.
 * Reply = +50 points
 * Click = +20 points
 * Open = +10 points
 */
export async function assessLeadEngagement(leadId: string) {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: { contact: true, campaign: true },
    });

    if (!lead) return;

    // Fetch all logs to check engagement metrics
    const logs = await prisma.emailLog.findMany({
      where: { leadId },
    });

    let score = 0;
    let hasReply = false;
    let hasClick = false;
    let hasOpen = false;

    for (const log of logs) {
      if (log.status === 'replied' || log.repliedAt) hasReply = true;
      if (log.status === 'clicked' || log.clickedAt) hasClick = true;
      if (log.status === 'opened' || log.openedAt) hasOpen = true;
    }

    if (hasReply) {
      score += 50;
      // Auto transition to replied in funnel if appropriate
      if (lead.stage !== 'replied' && lead.stage !== 'converted') {
        await prisma.lead.update({
          where: { id: leadId },
          data: { stage: 'replied', funnelStage: 'bofu' },
        });
      }
    }
    if (hasClick) score += 20;
    if (hasOpen) score += 10;

    // Qualification grading
    let qualification: 'qualified' | 'warm' | 'cold' = 'cold';
    if (score >= 70) {
      qualification = 'qualified';
    } else if (score >= 50) {
      qualification = 'warm';
    }

    // Persist to Contact customFields JSONB
    const currentCustomFields = (lead.contact.customFields as any) || {};
    const updatedCustomFields = {
      ...currentCustomFields,
      engagementScore: score,
      qualification,
      lastContacted: lead.lastContactedAt ? lead.lastContactedAt.toISOString() : new Date().toISOString(),
      nextAction: lead.nextFollowUpAt ? lead.nextFollowUpAt.toISOString() : undefined,
    };

    await prisma.contact.update({
      where: { id: lead.contactId },
      data: {
        customFields: updatedCustomFields,
        status: hasReply ? 'replied' : lead.contact.status,
      },
    });

    // Segment warm or qualified leads into new contact lists
    const campaignName = lead.campaign.name || 'Outreach';

    if (hasReply || score >= 50) {
      const listName = score >= 70 
        ? `Qualified Leads - ${campaignName}`
        : `Warm Leads - ${campaignName}`;

      let targetList = await prisma.emailList.findFirst({
        where: { name: listName, userId: lead.campaign.userId },
      });

      if (!targetList) {
        targetList = await prisma.emailList.create({
          data: {
            name: listName,
            fileName: 'Auto-Segmented Engagement',
            userId: lead.campaign.userId,
            totalContacts: 0,
          },
        });
      }

      // Check if contact already duplicated into that segmented list
      const existingContact = await prisma.contact.findFirst({
        where: { listId: targetList.id, email: lead.contact.email },
      });

      if (!existingContact) {
        await prisma.contact.create({
          data: {
            listId: targetList.id,
            email: lead.contact.email,
            firstName: lead.contact.firstName,
            lastName: lead.contact.lastName,
            company: lead.contact.company,
            title: lead.contact.title,
            phone: lead.contact.phone,
            status: hasReply ? 'replied' : 'contacted',
            verificationStatus: 'verified',
            customFields: updatedCustomFields,
          },
        });

        // Update list counts
        const totalContacts = await prisma.contact.count({ where: { listId: targetList.id } });
        await prisma.emailList.update({
          where: { id: targetList.id },
          data: { totalContacts },
        });
      }
    }
  } catch (error) {
    console.error('[Engagement] Error during assessment for lead:', leadId, error);
  }
}
