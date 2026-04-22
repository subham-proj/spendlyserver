import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import { google } from "googleapis";
import { User } from "../models/userModels.js";

interface PubSubPushPayload {
  message: {
    data: string;
    messageId: string;
    publishTime: string;
  };
  subscription: string;
}

interface GmailNotification {
  emailAddress: string;
  historyId: string;
}

export const gmailWebhookHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const body = req.body as PubSubPushPayload;
    const rawData = body?.message?.data;

    if (!rawData) {
      console.warn("[GmailWebhook] No data in Pub/Sub message");
      res.status(200).json({ message: "No data in message" });
      return;
    }

    let notification: GmailNotification;
    try {
      const decoded = Buffer.from(rawData, "base64").toString("utf-8");
      notification = JSON.parse(decoded);
    } catch {
      console.warn("[GmailWebhook] Failed to decode Pub/Sub message data");
      res.status(200).json({ message: "Invalid message data" });
      return;
    }

    const { emailAddress, historyId } = notification;
    console.log("[GmailWebhook] Decoded notification:", { emailAddress, historyId });

    const user = await User.findOne({ email: emailAddress.toLowerCase() });
    if (!user || !user.accessToken || !user.refreshToken) {
      console.warn(`[GmailWebhook] No stored tokens for ${emailAddress}`);
      res.status(200).json({ message: "User not found or missing tokens" });
      return;
    }

    const userOAuth2Client = new google.auth.OAuth2(
      process.env.CLIENT_ID,
      process.env.CLIENT_SECRET,
      `http://localhost:${process.env.PORT || 3000}/auth/callback`,
    );

    userOAuth2Client.setCredentials({
      access_token: user.accessToken,
      refresh_token: user.refreshToken,
      expiry_date: user.expiryDate ?? undefined,
    });

    // Persist refreshed tokens back to MongoDB
    userOAuth2Client.on("tokens", async (newTokens) => {
      if (newTokens.access_token) {
        await User.findOneAndUpdate(
          { email: emailAddress.toLowerCase() },
          {
            accessToken: newTokens.access_token,
            expiryDate: newTokens.expiry_date ?? null,
          },
        );
      }
    });

    const gmail = google.gmail({ version: "v1", auth: userOAuth2Client });

    // Use the stored lastHistoryId as the anchor so we catch all messageAdded
    // events since the last processed notification, not just the triggering one.
    // The notification's historyId is the latest change (could be a label/read
    // event), while the actual messageAdded may have occurred at an earlier id.
    const startHistoryId = user.lastHistoryId ?? (BigInt(historyId) - 1n).toString();
    console.log("[GmailWebhook] Calling history.list with startHistoryId:", startHistoryId);

    // Update lastHistoryId to the current notification's historyId before fetching,
    // so concurrent notifications don't re-process the same messages.
    await User.findOneAndUpdate(
      { email: emailAddress.toLowerCase() },
      { lastHistoryId: historyId.toString() },
    );

    let historyResponse;
    try {
      historyResponse = await gmail.users.history.list({
        userId: "me",
        startHistoryId,
        historyTypes: ["messageAdded"],
      });
    } catch (err) {
      console.warn(
        `[GmailWebhook] history.list failed for ${emailAddress}:`,
        (err as Error).message,
      );
      res.status(200).json({ message: "History not available, skipping" });
      return;
    }

    const historyRecords = historyResponse.data.history ?? [];
    console.log("[GmailWebhook] History records count:", historyRecords.length);

    for (const record of historyRecords) {
      const addedMessages = record.messagesAdded ?? [];
      for (const added of addedMessages) {
        const messageId = added.message?.id;
        if (!messageId) continue;

        const msgResponse = await gmail.users.messages.get({
          userId: "me",
          id: messageId,
          format: "metadata",
          metadataHeaders: ["From", "To", "Date"],
        });

        const headers = msgResponse.data.payload?.headers ?? [];
        const getHeader = (name: string) =>
          headers.find(
            (h) => h.name?.toLowerCase() === name.toLowerCase(),
          )?.value ?? null;

        const emailLog = {
          from: getHeader("From"),
          to: getHeader("To"),
          date: getHeader("Date"),
          messageId: msgResponse.data.id,
        };

        console.log("[GmailWebhook] New email received:", emailLog);
      }
    }

    res.status(200).json({ message: "Webhook processed" });
  },
);
