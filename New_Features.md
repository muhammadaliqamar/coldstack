Feature 1:
Build a lead list management system with built-in email verification:


Implement:

1. **Lead List Manager**:
   - Import sources: CSV upload, manual entry, Google Sheets sync, API import
   - CSV parser using Papa Parse with smart column mapping:
     - Auto-detect columns: match "First Name", "first_name", "firstName", "fname" → first_name field
     - Support columns: email (required), first_name, last_name, company, job_title, phone, city, country, custom_1 through custom_5
     - Preview first 10 rows before import, let user remap columns
     - Duplicate detection: skip rows where email already exists in the list (case-insensitive)
   - List segmentation with filter builder:
     - Filter by any field: equals, contains, starts with, ends with, is empty, is not empty
     - Compound filters: AND/OR groups (e.g., company contains "tech" AND country = "US")
     - Save segments as reusable lists for campaigns
   - Store leads in `contacts` table: id, user_id, email, first_name, last_name, company, job_title, phone, city, country, custom_fields (JSONB), verification_status, tags (text[]), source, created_at, updated_at
   - Store lists in `contact_lists` table: id, user_id, name, filter_query (JSONB), contact_count, created_at

2. **Email Verification Engine**:
   - 4-step verification pipeline for each email address:
     Step 1 - Syntax Check: validate email format via regex, reject obviously invalid patterns
     Step 2 - Domain Check: DNS MX record lookup using dns.resolve(), reject domains with no MX records
     Step 3 - Disposable Detection: check against a 10,000+ disposable email domain list (mailinator, guerrillamail, etc.), flag as risky
     Step 4 - SMTP Verification: connect to the MX server, issue MAIL FROM and RCPT TO commands, check if the server accepts or rejects the recipient (do NOT send any actual email)
   - Verification results: 'valid', 'invalid', 'risky' (catch-all domain), 'unknown' (server timeout)
   - Bulk verification: process up to 1000 emails in a batch with concurrency limit of 10 parallel checks
   - Rate limiting: max 100 verifications per minute per MX server to avoid being blocked
   - Store results in `email_verifications` table: id, contact_id, email, status, mx_host, smtp_response_code, checked_at, expires_at (re-verify after 30 days)
   - Auto-verify on import: all new contacts are queued for verification immediately

3. **Suppression List Manager**:
   - Global suppression list: emails that should never be contacted
   - Sources: manual add, bounce handler (auto-add hard bounces), unsubscribe webhook, complaint reports
   - Check every outgoing email against suppression list before sending (hard block, no override)
   - Import/export suppression list as CSV
   - Suppression audit log: who added, when, why (bounce, complaint, manual, unsubscribe)
   - Store in `suppression_list` table: id, user_id, email, reason ('bounce'|'complaint'|'unsubscribe'|'manual'), source_campaign_id, added_at

4. **Lead List UI** :
   - Table view with sortable columns, inline edit, bulk select with checkbox column
   - Verification status badges: green checkmark (valid), red X (invalid), yellow warning (risky), gray clock (pending)
   - "Verify All" button for batch verification with progress bar
   - Tag management: add/remove tags with color coding, filter by tags
   - Import wizard: upload CSV → column mapping → preview → duplicate check → import with progress
   - Contact detail drawer: click a row to see full contact details, email history, verification details


Feature 2(MUST Be Implemented at Any cost (hard-coded)):

Before Warmup Starts — DNS Must Be Perfect
✅ SPF Record:
✅ DKIM:
✅ DMARC:
✅ MX Records:


Without these = warmup is completely wasted
Do NOT send single email before these are green

Week 1 - (Day 1-7)

Goal:        Just establish sending pattern
Volume:      2 emails/inbox/day
Total/day:   6 emails
Who:         Only between your 3 inboxes

Day 1:
ahmed@ → sends to → ali@, sara@
ali@   → reads + replies to → ahmed@
sara@  → reads + replies to → ahmed@

