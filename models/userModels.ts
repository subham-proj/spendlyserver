import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
  email: string;
  accessToken: string | null;
  refreshToken: string | null;
  scope: string | null;
  refreshTokenExpiresIn: number | null;
  expiryDate: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    accessToken: {
      type: String,
      default: null,
    },
    refreshToken: {
      type: String,
      default: null,
    },
    scope: {
      type: String,
      default: null,
    },
    refreshTokenExpiresIn: {
      type: Number,
      default: null,
    },
    expiryDate: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

export const User = mongoose.model<IUser>("User", userSchema);
