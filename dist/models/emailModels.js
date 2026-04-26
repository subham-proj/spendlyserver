import mongoose, { Schema } from "mongoose";
const transactionDataSchema = new Schema({
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    type: { type: String, enum: ["credit", "debit"], required: true },
    merchant: { type: String, default: "Unknown" },
    category: { type: String, default: "other" },
    date: { type: Date, required: true },
    description: { type: String, default: "" },
    confidence: { type: Number, default: 0 },
    source: { type: String, default: "" },
}, { _id: false });
const emailSchema = new Schema({
    messageId: {
        type: String,
        required: true,
    },
    userId: {
        type: String,
        required: true,
        index: true,
    },
    subject: {
        type: String,
        default: "",
    },
    from: {
        type: String,
        default: "",
    },
    to: {
        type: String,
        default: "",
    },
    labels: {
        type: [String],
        default: [],
    },
    labelingStatus: {
        type: String,
        enum: ["pending", "labeled", "not_transaction", "failed"],
        default: "pending",
    },
    transactionData: {
        type: transactionDataSchema,
        default: null,
    },
}, {
    timestamps: true,
});
emailSchema.index({ userId: 1, messageId: 1 }, { unique: true });
emailSchema.index({ userId: 1, labelingStatus: 1 });
emailSchema.index({
    userId: 1,
    "transactionData.date": -1,
    "transactionData.type": 1,
});
export const Email = mongoose.model("Email", emailSchema);
//# sourceMappingURL=emailModels.js.map