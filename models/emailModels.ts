import mongoose, { Document, Schema } from "mongoose";

export interface IEmail extends Document {
  messageId: string;
  userId: string;
  subject: string;
  from: string;
  to: string;
  date: Date;
  labels: string[];
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

const transactionDataSchema = new Schema(
  {
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    type: { type: String, enum: ["credit", "debit"], required: true },
    merchant: { type: String, default: "Unknown" },
    category: { type: String, default: "other" },
    date: { type: Date, required: true },
    description: { type: String, default: "" },
    confidence: { type: Number, default: 0 },
    source: { type: String, default: "" },
  },
  { _id: false },
);

const emailSchema = new Schema<IEmail>(
  {
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
    transactionData: {
      type: transactionDataSchema,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

emailSchema.index({ userId: 1, messageId: 1 }, { unique: true });

export const Email = mongoose.model<IEmail>("Email", emailSchema);
