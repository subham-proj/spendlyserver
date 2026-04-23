import express from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import { getAnalyticsSummary, getDailyExpenses, getCategoryExpenses } from "../controllers/analyticsController.js";

const router: express.Router = express.Router();

// GET /api/analytics/summary?period=month|all
router.get("/summary", authenticate, getAnalyticsSummary);

// GET /api/analytics/daily-expenses  — last 30 days, day-wise debit totals
router.get("/daily-expenses", authenticate, getDailyExpenses);

// GET /api/analytics/category-expenses?period=month|all  — spend by category for donut chart
router.get("/category-expenses", authenticate, getCategoryExpenses);

export default router;
