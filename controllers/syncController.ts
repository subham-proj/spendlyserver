import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import { EmailSyncService } from "../services/EmailSyncService.js";

export const triggerInitialSync = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.userId ?? req.user?._id.toString();
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const syncService = new EmailSyncService();
    await syncService.initialSync(userId);

    res.status(200).json({ message: "Initial sync completed" });
  },
);
