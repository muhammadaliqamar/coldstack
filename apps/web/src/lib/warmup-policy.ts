// Warmup Policy Constants — derived from policy.txt

export const WEEK_SCHEDULE = [
  { week: 1, goal: 'Establish sending pattern', daily: 2, internal: 2, gmail: 0, outlook: 0, real: 0, targetScore: 20, scoreRange: '0-20' },
  { week: 2, goal: 'Introduce external seeds', daily: 5, internal: 3, gmail: 2, outlook: 0, real: 0, targetScore: 35, scoreRange: '20-35' },
  { week: 3, goal: 'Build momentum', daily: 10, internal: 4, gmail: 4, outlook: 2, real: 0, targetScore: 50, scoreRange: '35-50' },
  { week: 4, goal: 'Approach ready zone', daily: 20, internal: 6, gmail: 8, outlook: 4, real: 2, targetScore: 70, scoreRange: '60-70' },
  { week: 5, goal: 'Hit ready threshold', daily: 30, internal: 8, gmail: 12, outlook: 6, real: 4, targetScore: 85, scoreRange: '75-85' },
  { week: 6, goal: 'Full warmup complete', daily: 30, internal: 10, gmail: 10, outlook: 6, real: 4, targetScore: 100, scoreRange: '85-100' },
];

export const NEVER_RULES = [
  'Send same template twice in a row',
  'Send all emails at exact same time',
  'Skip weekends completely (send 1-2)',
  'Jump volume by more than 5/day',
  'Start real outreach before score hits 80',
  'Stop warmup completely (keep 10/day always)',
  'Use same subject line twice in same week',
  'Send during Friday prayer time (12-2 PM GST)',
];

export const ALWAYS_RULES = [
  'Randomize send times',
  'Reply to warmup emails within 2-8 hours',
  'Keep bounce rate below 2%',
  'Monitor spam placement weekly',
  'Log everything to database',
  'Keep warmup running alongside campaigns',
];

export const SPLIT_COLORS = {
  internal: { bg: 'bg-blue-500', text: 'text-blue-500', label: 'Internal' },
  gmail: { bg: 'bg-red-500', text: 'text-red-500', label: 'Gmail Seeds' },
  outlook: { bg: 'bg-orange-500', text: 'text-orange-500', label: 'Outlook Seeds' },
  real: { bg: 'bg-emerald-500', text: 'text-emerald-500', label: 'Real Contacts' },
};
