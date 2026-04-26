import mongoose, { Document } from "mongoose";
export interface IGmailSync extends Document {
    userId: string;
    status: string;
    lastHistoryId: string | null;
    lastSyncedAt: Date | null;
    totalFetched: number;
    lastError: string | null;
    createdAt: Date;
    updatedAt: Date;
}
export declare const GmailSync: mongoose.Model<IGmailSync, {}, {}, {}, mongoose.Document<unknown, {}, IGmailSync, {}, mongoose.DefaultSchemaOptions> & IGmailSync & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IGmailSync>;
//# sourceMappingURL=gmailSyncModels.d.ts.map