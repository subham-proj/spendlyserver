import { Queue } from "bullmq";
import { redisConnection } from "./connection.js";
import { createLogger } from "../utils/logger.js";
const logger = createLogger("LabelingQueue");
export const labelingQueue = new Queue("email-labeling", {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
    },
});
export async function enqueueLabelingJobs(jobs) {
    if (!jobs.length)
        return;
    await labelingQueue.addBulk(jobs.map((data) => ({
        name: "label-transaction",
        data,
        opts: {
            jobId: data.messageId, // deduplication: same email never double-labeled
        },
    })));
    logger.info(`Enqueued ${jobs.length} labeling jobs`);
}
//# sourceMappingURL=labelingQueue.js.map