import mongoose, { Document, Schema } from "mongoose";

export interface IUserPreferences {
  currency: string;
  notificationsEnabled: boolean;
  themeMode: string;
  expoPushToken: string | null;
}

export interface IUser extends Document {
  email: string;
  name: string | null;
  picture: string | null;
  preferences: IUserPreferences;
  accessToken: string | null;
  refreshToken: string | null;
  scope: string | null;
  refreshTokenExpiresIn: number | null;
  expiryDate: number | null;
  lastHistoryId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const userPreferencesSchema = new Schema<IUserPreferences>(
  {
    currency: { type: String, default: "INR" },
    notificationsEnabled: { type: Boolean, default: true },
    themeMode: { type: String, default: "system" },
    expoPushToken: { type: String, default: null },
  },
  { _id: false },
);

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: { type: String, default: null },
    picture: { type: String, default: null },
    preferences: {
      type: userPreferencesSchema,
      default: () => ({}),
    },
    accessToken: { type: String, default: null },
    refreshToken: { type: String, default: null },
    scope: { type: String, default: null },
    refreshTokenExpiresIn: { type: Number, default: null },
    expiryDate: { type: Number, default: null },
    lastHistoryId: { type: String, default: null },
  },
  { timestamps: true },
);

export const User = mongoose.model<IUser>("User", userSchema);
