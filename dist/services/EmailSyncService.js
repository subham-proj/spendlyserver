import { google } from "googleapis";
import { User } from "../models/userModels.js";
import { GmailSync } from "../models/gmailSyncModels.js";
import { EmailSyncHelpers } from "../utils/emailSyncHelpers.js";
import { DataProcessingPipeline } from "../utils/dataProcessingPipeline.js";
import { createLogger } from "../utils/logger.js";
const logger = createLogger("EmailSyncService");
const PRIMARY_INBOX_QUERY_SUFFIX = "in:inbox -category:promotions -category:social -category:forums";
const EXCLUDED_NON_PRIMARY_LABELS = new Set([
    "CATEGORY_PROMOTIONS",
    "CATEGORY_SOCIAL",
    "CATEGORY_FORUMS",
]);
export class EmailSyncService {
    constructor() {
        this.helpers = new EmailSyncHelpers();
        this.pipeline = new DataProcessingPipeline();
        this.googleClientId = process.env.CLIENT_ID;
        this.googleClientSecret = process.env.CLIENT_SECRET;
    }
    async sync(userId) {
        logger.info(`Sync requested for user ${userId}`);
        const syncRecord = await GmailSync.findOne({ userId });
        if (syncRecord?.lastHistoryId) {
            logger.info(`Existing sync record found for user ${userId}. lastHistoryId=${syncRecord.lastHistoryId}`);
            await this.incrementalSync(userId, syncRecord.lastHistoryId);
        }
        else {
            logger.info(`No previous sync found for user ${userId}, starting initial sync.`);
            await this.initialSync(userId);
        }
    }
    async initialSync(userId) {
        logger.info(`Starting initial sync for user ${userId}`);
        await GmailSync.findOneAndUpdate({ userId }, { status: "SYNCING" }, { upsert: true, new: true });
        try {
            const gmail = await this.getGmailClient(userId);
            const after = Math.floor(Date.now() / 1000) - 1 * 24 * 60 * 60; //Last 1 day sync
            const query = `after:${after} ${PRIMARY_INBOX_QUERY_SUFFIX}`;
            const messageIds = await this.helpers.getAllMessageIds(gmail, query);
            logger.info(`Found ${messageIds.length} primary-inbox message IDs for initial sync of user ${userId}`);
            const emails = await this.helpers.batchFetchEmails(gmail, messageIds);
            logger.info(`Retrieved ${emails.length} emails for user ${userId}`);
            await this.pipeline.processPipeline(userId, emails);
            logger.info(`Processed ${emails.length} emails for user ${userId}`);
            const historyId = await this.helpers.getLatestHistoryId(gmail);
            logger.info(`Latest historyId for user ${userId}: ${historyId}`);
            await GmailSync.findOneAndUpdate({ userId }, {
                status: "IDLE",
                lastSyncedAt: new Date(),
                lastHistoryId: historyId,
                totalFetched: messageIds.length,
            }, { upsert: true, new: true });
            logger.info(`Initial sync completed for user ${userId}`);
        }
        catch (err) {
            logger.error(`Initial sync failed for user ${userId}:`, err);
            await GmailSync.findOneAndUpdate({ userId }, {
                status: "FAILED",
                lastError: err.message,
            }, { upsert: true, new: true });
            throw err;
        }
    }
    async incrementalSync(userId, lastHistoryId) {
        logger.info(`Starting incremental sync for user ${userId} from history ${lastHistoryId}`);
        const gmail = await this.getGmailClient(userId);
        try {
            const historyRes = await gmail.users.history.list({
                userId: "me",
                startHistoryId: lastHistoryId,
                historyTypes: ["messageAdded"],
            });
            const history = historyRes.data.history || [];
            logger.info(`History response contains ${history.length} entries for user ${userId}`);
            if (!history.length) {
                return { synced: 0 };
            }
            const newMessageIds = history
                .flatMap((h) => h.messagesAdded || [])
                .map((m) => m.message.id)
                .filter(Boolean);
            logger.info(`Found ${newMessageIds.length} new message IDs for user ${userId}`);
            if (!newMessageIds.length)
                return { synced: 0 };
            const emails = await this.helpers.batchFetchEmails(gmail, newMessageIds);
            const primaryEmails = emails.filter((email) => this.isPrimaryInboxEmail(email.labelIds || []));
            logger.info(`Retrieved ${emails.length} incremental emails for user ${userId}; primary-inbox retained=${primaryEmails.length}`);
            await this.pipeline.processPipeline(userId, primaryEmails);
            logger.info(`Incremental pipeline completed for user ${userId}`);
            const newHistoryId = historyRes.data.historyId;
            await GmailSync.findOneAndUpdate({ userId }, {
                lastSyncedAt: new Date(),
                lastHistoryId: newHistoryId,
                status: "IDLE",
            }, { upsert: true, new: true });
            logger.info(`Incremental sync completed for user ${userId}. newHistoryId=${newHistoryId}`);
            return { synced: primaryEmails.length };
        }
        catch (err) {
            logger.error(`Incremental sync failed for user ${userId}:`, err);
            if (err.code === 410) {
                logger.warn(`History expired for user ${userId}; falling back to initial sync.`);
                await GmailSync.findOneAndUpdate({ userId }, {
                    lastHistoryId: null,
                    lastSyncedAt: null,
                }, { upsert: true, new: true });
                return await this.initialSync(userId);
            }
            throw err;
        }
    }
    async getGmailClient(userId) {
        logger.info(`Building Gmail client for user ${userId}`);
        const user = await User.findById(userId);
        if (!user) {
            logger.error(`User ${userId} not found`);
            throw new Error("User not found");
        }
        if (!user.accessToken) {
            logger.error(`User ${userId} has no access token`);
            throw new Error("User does not have a valid Google access token");
        }
        const auth = new google.auth.OAuth2(this.googleClientId, this.googleClientSecret);
        auth.setCredentials({
            access_token: user.accessToken,
            refresh_token: user.refreshToken || undefined,
        });
        const client = google.gmail({ version: "v1", auth });
        logger.info(`Gmail client ready for user ${userId}`);
        return client;
    }
    isPrimaryInboxEmail(labelIds) {
        if (!labelIds.includes("INBOX")) {
            return false;
        }
        return labelIds.every((label) => !EXCLUDED_NON_PRIMARY_LABELS.has(label));
    }
}
//# sourceMappingURL=EmailSyncService.js.map