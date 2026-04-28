import express from "express";
import { getTransactions } from "../controllers/transactionController.js";
import { authenticate } from "../middleware/authMiddleware.js";
const router = express.Router();
// base URL: /api/transactions
router.get("/", authenticate, getTransactions);
export default router;
//# sourceMappingURL=transactionRoutes.js.map