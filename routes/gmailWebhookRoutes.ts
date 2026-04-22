import express from "express";
import { gmailWebhookHandler } from "../controllers/gmailWebhookController.js";

const router = express.Router();

// No authenticate middleware — Pub/Sub calls this endpoint directly
router.post("/gmail", gmailWebhookHandler);

export default router;

//gcloud pubsub subscriptions modify-push-config gmail-sub \
//--push-endpoint=https://<new-ngrok-url>/webhook/gmail
