import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import { oAuth2Client } from "../index.js";
import { SCOPES } from "../contants/globalConstants.js";
import { User } from "../models/userModels.js";
import { google } from "googleapis";
import { generateToken } from "../middleware/authMiddleware.js";

export const oAuthHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
      prompt: "consent",
    });
    res.redirect(authUrl);
  },
);

export const callbackHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { code } = req.query;

    if (!code || typeof code !== "string") {
      res.status(400).json({ error: "Authorization code is required" });
      return;
    }

    try {
      const result = await oAuth2Client.getToken(code);
      const { tokens } = result;

      oAuth2Client.setCredentials(tokens);
      const gmail = google.gmail({ version: "v1", auth: oAuth2Client });
      const profile = await gmail.users.getProfile({ userId: "me" });

      if (!profile || !profile.data || !profile.data.emailAddress) {
        res.status(500).json({
          error: "No email address found in Gmail profile",
        });
        return;
      }

      const email = profile.data.emailAddress;
      const refreshTokenExpiresIn =
        (tokens as any).refresh_token_expires_in ?? null;
      const expiryDate = tokens.expiry_date ?? null;

      const user = await User.findOneAndUpdate(
        { email },
        {
          email,
          accessToken: tokens.access_token || null,
          refreshToken: tokens.refresh_token || null,
          scope: tokens.scope || null,
          refreshTokenExpiresIn,
          expiryDate,
        },
        { upsert: true, new: true },
      );

      const jwtToken = generateToken(user._id.toString());

      res.json({
        message: "Authenticated!",
        user,
        token: jwtToken,
        googleTokens: tokens,
      });
    } catch (err) {
      const error = err as Error;
      res.status(500).json({ error: error.message });
    }
  },
);
