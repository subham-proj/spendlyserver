import jwt from "jsonwebtoken";
import asyncHandler from "express-async-handler";
import { User } from "../models/userModels.js";
const getJWTSecret = () => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("JWT_SECRET environment variable is not set");
    }
    return secret;
};
export const authenticate = asyncHandler(async (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
        res.status(401).json({ error: "No authorization token provided" });
        return;
    }
    const decoded = jwt.verify(token, getJWTSecret());
    if (!decoded.userId) {
        res.status(401).json({ error: "Invalid token format" });
        return;
    }
    const user = await User.findById(decoded.userId);
    if (!user) {
        res.status(401).json({ error: "User not found" });
        return;
    }
    req.user = user;
    req.userId = user._id.toString();
    next();
});
export const generateToken = (userId) => {
    return jwt.sign({ userId }, getJWTSecret(), {
        expiresIn: "7d",
    });
};
//# sourceMappingURL=authMiddleware.js.map