export declare class EmailSyncService {
    private helpers;
    private pipeline;
    private googleClientId;
    private googleClientSecret;
    sync(userId: string): Promise<void>;
    initialSync(userId: string): Promise<void>;
    incrementalSync(userId: string, lastHistoryId: string): Promise<void | {
        synced: number;
    }>;
    private getGmailClient;
    private isPrimaryInboxEmail;
}
//# sourceMappingURL=EmailSyncService.d.ts.map