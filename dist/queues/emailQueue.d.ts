import { Queue } from "bullmq";
export interface EmailJobPayload {
    messageId: string;
    userId: string;
    from: string;
    subject: string;
    snippet: string;
    emailDate: string;
}
export declare const emailQueue: Queue<EmailJobPayload, any, string, EmailJobPayload, any, string>;
//# sourceMappingURL=emailQueue.d.ts.map