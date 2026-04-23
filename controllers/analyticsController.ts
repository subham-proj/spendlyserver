import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import mongoose from "mongoose";
import { Transaction } from "../models/transactionModel.js";

export const getCategoryExpenses = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = new mongoose.Types.ObjectId(req.userId!);
    const period = (req.query.period as string) ?? "month";

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const dateFilter =
      period === "month" ? { emailDate: { $gte: startOfMonth, $lte: now } } : {};

    const rows = await Transaction.aggregate([
      {
        $match: {
          userId,
          transactionType: "debit",
          amount: { $ne: null },
          category: { $ne: null },
          ...dateFilter,
        },
      },
      {
        $group: {
          _id: "$category",
          amount: { $sum: "$amount" },
        },
      },
      { $sort: { amount: -1 } },
    ]);

    const total = rows.reduce((sum, r) => sum + r.amount, 0);

    const categories = rows.map((r) => ({
      category: r._id,
      amount: Math.round(r.amount * 100) / 100,
      percentage: total > 0 ? Math.round((r.amount / total) * 1000) / 10 : 0,
    }));

    res.json({ period, currency: "INR", total: Math.round(total * 100) / 100, categories });
  },
);

export const getDailyExpenses = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = new mongoose.Types.ObjectId(req.userId!);

    const now = new Date();
    // Start of today (midnight) minus 29 days = 30 days inclusive of today
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const from = new Date(startOfToday);
    from.setDate(from.getDate() - 29);

    // Aggregate daily debit totals from DB
    const rows = await Transaction.aggregate([
      {
        $match: {
          userId,
          transactionType: "debit",
          amount: { $ne: null },
          emailDate: { $gte: from, $lte: now },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$emailDate", timezone: "Asia/Kolkata" } },
          amount: { $sum: "$amount" },
        },
      },
    ]);

    // Index DB results by date string for O(1) lookup
    const byDate: Record<string, number> = {};
    for (const row of rows) byDate[row._id] = row.amount;

    // Build a continuous 30-day array — fill missing days with 0
    const data: { date: string; amount: number }[] = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(from);
      d.setDate(from.getDate() + i);
      const key = d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // YYYY-MM-DD
      data.push({ date: key, amount: byDate[key] ?? 0 });
    }

    res.json({ currency: "INR", data });
  },
);

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
