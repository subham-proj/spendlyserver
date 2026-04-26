import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import { oAuth2Client, mobileOAuth2Client } from "../index.js";
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

      // Register Gmail push notifications so new emails trigger the webhook
      try {
        const watchRes = await gmail.users.watch({
          userId: "me",
          requestBody: {
            labelIds: ["INBOX"],
            topicName: process.env.GMAIL_PUBSUB_TOPIC,
          },
        });
        // Store the watch historyId as the anchor for history.list queries
        if (watchRes.data.historyId) {
          await User.findOneAndUpdate(
            { email },
            { $set: { lastHistoryId: watchRes.data.historyId.toString() } },
          );
        }
        console.log(`[OAuth] Gmail watch registered for ${email}`);
      } catch (watchErr) {
        console.warn(
          `[OAuth] gmail.users.watch failed for ${email}:`,
          (watchErr as Error).message,
        );
      }

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

// Returns the Google auth URL for mobile clients (no redirect, returns JSON)
export const getMobileAuthUrl = asyncHandler(
  async (req: Request, res: Response) => {
    const authUrl = mobileOAuth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
      prompt: "consent",
    });
    res.json({ authUrl });
  },
);

// Mobile OAuth callback — same logic as callbackHandler but redirects to deep link with JWT
export const mobileCallbackHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { code } = req.query;

    if (!code || typeof code !== "string") {
      res.redirect("spendly://auth/callback?error=missing_code");
      return;
    }

    try {
      const result = await mobileOAuth2Client.getToken(code);
      const { tokens } = result;

      mobileOAuth2Client.setCredentials(tokens);
      const gmail = google.gmail({ version: "v1", auth: mobileOAuth2Client });
      const profile = await gmail.users.getProfile({ userId: "me" });

      if (!profile || !profile.data || !profile.data.emailAddress) {
        res.redirect("spendly://auth/callback?error=no_email");
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

      // Register Gmail push notifications so new emails trigger the webhook
      try {
        const watchRes = await gmail.users.watch({
          userId: "me",
          requestBody: {
            labelIds: ["INBOX"],
            topicName: process.env.GMAIL_PUBSUB_TOPIC,
          },
        });
        if (watchRes.data.historyId) {
          await User.findOneAndUpdate(
            { email },
            { $set: { lastHistoryId: watchRes.data.historyId.toString() } },
          );
        }
        console.log(`[Mobile OAuth] Gmail watch registered for ${email}`);
      } catch (watchErr) {
        console.warn(
          `[Mobile OAuth] gmail.users.watch failed for ${email}:`,
          (watchErr as Error).message,
        );
      }

      const jwtToken = generateToken(user._id.toString());

      // Redirect back to the mobile app with the JWT via deep link
      res.redirect(`spendly://auth/callback?token=${jwtToken}`);
    } catch (err) {
      const error = err as Error;
      console.error("[Mobile OAuth] Callback error:", error.message);
      res.redirect(`spendly://auth/callback?error=${encodeURIComponent(error.message)}`);
    }
  },
);
