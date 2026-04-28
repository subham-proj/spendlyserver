import express from "express";
import { oAuthHandler, getMobileAuthUrl, getUserProfile, updatePreferences, } from "../controllers/userControllers";
import { authenticate } from "../middleware/authMiddleware.js";
const router = express.Router();
// base URL : /api/users
router.route("/auth").get(oAuthHandler);
router.route("/auth/mobile-url").get(getMobileAuthUrl);
router.route("/me").get(authenticate, getUserProfile);
router.route("/preferences").patch(authenticate, updatePreferences);
export default router;
//# sourceMappingURL=userRoutes.js.map