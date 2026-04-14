import express from "express";
import {
  oAuthHandler,
  triggerInitialSync,
} from "../controllers/userControllers";
import { authenticate } from "../middleware/authMiddleware.js";
const router: express.Router = express.Router();

// base URL : /api/users
router.route("/auth").get(oAuthHandler);
router.route("/sync/init").post(authenticate, triggerInitialSync);

export default router;
