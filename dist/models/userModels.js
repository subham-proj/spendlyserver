import mongoose, { Schema } from "mongoose";
const userPreferencesSchema = new Schema({
    currency: { type: String, default: "INR" },
    notificationsEnabled: { type: Boolean, default: true },
    themeMode: { type: String, default: "system" },
    expoPushToken: { type: String, default: null },
}, { _id: false });
const userSchema = new Schema({
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
}, { timestamps: true });
export const User = mongoose.model("User", userSchema);
//# sourceMappingURL=userModels.js.map