import express from "express";
import { oAuthHandler } from "../controllers/authController.js";
const router = express.Router();
router.route("/auth").get(oAuthHandler);
export default router;
//# sourceMappingURL=authRoutes.js.map