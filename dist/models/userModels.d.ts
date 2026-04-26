import mongoose, { Document } from "mongoose";
export interface IUser extends Document {
    email: string;
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