import { Queue } from "bullmq";

export interface EmailJobPayload {
  messageId: string;
  userId: string;
  from: string;
  subject: string;
  snippet: string;
  emailDate: string; // ISO-8601 string
}

export const emailQueue = new Queue<EmailJobPayload>("email-processing", {
  connection: {
    url: process.env.REDIS_URL ?? "redis://localhost:6379",
  },
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "fixed", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});
