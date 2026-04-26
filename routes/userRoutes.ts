import express from "express";
import { oAuthHandler, getMobileAuthUrl } from "../controllers/userControllers";
const router: express.Router = express.Router();

// base URL : /api/users
router.route("/auth").get(oAuthHandler);
router.route("/auth/mobile-url").get(getMobileAuthUrl);

export default router;
