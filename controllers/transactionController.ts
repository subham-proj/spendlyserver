import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import mongoose from "mongoose";
import { Transaction } from "../models/transactionModel.js";

const VALID_TYPES     = ["debit", "credit"] as const;
const VALID_SORTS     = ["-emailDate", "emailDate", "-amount", "amount"] as const;
const VALID_CATEGORIES = [
  "food", "shopping", "travel", "utilities",
  "entertainment", "health", "finance", "transfer", "other",
] as const;

const EDITABLE_FIELDS = ["amount", "merchant", "shortName", "category", "transactionType"] as const;

// GET /api/transactions
export const getTransactions = asyncHandler(async (req: Request, res: Response) => {
  const userId = new mongoose.Types.ObjectId(req.userId!);

  // ── Parse & validate query params ──────────────────────────────────────────
  const page     = Math.max(1, parseInt(req.query.page    as string ?? "1",  10));
  const limit    = Math.min(50, Math.max(1, parseInt(req.query.limit as string ?? "20", 10)));
  const rawSort  = (req.query.sort     as string) ?? "-emailDate";
  const type     = req.query.type     as string | undefined;
  const category = req.query.category as string | undefined;
  const search   = req.query.search   as string | undefined;
  const dateFrom = req.query.dateFrom as string | undefined;
  const dateTo   = req.query.dateTo   as string | undefined;

  const sort = VALID_SORTS.includes(rawSort as any) ? rawSort : "-emailDate";

  // ── Build filter ────────────────────────────────────────────────────────────
  const filter: Record<string, unknown> = {
    userId,
    amount: { $ne: null },
  };

  if (type && VALID_TYPES.includes(type as any)) {
    filter.transactionType = type;
  }

  if (category) {
    const cats = category.split(",").filter((c) => VALID_CATEGORIES.includes(c as any));
    if (cats.length > 0) filter.category = { $in: cats };
  }

  if (search?.trim()) {
    const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = { $regex: escaped, $options: "i" };
    filter.$or = [{ merchant: regex }, { shortName: regex }];
  }

  if (dateFrom || dateTo) {
    const emailDateFilter: Record<string, Date> = {};
    if (dateFrom) emailDateFilter.$gte = new Date(dateFrom);
    if (dateTo)   emailDateFilter.$lte = new Date(dateTo);
    filter.emailDate = emailDateFilter;
  }

  // ── Build sort object ───────────────────────────────────────────────────────
  const sortField = sort.startsWith("-") ? sort.slice(1) : sort;
  const sortDir   = (sort.startsWith("-") ? -1 : 1) as 1 | -1;
  const sortObj: Record<string, 1 | -1> =
    sortField === "amount"
      ? { amount: sortDir, emailDate: -1, _id: -1 }
      : { emailDate: sortDir, _id: -1 };

  // ── Execute query + count in parallel ──────────────────────────────────────
  const skip = (page - 1) * limit;

  const [transactions, totalCount] = await Promise.all([
    Transaction.find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(limit)
      .select("merchant shortName amount currency category transactionType emailDate subject from")
      .lean(),
    Transaction.countDocuments(filter),
  ]);

  const totalPages   = Math.ceil(totalCount / limit);
  const hasNextPage  = page < totalPages;

  res.json({
    transactions,
    page,
    limit,
    totalCount,
    totalPages,
    hasNextPage,
  });
});

// PATCH /api/transactions/:id
export const updateTransaction = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ error: "Invalid transaction id" });
    return;
  }

  // Build update object from whitelisted fields only
  const update: Record<string, unknown> = {};
  for (const field of EDITABLE_FIELDS) {
    if (!(field in req.body)) continue;
    const value = req.body[field];

    if (field === "amount") {
      if (typeof value !== "number" || value <= 0) {
        res.status(400).json({ error: "amount must be a positive number" });
        return;
      }
      update.amount = value;
    } else if (field === "category") {
      if (!VALID_CATEGORIES.includes(value as any)) {
        res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(", ")}` });
        return;
      }
      update.category = value;
    } else if (field === "transactionType") {
      if (!VALID_TYPES.includes(value as any)) {
        res.status(400).json({ error: `transactionType must be one of: ${VALID_TYPES.join(", ")}` });
        return;
      }
      update.transactionType = value;
    } else if (field === "merchant" || field === "shortName") {
      if (typeof value !== "string") {
        res.status(400).json({ error: `${field} must be a string` });
        return;
      }
      update[field] = value.trim();
    }
  }

  if (Object.keys(update).length === 0) {
    res.status(400).json({ error: "No valid fields provided" });
    return;
  }

  const userId = new mongoose.Types.ObjectId(req.userId!);
  const transaction = await Transaction.findOneAndUpdate(
    { _id: id, userId },
    { $set: update },
    { new: true }
  );

  if (!transaction) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }

  res.json({ transaction });
});

// DELETE /api/transactions/:id
export const deleteTransaction = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ error: "Invalid transaction id" });
    return;
  }

  const userId = new mongoose.Types.ObjectId(req.userId!);
  const transaction = await Transaction.findOneAndDelete({ _id: id, userId });

  if (!transaction) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }

  res.status(200).json({ message: "Deleted" });
});
