export declare class EmailSyncHelpers {
    getAllMessageIds(gmail: any, query: string): Promise<string[]>;
    batchFetchEmails(gmail: any, messageIds: string[]): Promise<any[]>;
    getLatestHistoryId(gmail: any): Promise<string>;
}
//# sourceMappingURL=emailSyncHelpers.d.ts.map