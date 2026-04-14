import mongoose, { Document, Schema } from "mongoose";

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

const gmailSyncSchema = new Schema<IGmailSync>(
  {
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
  },
  {
    timestamps: true,
  },
);

export const GmailSync = mongoose.model<IGmailSync>(
  "GmailSync",
  gmailSyncSchema,
);
