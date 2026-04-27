import mongoose, { Document, Schema } from "mongoose";

export type TransactionCategory =
  | "food"
  | "shopping"
  | "travel"
  | "utilities"
  | "entertainment"
  | "health"
  | "finance"
  | "transfer"
  | "other";

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
  shortName: string | null;
  category: TransactionCategory | null;
  transactionType: TransactionType | null;
  rawSnippet: string;
  processedAt: Date;
}

const transactionSchema = new Schema<ITransaction>(
  {
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
    shortName: {
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
  },
  {
    timestamps: true,
  },
);

// Composite indexes for efficient paginated queries
transactionSchema.index({ userId: 1, emailDate: -1, _id: -1 }); // default sort (newest first)
transactionSchema.index({ userId: 1, amount: -1, _id: -1 });    // amount sort

export const Transaction = mongoose.model<ITransaction>("Transaction", transactionSchema);
