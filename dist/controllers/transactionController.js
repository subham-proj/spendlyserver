import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import { Transaction } from "../models/transactionModel.js";
const VALID_TYPES = ["debit", "credit"];
const VALID_SORTS = ["-emailDate", "emailDate", "-amount", "amount"];
const VALID_CATEGORIES = [
    "food", "shopping", "travel", "utilities",
    "entertainment", "health", "finance", "transfer", "other",
];
// GET /api/transactions
export const getTransactions = asyncHandler(async (req, res) => {
    const userId = new mongoose.Types.ObjectId(req.userId);
    // ── Parse & validate query params ──────────────────────────────────────────
    const page = Math.max(1, parseInt(req.query.page ?? "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit ?? "20", 10)));
    const rawSort = req.query.sort ?? "-emailDate";
    const type = req.query.type;
    const category = req.query.category;
    const search = req.query.search;
    const dateFrom = req.query.dateFrom;
    const dateTo = req.query.dateTo;
    const sort = VALID_SORTS.includes(rawSort) ? rawSort : "-emailDate";
    // ── Build filter ────────────────────────────────────────────────────────────
    const filter = {
        userId,
        amount: { $ne: null },
    };
    if (type && VALID_TYPES.includes(type)) {
        filter.transactionType = type;
    }
    if (category) {
        const cats = category.split(",").filter((c) => VALID_CATEGORIES.includes(c));
        if (cats.length > 0)
            filter.category = { $in: cats };
    }
    if (search?.trim()) {
        const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = { $regex: escaped, $options: "i" };
        filter.$or = [{ merchant: regex }, { shortName: regex }];
    }
    if (dateFrom || dateTo) {
        const emailDateFilter = {};
        if (dateFrom)
            emailDateFilter.$gte = new Date(dateFrom);
        if (dateTo)
            emailDateFilter.$lte = new Date(dateTo);
        filter.emailDate = emailDateFilter;
    }
    // ── Build sort object ───────────────────────────────────────────────────────
    const sortField = sort.startsWith("-") ? sort.slice(1) : sort;
    const sortDir = (sort.startsWith("-") ? -1 : 1);
    const sortObj = sortField === "amount"
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
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    res.json({
        transactions,
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage,
    });
});
//# sourceMappingURL=transactionController.js.map