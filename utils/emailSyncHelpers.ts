import { createLogger } from "./logger.js";

const logger = createLogger("EmailSyncHelpers");

export class EmailSyncHelpers {
  // Get ALL message IDs (handles pagination via nextPageToken)
  async getAllMessageIds(gmail: any, query: string): Promise<string[]> {
    logger.info(`Fetching all message IDs with query: ${query}`);
    const ids: string[] = [];
    let pageToken: string | undefined;
    let page = 0;

    do {
      page += 1;
      const res = await gmail.users.messages.list({
        userId: "me",
        maxResults: 10, // setting up limit for the response
        q: query,
        pageToken,
      });

      const messages = res.data.messages || [];
      ids.push(...messages.map((m: any) => m.id));
      logger.debug(`Page ${page} returned ${messages.length} message IDs`);
      pageToken = res.data.nextPageToken;
    } while (pageToken);

    logger.info(`Total message IDs fetched: ${ids.length}`);
    return ids;
  }

  // Batch fetch full email content, 100 at a time
  async batchFetchEmails(gmail: any, messageIds: string[]) {
    logger.info(
      `Fetching emails in batches. totalMessageIds=${messageIds.length}`,
    );
    const BATCH_SIZE = 100;
    const results: any[] = [];

    for (let i = 0; i < messageIds.length; i += BATCH_SIZE) {
      const chunk = messageIds.slice(i, i + BATCH_SIZE);
      logger.debug(
        `Fetching batch ${Math.floor(i / BATCH_SIZE) + 1} with ${chunk.length} messages`,
      );

      const emails = await Promise.all(
        chunk.map((id) =>
          gmail.users.messages.get({ userId: "me", id, format: "full" }),
        ),
      );

      results.push(...emails.map((e: any) => e.data));
      logger.debug(
        `Batch ${Math.floor(i / BATCH_SIZE) + 1} fetched ${emails.length} emails`,
      );

      if (i + BATCH_SIZE < messageIds.length) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    logger.info(`Completed batch fetch; total emails=${results.length}`);
    return results;
  }

  async getLatestHistoryId(gmail: any): Promise<string> {
    logger.debug(`Fetching latest history ID from Gmail profile`);
    const profile = await gmail.users.getProfile({ userId: "me" });
    const historyId = profile.data.historyId;
    logger.debug(`Latest history ID is ${historyId}`);
    return historyId;
  }
}
