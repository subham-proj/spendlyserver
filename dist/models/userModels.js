import mongoose, { Schema } from "mongoose";
const userSchema = new Schema({
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
    lastHistoryId: {
        type: String,
        default: null,
    },
}, {
    timestamps: true,
});
export const User = mongoose.model("User", userSchema);
//# sourceMappingURL=userModels.js.map