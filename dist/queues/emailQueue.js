import { Queue } from "bullmq";
export const emailQueue = new Queue("email-processing", {
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
//# sourceMappingURL=emailQueue.js.map