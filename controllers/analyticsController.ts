import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import { AnalyticsService } from "../services/AnalyticsService.js";

export const getDashboardSummary = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.userId ?? req.user?._id.toString();
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const analyticsService = new AnalyticsService();
    const summary = await analyticsService.getSummaryCards(userId);

    res.status(200).json(summary);
  },
);
