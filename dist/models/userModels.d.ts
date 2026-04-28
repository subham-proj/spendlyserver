import mongoose, { Document } from "mongoose";
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
export declare const User: mongoose.Model<IUser, {}, {}, {}, mongoose.Document<unknown, {}, IUser, {}, mongoose.DefaultSchemaOptions> & IUser & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IUser>;
//# sourceMappingURL=userModels.d.ts.map