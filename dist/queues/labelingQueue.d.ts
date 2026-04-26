import { Queue } from "bullmq";
export interface LabelingJobData {
    emailId: string;
    messageId: string;
    userId: string;
    subject: string;
    from: string;
    date: string;
    body: string;
}
export declare const labelingQueue: Queue<LabelingJobData, any, string, LabelingJobData, any, string>;
export declare function enqueueLabelingJobs(jobs: LabelingJobData[]): Promise<void>;
//# sourceMappingURL=labelingQueue.d.ts.map