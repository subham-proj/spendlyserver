import { IUser } from "../models/userModels.js";
declare global {
    namespace Express {
        interface Request {
            user?: IUser;
            userId?: string;
        }
    }
}
export declare const authenticate: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
export declare const generateToken: (userId: string) => string;
//# sourceMappingURL=authMiddleware.d.ts.map