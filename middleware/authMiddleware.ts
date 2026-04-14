import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import asyncHandler from "express-async-handler";
import { User, IUser } from "../models/userModels.js";

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      userId?: string;
    }
  }
}

const getJWTSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set");
  }
  return secret;
};

export const authenticate = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      res.status(401).json({ error: "No authorization token provided" });
      return;
    }

    const decoded = jwt.verify(token, getJWTSecret()) as JwtPayload & {
      userId: string;
    };

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
  },
);

export const generateToken = (userId: string): string => {
  return jwt.sign({ userId }, getJWTSecret(), {
    expiresIn: "7d",
  });
};
