import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import mongoose from "mongoose";
import { Transaction } from "../models/transactionModel.js";

export const getAnalyticsSummary = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = new mongoose.Types.ObjectId(req.userId!);
    const period = (req.query.period as string) ?? "month";

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const dateFilter =
      period === "month"
        ? { emailDate: { $gte: startOfMonth, $lte: now } }
        : {};

    const [result] = await Transaction.aggregate([
      {
        $match: {
          userId,
          amount: { $ne: null },
          ...dateFilter,
        },
      },
      {
        $facet: {
          expense: [
            { $match: { transactionType: "debit" } },
            { $group: { _id: null, total: { $sum: "$amount" } } },
          ],
          income: [
            { $match: { transactionType: "credit" } },
            { $group: { _id: null, total: { $sum: "$amount" } } },
          ],
          topCategory: [
            { $match: { transactionType: "debit", category: { $ne: null } } },
            { $group: { _id: "$category", total: { $sum: "$amount" } } },
            { $sort: { total: -1 } },
            { $limit: 1 },
          ],
        },
      },
    ]);

    const totalExpense = result?.expense?.[0]?.total ?? 0;
    const totalIncome = result?.income?.[0]?.total ?? 0;
    const totalSavings = totalIncome - totalExpense;
    const topCat = result?.topCategory?.[0] ?? null;

    res.json({
      period,
      currency: "INR",
      totalExpense,
      totalIncome,
      totalSavings,
      maxSpentCategory: topCat
        ? { category: topCat._id, amount: topCat.total }
        : null,
    });
  },
);
