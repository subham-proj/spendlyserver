import mongoose, { Document, Schema } from "mongoose";

export interface IEmail extends Document {
  messageId: string;
  userId: string;
  subject: string;
  from: string;
  to: string;
  date: Date;
  body: string;
  labels: string[];
  raw: any;
  createdAt: Date;
  updatedAt: Date;
}

const emailSchema = new Schema<IEmail>(
  {
    messageId: {
      type: String,
      required: true,
      unique: true,
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
    date: {
      type: Date,
      default: Date.now,
    },
    body: {
      type: String,
      default: "",
    },
    labels: {
      type: [String],
      default: [],
    },
    raw: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  },
);

export const Email = mongoose.model<IEmail>("Email", emailSchema);
