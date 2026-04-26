import mongoose, { Schema } from "mongoose";
const gmailSyncSchema = new Schema({
    userId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    status: {
        type: String,
        required: true,
        default: "IDLE",
    },
    lastHistoryId: {
        type: String,
        default: null,
    },
    lastSyncedAt: {
        type: Date,
        default: null,
    },
    totalFetched: {
        type: Number,
        default: 0,
    },
    lastError: {
        type: String,
        default: null,
    },
}, {
    timestamps: true,
});
export const GmailSync = mongoose.model("GmailSync", gmailSyncSchema);
//# sourceMappingURL=gmailSyncModels.js.map