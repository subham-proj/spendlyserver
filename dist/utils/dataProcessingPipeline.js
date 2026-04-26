import { Email } from "../models/emailModels.js";
import { createLogger } from "./logger.js";
import { SenderFilter } from "./transactionExtractor.js";
import { enqueueLabelingJobs } from "../queues/labelingQueue.js";
const logger = createLogger("DataProcessingPipeline");
const senderFilter = new SenderFilter();
const extractBody = (payload) => {
    if (!payload)
        return "";
    if (payload.body?.data) {
        return Buffer.from(payload.body.data, "base64").toString("utf8");
    }
    if (payload.parts && Array.isArray(payload.parts)) {
        return payload.parts
            .map((part) => extractBody(part))
            .filter(Boolean)
            .join("\n");
    }
    return "";
};
export class DataProcessingPipeline {
    async processPipeline(userId, rawEmails) {
        logger.info(`Starting pipeline for user ${userId} with ${rawEmails.length} raw emails`);
        const parsed = this.parseEmails(rawEmails);
        logger.info(`Parsed ${parsed.length} emails for user ${userId}`);
        const candidates = this.senderPreFilter(parsed);
        logger.info(`Sender pre-filter for user ${userId}: ${candidates.length}/${parsed.length} passed`);
        if (candidates.length === 0) {
            logger.info(`No candidate emails for user ${userId}`);
            return;
        }
        // Store candidates — metadata always updated, labeling fields only written on first insert
        const operations = candidates.map((e) => ({
            updateOne: {
                filter: { messageId: e.id, userId },
                update: {
                    $set: {
                        subject: e.subject,
                        from: e.from,
                        to: e.to,
                        date: e.date,
                        labels: e.labels,
                    },
                    $setOnInsert: {
                        messageId: e.id,
                        userId,
                        labelingStatus: "pending",
                        transactionData: null,
                    },
                },
                upsert: true,
            },
        }));
        const result = await Email.bulkWrite(operations, { ordered: false });
        logger.info(`Bulk write for user ${userId}: inserted=${result.insertedCount}, upserted=${result.upsertedCount}`);
        // Only enqueue emails that are still pending — skip already-labeled ones
        const storedEmails = await Email.find({
            userId,
            messageId: { $in: candidates.map((e) => e.id) },
            labelingStatus: "pending",
        }, { _id: 1, messageId: 1 }).lean();
        const idByMessageId = new Map(storedEmails.map((e) => [e.messageId, e._id.toString()]));
        const labelingJobs = candidates
            .filter((e) => idByMessageId.has(e.id))
            .map((e) => ({
            emailId: idByMessageId.get(e.id),
            messageId: e.id,
            userId,
            subject: e.subject,
            from: e.from,
            date: e.date.toISOString(),
            body: e.body.slice(0, 800),
        }));
        enqueueLabelingJobs(labelingJobs).catch((err) => logger.error(`Failed to enqueue labeling jobs for user ${userId}:`, err));
    }
    parseEmails(emails) {
        return emails.map((msg) => {
            const headers = msg.payload?.headers || [];
            const get = (name) => headers.find((h) => h.name.toLowerCase() === name)?.value ?? "";
            return {
                id: msg.id,
                subject: get("subject"),
                from: get("from"),
                to: get("to"),
                date: new Date(get("date")),
                body: extractBody(msg.payload),
                labels: (msg.labelIds ?? []),
            };
        });
    }
    senderPreFilter(emails) {
        return emails.filter((e) => {
            if (e.labels.includes("SPAM") || e.labels.includes("DRAFT"))
                return false;
            const pass = senderFilter.isKnownSender(e.from);
            if (!pass)
                logger.debug(`Dropped (unknown sender): ${e.from}`);
            return pass;
        });
    }
}
//# sourceMappingURL=dataProcessingPipeline.js.map