Day 2:
ali@   → sends to → ahmed@, sara@
ahmed@ → reads + replies to → ali@
sara@  → reads + replies to → ali@

Day 3:
sara@  → sends to → ahmed@, ali@
ahmed@ → reads + replies to → sara@
ali@   → reads + replies to → sara@

Rotate this pattern daily


1. Send email via SMTP
2. Wait 5 Min-30 Min (random delay)
3. Read via IMAP
4. Mark as READ (simulates open)
5. Wait 5min-20min (simulates human reading)
6. Reply with natural response
7. Log everything to database


Week 2 (Day 8- 14)

Goal:        Introduce external seed accounts
Volume:      5 emails/inbox/day
Total/day:   15 emails

Split:
├── 3 emails/inbox → between your 3 inboxes
└── 2 emails/inbox → External Gmail seeds

External seed accounts ((User will add these via settings or create a seprate seeding UI)):
seed1@gmail.com  ← personal Gmail accounts
seed2@gmail.com     
seed3@gmail.com

These external seeds:
→ Receive  warmup emails
→ Open them (via Gmail IMAP)
→ Reply back naturally via Gmail SMTP
→ This is GOLD for reputation ✅


Week 3 (Day 15 - 21): 
Goal:        Build momentum
Volume:      10 emails/inbox/day
Total/day:   30 emails

Split:
├── 4 emails/inbox → internal (your 3 inboxes)
├── 4 emails/inbox → Gmail seeds
└── 2 emails/inbox → Outlook seeds

Add Outlook seed accounts (User will add these via settings or create a seprate seeding UI):
seed1@outlook.com
seed2@outlook.com
seed3@outlook.com

Why Outlook too?
→ Many Gulf businesses use Outlook/Office365
→ Builds reputation with Microsoft mail servers
→ Diversifies your sender reputation ✅



Week 4 (Day 22- 28):
Goal:        Approach ready zone
Volume:      20-30 emails/inbox/day (random Increase)
Total/day:   60-90 emails (Random Icnrease)

Split:
├── 6 emails/inbox  → internal
├── 8 emails/inbox  → Gmail seeds
├── 4 emails/inbox  → Outlook seeds
└── 2 emails/inbox  → real contacts User know
                      (friends, colleagues, family)
                      Ask them to open + reply

Warmup Score target: 60-70/100


Day 29-30

Goal:        Full warmup complete
Volume:      30 emails/inbox/day
Total/day:   90 emails

Warmup Score target: 85-100/100

✅ Inboxes marked READY
✅ Start real outreach at 15-20/inbox/day
✅ Keep warmup running in background (10/inbox/day)


Rule: 
❌ NEVER send same template twice in a row
❌ NEVER send all emails at exact same time
❌ NEVER skip weekends completely (send 1-2)
❌ NEVER jump volume by more than 5/day
❌ NEVER start real outreach before score hits 80
❌ NEVER stop warmup completely (keep 10/day always)
❌ NEVER use same subject line twice in same week
❌ NEVER send during Friday prayer time (12-2 PM GST) if lead is GCC/Pakistan Based

✅ ALWAYS randomize send times
✅ ALWAYS reply to warmup emails within 5 min-30 Min
✅ ALWAYS keep bounce rate below 2%
✅ ALWAYS monitor spam placement weekly
✅ ALWAYS log everything to database
✅ ALWAYS keep warmup running alongside campaigns



Feature 3:

Build a drag-and-drop email template builder with advanced personalization:


Implement:

1. **Template Builder** (This must be implemented at anycost a drag and drop template builder for campaign):
   - Drag-and-drop block editor using @dnd-kit with these block types:
     - Header: logo + preheader text
     - Text: rich text with inline formatting (bold, italic, links, colors)
     - Image: upload or URL with alt text, width control, alignment
     - Button: CTA with customizable text, color, border radius, URL
     - Divider: horizontal rule with color and thickness
     - Columns: 2-column and 3-column layouts with adjustable widths
     - Social Icons: row of social media icon links
     - Footer: unsubscribe link, physical address (CAN-SPAM compliant)
   - Per-block settings panel: padding, background color, border, max-width
   - Global settings: font family (web-safe only: Arial, Georgia, Verdana, Trebuchet), background color, content width (600px default)
   - Real-time preview panel showing rendered email alongside the builder
   - Mobile preview toggle: simulate 375px viewport width
   - HTML export: generate clean, table-based HTML that renders in Gmail, Outlook, Apple Mail, Yahoo (test with Litmus-compatible inline CSS)

