import express from "express";
import "colors";
import dotenv from "dotenv";
import cors from "cors";
import { google } from "googleapis";
import bodyParser from "body-parser";
import connectDB from "./utils/db.js";

import userRoutes from "./routes/userRoutes.js";
import gmailWebhookRoutes from "./routes/gmailWebhookRoutes.js";
import { callbackHandler } from "./controllers/userControllers.js";

dotenv.config();
connectDB();

const PORT: string | number = process.env.PORT || 3000;

const app: express.Application = express();

// OAuth2 Client Setup
export const oAuth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  `http://localhost:${PORT}/auth/callback`,
);

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

app.use("/api/users", userRoutes);
app.use("/webhook", gmailWebhookRoutes);
app.get("/auth/callback", callbackHandler);

app.listen(PORT, () => {
  console.log(
    `Server running in ${process.env.NODE_ENV} mode on port ${PORT}`.blue.bold,
  );
});
