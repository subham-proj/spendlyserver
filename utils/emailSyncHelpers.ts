export class EmailSyncHelpers {
  // Get ALL message IDs (handles pagination via nextPageToken)
  async getAllMessageIds(gmail: any, query: string): Promise<string[]> {
    console.log(
      `[EmailSyncHelpers] Fetching all message IDs with query: ${query}`,
    );
    const ids: string[] = [];
    let pageToken: string | undefined;
    let page = 0;

    do {
      page += 1;
      const res = await gmail.users.messages.list({
        userId: "me",
        maxResults: 10,
        q: query,
        pageToken,
      });

      const messages = res.data.messages || [];
      ids.push(...messages.map((m: any) => m.id));
      console.log(
        `[EmailSyncHelpers] Page ${page} returned ${messages.length} message IDs`,
      );
      pageToken = res.data.nextPageToken;
    } while (pageToken);

    console.log(`[EmailSyncHelpers] Total message IDs fetched: ${ids.length}`);
    return ids;
  }

  // Batch fetch full email content, 100 at a time
  async batchFetchEmails(gmail: any, messageIds: string[]) {
    console.log(
      `[EmailSyncHelpers] Fetching emails in batches. totalMessageIds=${messageIds.length}`,
    );
    const BATCH_SIZE = 100;
    const results: any[] = [];

    for (let i = 0; i < messageIds.length; i += BATCH_SIZE) {
      const chunk = messageIds.slice(i, i + BATCH_SIZE);
      console.log(
        `[EmailSyncHelpers] Fetching batch ${Math.floor(i / BATCH_SIZE) + 1} with ${chunk.length} messages`,
      );

      const emails = await Promise.all(
        chunk.map((id) =>
          gmail.users.messages.get({ userId: "me", id, format: "full" }),
        ),
      );

      results.push(...emails.map((e: any) => e.data));
      console.log(
        `[EmailSyncHelpers] Batch ${Math.floor(i / BATCH_SIZE) + 1} fetched ${emails.length} emails`,
      );

      if (i + BATCH_SIZE < messageIds.length) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    console.log(
      `[EmailSyncHelpers] Completed batch fetch; total emails=${results.length}`,
    );
    return results;
  }

  async getLatestHistoryId(gmail: any): Promise<string> {
    console.log(
      `[EmailSyncHelpers] Fetching latest history ID from Gmail profile`,
    );
    const profile = await gmail.users.getProfile({ userId: "me" });
    const historyId = profile.data.historyId;
    console.log(`[EmailSyncHelpers] Latest history ID is ${historyId}`);
    return historyId;
  }
}