2. **Personalization Engine**:
   - Variable system with these built-in merge tags:
     - {{first_name}}, {{last_name}}, {{email}}, {{company}}, {{job_title}}, {{city}}, {{country}}
     - {{unsubscribe_url}}, {{view_in_browser_url}}, {{current_date}}, {{current_year}}
   - Custom field support: users define custom variables (e.g., {{plan_name}}, {{renewal_date}})
   - Conditional blocks: `{{#if company}}Hi {{first_name}} at {{company}}{{else}}Hi {{first_name}}{{/if}}`
   - Fallback values: `{{first_name|"there"}}` renders "there" if first_name is empty
   - Spintax support: `{Hey|Hi|Hello} {{first_name}}` randomly selects one variation per recipient
   - Render function: accept template HTML + recipient data object, return personalized HTML string
   - Validation: scan template for unresolved variables before sending, flag missing data per recipient


Feature 4: 
1. **Engagement Tracker**
   - Open tracking: embed a 1x1 transparent tracking pixel in email HTML, log open events with timestamp, IP, user agent
   - Click tracking: rewrite all links in email to go through your tracking redirect (e.g., /api/track/click?id=X&url=Y), log click events with link URL, timestamp
   - Reply detection: monitor inbox for replies using IMAP polling every 2 minutes, match reply to sent email via In-Reply-To header or subject line matching
   - Store events in `engagement_events` table: id, enrollment_id, contact_id, email_node_id, event_type ('open'|'click'|'reply'|'bounce'|'unsubscribe'), event_data (JSONB), created_at
   - De-duplication: count only first open per email (not repeat opens), but track total opens separately


Feature 5: Lead Nurturing Sequence

As the emails are out check for stats hourly basis and update the database with latest stats

1. **Lead Nurturing Engine**:
   - When a contact opens an email OR clicks a link OR replies, start nurture sequence automatically
   - Show nurturing status on the campaign detail page: "Warm (Replied)", "Warm (Clicked)", "Cold (No action)"
   - Do NOT send further emails to contacts who have replied (they're engaged!)
   - Do NOT send further emails to contacts who have unsubscribed or marked as spam
   - Show "Last Contacted: [date]" and "Next Action: [in 2 days]" on contact detail view

2. **Lead Followup Sequence**:
   - Initiate the Followup sequence to contact list on which campaign is genereted and it run for 30 days a proper followup sequence.
   - send followup emails, casestudies, education marterial so lead atleast reply to us
   - when a positive reply receives the system automatically creates a new contact list named (Warm Leads - XXX) and add these to it and on pipeline it shows how many are warm , cold, etc
   - The warm lead sequence initiate and makes them to convert them into meeting/book a call when this happen send it to qualified. and creates another list (Qualified Leads - XXX)

   - XXX stand for the contact list we uses for campaign or named the XXX as campain name
















   - Create qualification criteria based on engagement:
     - Hot: replied + clicked link
     - Warm: clicked link or replied
     - Neutral: opened email
     - Cold: no action
   - Score contacts from 0-100 based on actions:
     - Reply: +50 points
     - Click: +20 points
     - Open: +10 points
     - No action: 0 points
   - Qualification threshold: 70 points = "Qualified", 50-69 = "Warm", below 50 = "Cold"
   - Tag contacts with qualification level: "qualified", "warm", "cold"
   - Show qualification badge on contact detail view
   - Export qualified leads to CSV for sales team
   - Integrate with CRM (future feature)