import mongoose, { Schema } from "mongoose";
const transactionSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    messageId: {
        type: String,
        required: true,
        unique: true,
    },
    from: {
        type: String,
        required: true,
    },
    subject: {
        type: String,
        default: "",
    },
    emailDate: {
        type: Date,
        required: true,
    },
    amount: {
        type: Number,
        default: null,
    },
    currency: {
        type: String,
        default: "INR",
    },
    merchant: {
        type: String,
        default: null,
    },
    category: {
        type: String,
        enum: ["food", "shopping", "travel", "utilities", "entertainment", "health", "finance", "transfer", "other"],
        default: null,
    },
    transactionType: {
        type: String,
        enum: ["debit", "credit"],
        default: null,
    },
    rawSnippet: {
        type: String,
        default: "",
    },
    processedAt: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: true,
});
export const Transaction = mongoose.model("Transaction", transactionSchema);
//# sourceMappingURL=transactionModel.js.map