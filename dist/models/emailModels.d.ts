import mongoose, { Document } from "mongoose";
export type LabelingStatus = "pending" | "labeled" | "not_transaction" | "failed";
export interface IEmail extends Document {
    messageId: string;
    userId: string;
    subject: string;
    from: string;
    to: string;
    date: Date;
    labels: string[];
    labelingStatus: LabelingStatus;
    transactionData: {
        amount: number;
        currency: string;
        type: "credit" | "debit";
        merchant: string;
        category: string;
        date: Date;
        description: string;
        confidence: number;
        source: string;
    } | null;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Email: mongoose.Model<IEmail, {}, {}, {}, mongoose.Document<unknown, {}, IEmail, {}, mongoose.DefaultSchemaOptions> & IEmail & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IEmail>;
//# sourceMappingURL=emailModels.d.ts.map