import { Queue, Worker, QueueEvents, JobsOptions, Processor } from 'bullmq';
import IORedis from 'ioredis';

// ─── Redis Connection ───────────────────────────────────

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const createRedisConnection = () => {
  return new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
  });
};

// ─── Queue Names ────────────────────────────────────────

export const QUEUE_NAMES = {
  WARMUP_SEND: 'warmup-send',
  CAMPAIGN_SCHEDULE: 'campaign-schedule',
  EMAIL_SEND: 'email-send',
  BOUNCE_PROCESSOR: 'bounce-processor',
  REPLY_DETECTOR: 'reply-detector',
  ANALYTICS_ROLLUP: 'analytics-rollup',
  AUTO_READ_WARMUP: 'auto-read-warmup',
  AUTO_REPLY_WARMUP: 'auto-reply-warmup',
} as const;

// ─── Default Job Options ────────────────────────────────

export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
  removeOnComplete: {
    count: 1000,
    age: 24 * 3600, // 24 hours
  },
  removeOnFail: {
    count: 5000,
  },
};

// ─── Queue Factory ──────────────────────────────────────

export const createQueue = (name: string) => {
  return new Queue(name, {
    connection: createRedisConnection(),
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  });
};

// ─── Worker Factory ─────────────────────────────────────

export const createWorker = (
  name: string,
  processor: Processor,
  concurrency = 5
) => {
  return new Worker(name, processor, {
    connection: createRedisConnection(),
    concurrency,
  });
};

// ─── Queue Events Factory ───────────────────────────────

export const createQueueEvents = (name: string) => {
  return new QueueEvents(name, {
    connection: createRedisConnection(),
  });
};

// ─── Pre-built Queue Instances ──────────────────────────

export const warmupQueue = createQueue(QUEUE_NAMES.WARMUP_SEND);
export const campaignScheduleQueue = createQueue(QUEUE_NAMES.CAMPAIGN_SCHEDULE);
export const emailSendQueue = createQueue(QUEUE_NAMES.EMAIL_SEND);
export const bounceProcessorQueue = createQueue(QUEUE_NAMES.BOUNCE_PROCESSOR);
export const replyDetectorQueue = createQueue(QUEUE_NAMES.REPLY_DETECTOR);
export const analyticsRollupQueue = createQueue(QUEUE_NAMES.ANALYTICS_ROLLUP);
export const autoReadWarmupQueue = createQueue(QUEUE_NAMES.AUTO_READ_WARMUP);
export const autoReplyWarmupQueue = createQueue(QUEUE_NAMES.AUTO_REPLY_WARMUP);

// ─── Job Data Types ─────────────────────────────────────

export interface WarmupSendJobData {
  inboxId: string;
}

export interface AutoReadJobData {
  recipientEmail: string;
  senderEmail: string;
  subject: string;
}

export interface AutoReplyJobData {
  recipientEmail: string; // The seed/inbox that is replying
  senderEmail: string;    // The original sender
  subject: string;
  messageId: string;      // Used for threading
}

export interface CampaignScheduleJobData {
  campaignId: string;
}

export interface EmailSendJobData {
  leadId: string;
  sequenceId: string;
  inboxId: string;
}

export interface BounceProcessorJobData {
  emailLogId: string;
  bounceType: string;
  bounceMessage: string;
}

export interface ReplyDetectorJobData {
  inboxId: string;
}

export interface AnalyticsRollupJobData {
  timestamp: string;
}

export { Queue, Worker, QueueEvents } from 'bullmq';
