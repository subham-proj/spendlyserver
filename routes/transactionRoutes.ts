import express from "express";
import { getTransactions, updateTransaction, deleteTransaction } from "../controllers/transactionController.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router: express.Router = express.Router();

// base URL: /api/transactions
router.get("/", authenticate, getTransactions);
router.patch("/:id", authenticate, updateTransaction);
router.delete("/:id", authenticate, deleteTransaction);

export default router;
