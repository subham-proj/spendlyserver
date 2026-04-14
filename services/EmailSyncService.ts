import { google } from "googleapis";
import { User } from "../models/userModels.js";
import { GmailSync } from "../models/gmailSyncModels.js";
import { EmailSyncHelpers } from "../utils/emailSyncHelpers.js";
import { DataProcessingPipeline } from "../utils/dataProcessingPipeline.js";

export class EmailSyncService {
  private helpers = new EmailSyncHelpers();
  private pipeline = new DataProcessingPipeline();
  private googleClientId = process.env.CLIENT_ID as string;
  private googleClientSecret = process.env.CLIENT_SECRET as string;

  async sync(userId: string) {
    console.log(`[EmailSyncService] Sync requested for user ${userId}`);
    const syncRecord = await GmailSync.findOne({ userId });

    if (syncRecord?.lastHistoryId) {
      console.log(
        `[EmailSyncService] Existing sync record found for user ${userId}. lastHistoryId=${syncRecord.lastHistoryId}`,
      );
      await this.incrementalSync(userId, syncRecord.lastHistoryId);
    } else {
      console.log(
        `[EmailSyncService] No previous sync found for user ${userId}, starting initial sync.`,
      );
      await this.initialSync(userId);
    }
  }

  async initialSync(userId: string) {
    console.log(`[EmailSyncService] Starting initial sync for user ${userId}`);
    await GmailSync.findOneAndUpdate(
      { userId },
      { status: "SYNCING" },
      { upsert: true, new: true },
    );

    try {
      const gmail = await this.getGmailClient(userId);
      const after = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60; // last 30 days

      const messageIds = await this.helpers.getAllMessageIds(
        gmail,
        `after:${after}`,
      );
      console.log(
        `[EmailSyncService] Found ${messageIds.length} message IDs for initial sync of user ${userId}`,
      );

      const emails = await this.helpers.batchFetchEmails(gmail, messageIds);
      console.log(
        `[EmailSyncService] Retrieved ${emails.length} emails for user ${userId}`,
      );

      await this.pipeline.processPipeline(userId, emails);
      console.log(
        `[EmailSyncService] Processed ${emails.length} emails for user ${userId}`,
      );

      const historyId = await this.helpers.getLatestHistoryId(gmail);
      console.log(
        `[EmailSyncService] Latest historyId for user ${userId}: ${historyId}`,
      );

      await GmailSync.findOneAndUpdate(
        { userId },
        {
          status: "IDLE",
          lastSyncedAt: new Date(),
          lastHistoryId: historyId,
          totalFetched: messageIds.length,
        },
        { upsert: true, new: true },
      );
      console.log(
        `[EmailSyncService] Initial sync completed for user ${userId}`,
      );
    } catch (err: any) {
      console.error(
        `[EmailSyncService] Initial sync failed for user ${userId}:`,
        err,
      );
      await GmailSync.findOneAndUpdate(
        { userId },
        {
          status: "FAILED",
          lastError: err.message,
        },
        { upsert: true, new: true },
      );
      throw err;
    }
  }

  async incrementalSync(userId: string, lastHistoryId: string) {
    console.log(
      `[EmailSyncService] Starting incremental sync for user ${userId} from history ${lastHistoryId}`,
    );
    const gmail = await this.getGmailClient(userId);

    try {
      const historyRes = await gmail.users.history.list({
        userId: "me",
        startHistoryId: lastHistoryId,
        historyTypes: ["messageAdded"],
      });

      const history = historyRes.data.history || [];
      console.log(
        `[EmailSyncService] History response contains ${history.length} entries for user ${userId}`,
      );

      if (!history.length) {
        return { synced: 0 };
      }

      const newMessageIds = history
        .flatMap((h: any) => h.messagesAdded || [])
        .map((m: any) => m.message.id)
        .filter(Boolean);

      console.log(
        `[EmailSyncService] Found ${newMessageIds.length} new message IDs for user ${userId}`,
      );
      if (!newMessageIds.length) return { synced: 0 };

      const emails = await this.helpers.batchFetchEmails(gmail, newMessageIds);
      console.log(
        `[EmailSyncService] Retrieved ${emails.length} incremental emails for user ${userId}`,
      );
      await this.pipeline.processPipeline(userId, emails);
      console.log(
        `[EmailSyncService] Incremental pipeline completed for user ${userId}`,
      );

      const newHistoryId = historyRes.data.historyId;
      await GmailSync.findOneAndUpdate(
        { userId },
        {
          lastSyncedAt: new Date(),
          lastHistoryId: newHistoryId,
          status: "IDLE",
        },
        { upsert: true, new: true },
      );

      console.log(
        `[EmailSyncService] Incremental sync completed for user ${userId}. newHistoryId=${newHistoryId}`,
      );
      return { synced: newMessageIds.length };
    } catch (err: any) {
      console.error(
        `[EmailSyncService] Incremental sync failed for user ${userId}:`,
        err,
      );
      if (err.code === 410) {
        console.warn(
          `[EmailSyncService] History expired for user ${userId}; falling back to initial sync.`,
        );
        await GmailSync.findOneAndUpdate(
          { userId },
          {
            lastHistoryId: null,
            lastSyncedAt: null,
          },
          { upsert: true, new: true },
        );
        return await this.initialSync(userId);
      }
      throw err;
    }
  }

  private async getGmailClient(userId: string) {
    console.log(`[EmailSyncService] Building Gmail client for user ${userId}`);
    const user = await User.findById(userId);
    if (!user) {
      console.error(`[EmailSyncService] User ${userId} not found`);
      throw new Error("User not found");
    }

    if (!user.accessToken) {
      console.error(`[EmailSyncService] User ${userId} has no access token`);
      throw new Error("User does not have a valid Google access token");
    }

    const auth = new google.auth.OAuth2(
      this.googleClientId,
      this.googleClientSecret,
    );
    auth.setCredentials({
      access_token: user.accessToken,
      refresh_token: user.refreshToken || undefined,
    });

    const client = google.gmail({ version: "v1", auth });
    console.log(`[EmailSyncService] Gmail client ready for user ${userId}`);
    return client;
  }
}
