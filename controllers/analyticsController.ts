import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import mongoose from "mongoose";
import Groq from "groq-sdk";
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

export const getRecentTransactions = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = new mongoose.Types.ObjectId(req.userId!);
    const limit = Math.min(parseInt((req.query.limit as string) ?? "10", 10), 50);

    const transactions = await Transaction.find({ userId, amount: { $ne: null } })
      .sort({ emailDate: -1 })
      .limit(limit)
      .select("merchant amount currency category transactionType emailDate subject")
      .lean();

    res.json({ transactions });
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

// ── GET /api/analytics/insights?period=month|all ──────────────────────────────
export const getAIInsights = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = new mongoose.Types.ObjectId(req.userId!);
    const period = (req.query.period as string) ?? "month";

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const dateFilter =
      period === "month" ? { emailDate: { $gte: startOfMonth, $lte: now } } : {};

    // 30-day window for trend data (always last 30 days regardless of period)
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const trendFrom = new Date(startOfToday);
    trendFrom.setDate(trendFrom.getDate() - 29);

    // Run all aggregations in parallel
    const [summaryResult, categoryRows, dailyRows] = await Promise.all([
      // Summary: income, expense
      Transaction.aggregate([
        { $match: { userId, amount: { $ne: null }, ...dateFilter } },
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
          },
        },
      ]),

      // Top 5 categories by spend
      Transaction.aggregate([
        {
          $match: {
            userId,
            transactionType: "debit",
            amount: { $ne: null },
            category: { $ne: null },
            ...dateFilter,
          },
        },
        { $group: { _id: "$category", amount: { $sum: "$amount" } } },
        { $sort: { amount: -1 } },
        { $limit: 5 },
      ]),

      // 30-day daily totals
      Transaction.aggregate([
        {
          $match: {
            userId,
            transactionType: "debit",
            amount: { $ne: null },
            emailDate: { $gte: trendFrom, $lte: now },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$emailDate",
                timezone: "Asia/Kolkata",
              },
            },
            amount: { $sum: "$amount" },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    // Process summary
    const [facet] = summaryResult as any[];
    const totalExpense: number = facet?.expense?.[0]?.total ?? 0;
    const totalIncome: number  = facet?.income?.[0]?.total  ?? 0;
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;

    // Process categories
    const catTotal = (categoryRows as any[]).reduce((s, r) => s + r.amount, 0);
    const topCats = (categoryRows as any[]).map((r) => ({
      category: r._id,
      amount:   Math.round(r.amount),
      pct:      catTotal > 0 ? Math.round((r.amount / catTotal) * 1000) / 10 : 0,
    }));

    // Process daily trend — find peak day
    const byDate: Record<string, number> = {};
    for (const row of dailyRows as any[]) byDate[(row as any)._id] = (row as any).amount;
    let peakDate = "N/A", peakAmount = 0;
    for (const [date, amt] of Object.entries(byDate)) {
      if ((amt as number) > peakAmount) { peakAmount = amt as number; peakDate = date; }
    }

    // Build context string for the LLM
    const catLines = topCats
      .map((c) => `${c.category} ₹${c.amount} (${c.pct}%)`)
      .join(", ");
    const financialContext = [
      `Period: ${period === "month" ? "This Month" : "All Time"}`,
      `Total Spend: ₹${Math.round(totalExpense)} | Total Income: ₹${Math.round(totalIncome)} | Savings Rate: ${savingsRate.toFixed(1)}%`,
      topCats.length > 0 ? `Top Categories: ${catLines}` : "No category data",
      peakAmount > 0 ? `30-day spending peak: ₹${Math.round(peakAmount)} on ${peakDate}` : "No trend data",
    ].join("\n");

    // Rule-based fallback insights (used if Groq fails or no data)
    const fallbackInsights = buildFallbackInsights(totalExpense, totalIncome, savingsRate, topCats);

    // Early return if no meaningful data
    if (totalExpense === 0 && totalIncome === 0) {
      res.json({ period, insights: fallbackInsights });
      return;
    }

    try {
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        max_tokens: 600,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'You are a personal finance assistant. Always respond with a JSON object containing an "insights" array.',
          },
          {
            role: "user",
            content: `Based on this spending data, return a JSON object with key "insights" containing an array of 3–4 insight objects.
Each insight object must have exactly these keys: "emoji" (string), "title" (string, ≤8 words), "description" (string, 1–2 sentences, mention specific amounts), "accent" (hex color string).

Financial data:
${financialContext}

Rules:
- Be specific with rupee amounts from the data above.
- Use encouraging language where spending is healthy.
- Flag genuine concerns clearly but kindly.
- Vary the accent colors: use #F87171 (red), #10B981 (green), #FBBF24 (amber), #60A5FA (blue), #A78BFA (purple) as appropriate.`,
          },
        ],
      });

      const raw = completion.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(raw);
      const insights = Array.isArray(parsed.insights) ? parsed.insights : fallbackInsights;

      res.json({ period, insights });
    } catch {
      res.json({ period, insights: fallbackInsights });
    }
  },
);

function buildFallbackInsights(
  totalExpense: number,
  totalIncome: number,
  savingsRate: number,
  topCats: { category: string; amount: number; pct: number }[],
) {
  const insights: { emoji: string; title: string; description: string; accent: string }[] = [];

  if (topCats.length > 0) {
    const top = topCats[0];
    insights.push({
      emoji: "🏆",
      title: `Top spend: ${top.category}`,
      description: `You've spent ₹${top.amount} on ${top.category} this period, accounting for ${top.pct}% of total expenses.`,
      accent: "#F87171",
    });
  }

  if (totalIncome > 0) {
    const isGood = savingsRate >= 20;
    insights.push({
      emoji: isGood ? "🎉" : "💡",
      title: isGood ? "Great savings rate!" : "Savings opportunity",
      description: isGood
        ? `You're saving ${savingsRate.toFixed(1)}% of your income (₹${Math.round(totalIncome - totalExpense)}). Keep it up!`
        : `Your savings rate is ${savingsRate.toFixed(1)}%. Try reducing discretionary spend to save more.`,
      accent: isGood ? "#10B981" : "#FBBF24",
    });
  } else if (totalExpense > 0) {
    insights.push({
      emoji: "📊",
      title: "Expenses tracked",
      description: `You've tracked ₹${Math.round(totalExpense)} in expenses. Connect your income sources for savings insights.`,
      accent: "#60A5FA",
    });
  }

  return insights;
}
