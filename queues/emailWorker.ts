import { Worker } from "bullmq";
import mongoose from "mongoose";
import "colors";
import { Transaction } from "../models/transactionModel.js";
import { extractTransaction } from "../utils/transactionExtractor.js";
import type { EmailJobPayload } from "./emailQueue.js";

export const emailWorker = new Worker<EmailJobPayload>(
  "email-processing",
  async (job) => {
    const { messageId, userId, from, subject, snippet, emailDate } = job.data;
    console.log(`\n${"━".repeat(60)}`.cyan);
    console.log(`[EmailWorker] Job ${job.id} — ${subject}`.cyan.bold);
    console.log(`             from: ${from}`.cyan);

    const result = await extractTransaction(subject, from, snippet, emailDate);

    if (!result.isTransactional) {
      console.log(`[EmailWorker] ✗ Not transactional — skipping`.yellow);
      console.log(`${"━".repeat(60)}\n`.cyan);
      return;
    }

    // Upsert so Pub/Sub retries don't create duplicate transactions
    await Transaction.findOneAndUpdate(
      { messageId },
      {
        userId: new mongoose.Types.ObjectId(userId),
        messageId,
        from,
        subject,
        emailDate: new Date(emailDate),
        amount: result.amount,
        currency: result.currency ?? "INR",
        merchant: result.merchant,
        category: result.category,
        transactionType: result.transactionType,
        rawSnippet: snippet,
        processedAt: new Date(),
      },
      { upsert: true, new: true },
    );

    console.log(
      `[EmailWorker] ✓ Transaction saved`.green.bold,
      JSON.stringify({
        merchant: result.merchant,
        amount: `${result.currency} ${result.amount}`,
        type: result.transactionType,
        category: result.category,
      }),
    );
    console.log(`${"━".repeat(60)}\n`.cyan);
  },
  {
    connection: {
      url: process.env.REDIS_URL ?? "redis://localhost:6379",
    },
    concurrency: 5,
  },
);

emailWorker.on("failed", (job, err) => {
  console.error(`[EmailWorker] ✗ Job ${job?.id} failed:`.red.bold, err.message);
});

emailWorker.on("error", (err) => {
  console.error("[EmailWorker] Worker error:".red, err.message);
});

console.log("[EmailWorker] Worker started — listening for jobs".magenta.bold);
