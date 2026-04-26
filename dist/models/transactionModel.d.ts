import mongoose, { Document } from "mongoose";
export type TransactionCategory = "food" | "shopping" | "travel" | "utilities" | "entertainment" | "health" | "finance" | "transfer" | "other";
export type TransactionType = "debit" | "credit";
export interface ITransaction extends Document {
    userId: mongoose.Types.ObjectId;
    messageId: string;
    from: string;
    subject: string;
    emailDate: Date;
    amount: number | null;
    currency: string;
    merchant: string | null;
    category: TransactionCategory | null;
    transactionType: TransactionType | null;
    rawSnippet: string;
    processedAt: Date;
}
export declare const Transaction: mongoose.Model<ITransaction, {}, {}, {}, mongoose.Document<unknown, {}, ITransaction, {}, mongoose.DefaultSchemaOptions> & ITransaction & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, ITransaction>;
//# sourceMappingURL=transactionModel.d.ts.map