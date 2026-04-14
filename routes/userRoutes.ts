import express from "express";
import { oAuthHandler } from "../controllers/userControllers";
const router: express.Router = express.Router();

// base URL : /api/users
router.route("/auth").get(oAuthHandler);

export default router;
