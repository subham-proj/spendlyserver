import express from "express";
import { triggerInitialSync } from "../controllers/syncController.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router: express.Router = express.Router();

router.route("/init").post(authenticate, triggerInitialSync);

export default router;
