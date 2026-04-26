import express from "express";
import { triggerInitialSync, clearUserData } from "../controllers/syncController.js";
import { authenticate } from "../middleware/authMiddleware.js";
const router = express.Router();
router.route("/init").post(authenticate, triggerInitialSync);
router.route("/data").delete(authenticate, clearUserData);
export default router;
//# sourceMappingURL=syncRoutes.js.map