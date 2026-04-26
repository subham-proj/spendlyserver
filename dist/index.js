import express from "express";
import "colors";
import dotenv from "dotenv";
import cors from "cors";
import { google } from "googleapis";
import bodyParser from "body-parser";
import connectDB from "./utils/db.js";
import userRoutes from "./routes/userRoutes.js";
import gmailWebhookRoutes from "./routes/gmailWebhookRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import { callbackHandler } from "./controllers/userControllers.js";
import "./queues/emailWorker.js";
import { emailQueue } from "./queues/emailQueue.js";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
dotenv.config();
connectDB();
const PORT = process.env.PORT || 3000;
const app = express();
// OAuth2 Client Setup
export const oAuth2Client = new google.auth.OAuth2(process.env.CLIENT_ID, process.env.CLIENT_SECRET, process.env.OAUTH_REDIRECT_URI ?? `http://localhost:${PORT}/auth/callback`);
app.use(cors({
    origin: true,
    credentials: true,
}));
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));
app.use("/api/users", userRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/webhook", gmailWebhookRoutes);
app.get("/auth/callback", callbackHandler);
// BullMQ dashboard — http://localhost:PORT/queues
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/queues");
createBullBoard({
    queues: [new BullMQAdapter(emailQueue)],
    serverAdapter,
});
app.use("/queues", serverAdapter.getRouter());
app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`.blue.bold);
});
//# sourceMappingURL=index.js.map