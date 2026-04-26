import express from "express";
import authRoutes from "./authRoutes.js";
import syncRoutes from "./syncRoutes.js";
import analyticsRoutes from "./analyticsRoutes.js";
const router = express.Router();
// base URL : /api/users
router.use("/users", authRoutes);
router.use("/sync", syncRoutes);
router.use("/analytics", analyticsRoutes);
export default router;
//# sourceMappingURL=index.js.map