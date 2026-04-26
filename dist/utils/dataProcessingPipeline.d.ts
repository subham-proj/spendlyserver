export declare class DataProcessingPipeline {
    processPipeline(userId: string, rawEmails: any[]): Promise<void>;
    parseEmails(emails: any[]): {
        id: string;
        subject: any;
        from: any;
        to: any;
        date: Date;
        body: string;
        labels: string[];
    }[];
    senderPreFilter(emails: ReturnType<DataProcessingPipeline["parseEmails"]>): {
        id: string;
        subject: any;
        from: any;
        to: any;
        date: Date;
        body: string;
        labels: string[];
    }[];
}
//# sourceMappingURL=dataProcessingPipeline.d.ts.map