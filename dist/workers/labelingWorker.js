import { Worker } from "bullmq";
import { redisConnection } from "../queues/connection.js";
import { extractTransaction } from "../utils/groqClient.js";
import { Email } from "../models/emailModels.js";
import { createLogger } from "../utils/logger.js";
const logger = createLogger("LabelingWorker");
export const labelingWorker = new Worker("email-labeling", async (job) => {
    const { emailId, subject, from, date, body } = job.data;
    const result = await extractTransaction({ from, subject, body });
    if (result.isTransaction) {
        await Email.updateOne({ _id: emailId }, {
            $set: {
                labelingStatus: "labeled",
                transactionData: {
                    amount: result.amount,
                    currency: "INR",
                    type: result.type,
                    merchant: result.merchant || "Unknown",
                    category: result.category,
                    date: new Date(date),
                    description: result.description || subject,
                    confidence: result.confidence,
                    source: from,
                },
            },
        });
        logger.info(`Labeled email ${emailId}: type=${result.type} category=${result.category} confidence=${result.confidence}`);
    }
    else {
        await Email.updateOne({ _id: emailId }, { $set: { labelingStatus: "not_transaction" } });
        logger.info(`Email ${emailId} marked not_transaction (isTransaction=${result.isTransaction}, confidence=${result.confidence})`);
    }
}, {
    connection: redisConnection,
    concurrency: 2,
    limiter: {
        max: 25,
        duration: 60000, // 25 jobs/min — safely under Groq's 30 req/min free-tier limit
    },
});
labelingWorker.on("ready", () => logger.info("Labeling worker ready and connected to Redis"));
labelingWorker.on("error", (err) => logger.error("Labeling worker error:", err));
labelingWorker.on("failed", async (job, err) => {
    logger.error(`Job ${job?.id} failed after ${job?.attemptsMade} attempts:`, err);
    if (job && job.attemptsMade >= (job.opts.attempts ?? 3)) {
        await Email.updateOne({ _id: job.data.emailId }, { $set: { labelingStatus: "failed" } }).catch((updateErr) => logger.error(`Failed to mark email ${job.data.emailId} as failed:`, updateErr));
    }
});
labelingWorker.on("completed", (job) => {
    logger.info(`Job ${job.id} completed`);
});
//# sourceMappingURL=labelingWorker.js.map