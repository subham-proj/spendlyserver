import { Worker } from "bullmq";
import mongoose from "mongoose";
import "colors";
import { Transaction } from "../models/transactionModel.js";
import { User } from "../models/userModels.js";
import { extractTransaction } from "../utils/transactionExtractor.js";
async function sendExpoPushNotification(pushToken, title, body, data) {
    try {
        await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                "Accept-Encoding": "gzip, deflate",
            },
            body: JSON.stringify({ to: pushToken, title, body, data, sound: "default" }),
        });
    }
    catch (err) {
        console.warn("[EmailWorker] Push notification failed:", err.message);
    }
}
export const emailWorker = new Worker("email-processing", async (job) => {
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
    const transaction = await Transaction.findOneAndUpdate({ messageId }, {
        userId: new mongoose.Types.ObjectId(userId),
        messageId,
        from,
        subject,
        emailDate: new Date(emailDate),
        amount: result.amount,
        currency: result.currency ?? "INR",
        merchant: result.merchant,
        shortName: result.shortName,
        category: result.category,
        transactionType: result.transactionType,
        rawSnippet: snippet,
        processedAt: new Date(),
    }, { upsert: true, new: true });
    console.log(`[EmailWorker] ✓ Transaction saved`.green.bold, JSON.stringify({
        merchant: result.merchant,
        amount: `${result.currency} ${result.amount}`,
        type: result.transactionType,
        category: result.category,
    }));
    // Fire-and-forget push notification if user has it enabled
    if (result.amount !== null) {
        const user = await User.findById(userId).select("preferences").lean();
        const prefs = user?.preferences;
        if (prefs?.notificationsEnabled && prefs.expoPushToken) {
            const currency = result.currency ?? "INR";
            const merchant = result.shortName ?? result.merchant ?? "Unknown merchant";
            const typeLabel = result.transactionType === "credit" ? "received" : "spent";
            const notifBody = `${merchant} • ${currency} ${result.amount} ${typeLabel}`;
            sendExpoPushNotification(prefs.expoPushToken, "New Transaction Detected", notifBody, { transactionId: String(transaction._id) });
        }
    }
    console.log(`${"━".repeat(60)}\n`.cyan);
}, {
    connection: {
        url: process.env.REDIS_URL ?? "redis://localhost:6379",
    },
    concurrency: 5,
});
emailWorker.on("failed", (job, err) => {
    console.error(`[EmailWorker] ✗ Job ${job?.id} failed:`.red.bold, err.message);
});
emailWorker.on("error", (err) => {
    console.error("[EmailWorker] Worker error:".red, err.message);
});
console.log("[EmailWorker] Worker started — listening for jobs".magenta.bold);
//# sourceMappingURL=emailWorker.js.map