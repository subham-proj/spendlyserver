import express from "express";
import { getDashboardSummary } from "../controllers/analyticsController.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router: express.Router = express.Router();

router.route("/summary").get(authenticate, getDashboardSummary);

export default router;
