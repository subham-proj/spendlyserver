import express from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import { getAnalyticsSummary } from "../controllers/analyticsController.js";

const router: express.Router = express.Router();

// GET /api/analytics/summary?period=month|all
router.get("/summary", authenticate, getAnalyticsSummary);

export default router;
