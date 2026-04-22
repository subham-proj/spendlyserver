# Gmail Push Notification Webhook — Setup Guide

How to wire up real-time Gmail inbox notifications using Google Cloud Pub/Sub so that every new email triggers a webhook and logs `{ from, to, date, messageId }`.

---

## How It Works

Gmail does not support direct HTTP webhooks. The flow is:

```
New email arrives in inbox
  → Gmail detects change
    → Gmail publishes { emailAddress, historyId } to a Pub/Sub topic
      → Pub/Sub push subscription POSTs to your server
        → POST /webhook/gmail
          → history.list → messages.get → log { from, to, date, messageId }
```

---

## Part 1 — Google Cloud Setup (one-time)

### 1. Set your project

```bash
gcloud config set project <your-project-id>
```

### 2. Enable required APIs

```bash
gcloud services enable pubsub.googleapis.com
gcloud services enable gmail.googleapis.com
```

### 3. Create a Pub/Sub topic

```bash
gcloud pubsub topics create gmail-notifications
```

### 4. Grant Gmail permission to publish to your topic

This is the step most people miss. Gmail uses a Google-managed service account to publish notifications. You must give it Publisher access before registering a watch.

```bash
gcloud pubsub topics add-iam-policy-binding gmail-notifications \
  --member=serviceAccount:gmail-api-push@system.gserviceaccount.com \
  --role=roles/pubsub.publisher
```

> **Do this before calling `gmail.users.watch()`** — if watch() is called first, it silently fails even though the API returns success.

### 5. Create a push subscription pointing to your server

```bash
gcloud pubsub subscriptions create gmail-sub \
  --topic=gmail-notifications \
  --push-endpoint=https://<your-domain>/webhook/gmail \
  --ack-deadline=20
```

For local development, use ngrok:

```bash
ngrok http 3000
# then:
gcloud pubsub subscriptions create gmail-sub \
  --topic=gmail-notifications \
  --push-endpoint=https://<ngrok-url>/webhook/gmail \
  --ack-deadline=20
```

If your ngrok URL changes (it does on every restart unless you have a paid plan):

```bash
gcloud pubsub subscriptions modify-push-config gmail-sub \
  --push-endpoint=https://<new-ngrok-url>/webhook/gmail
```

### 6. Add the topic name to your .env

```
GMAIL_PUBSUB_TOPIC=projects/<your-project-id>/topics/gmail-notifications
```

---

## Part 2 — Code

### User model — add `lastHistoryId`

```typescript
// models/userModels.ts
lastHistoryId: {
  type: String,
  default: null,
}
```

This field is the anchor for `history.list` queries. It stores the last notification's historyId so each webhook call only looks at new messages since the previous call.

### OAuth callback — register watch() after login

```typescript
// controllers/userControllers.ts — inside callbackHandler, after User.findOneAndUpdate
try {
  const watchRes = await gmail.users.watch({
    userId: "me",
    requestBody: {
      labelIds: ["INBOX"],
      topicName: process.env.GMAIL_PUBSUB_TOPIC,
    },
  });
  if (watchRes.data.historyId) {
    await User.findOneAndUpdate(
      { email },
      { lastHistoryId: watchRes.data.historyId.toString() }
    );
  }
} catch (watchErr) {
  console.warn("[OAuth] gmail.users.watch failed:", (watchErr as Error).message);
}
```

### Webhook route — no auth middleware

```typescript
// routes/gmailWebhookRoutes.ts
router.post("/gmail", gmailWebhookHandler);
// No authenticate() — Pub/Sub calls this directly, no JWT
```

```typescript
// index.ts
app.use("/webhook", gmailWebhookRoutes);
```

### Webhook controller — full handler

```typescript
// controllers/gmailWebhookController.ts
export const gmailWebhookHandler = asyncHandler(async (req, res) => {
  // 1. Decode the Pub/Sub push payload
  const rawData = req.body?.message?.data;
  if (!rawData) {
    res.status(200).json({ message: "No data in message" });
    return;
  }

  const { emailAddress, historyId } = JSON.parse(
    Buffer.from(rawData, "base64").toString("utf-8")
  );

  // 2. Look up the user's stored OAuth tokens
  const user = await User.findOne({ email: emailAddress.toLowerCase() });
  if (!user?.accessToken || !user?.refreshToken) {
    res.status(200).json({ message: "User not found or missing tokens" });
    return;
  }

  // 3. Create a per-user OAuth client (never use the shared singleton)
  const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
  auth.setCredentials({
    access_token: user.accessToken,
    refresh_token: user.refreshToken,
    expiry_date: user.expiryDate ?? undefined,
  });

  const gmail = google.gmail({ version: "v1", auth });

  // 4. Use lastHistoryId as the anchor, not the notification's historyId
  //    Gmail sends the latest historyId (could be a label event), not the
  //    messageAdded historyId. Anchoring from lastHistoryId catches everything.
  const startHistoryId = user.lastHistoryId ?? (BigInt(historyId) - 1n).toString();

  // Update before fetching to prevent re-processing on concurrent notifications
  await User.findOneAndUpdate(
    { email: emailAddress.toLowerCase() },
    { lastHistoryId: historyId.toString() }
  );

  // 5. Fetch new message IDs
  const historyRes = await gmail.users.history.list({
    userId: "me",
    startHistoryId,
    historyTypes: ["messageAdded"],
  });

  const records = historyRes.data.history ?? [];

  // 6. Fetch metadata and log for each new message
  for (const record of records) {
    for (const added of record.messagesAdded ?? []) {
      const messageId = added.message?.id;
      if (!messageId) continue;

      const msg = await gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format: "metadata",
        metadataHeaders: ["From", "To", "Date"],
      });

      const headers = msg.data.payload?.headers ?? [];
      const get = (name: string) =>
        headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? null;

      console.log("[GmailWebhook] New email received:", {
        from: get("From"),
        to: get("To"),
        date: get("Date"),
        messageId: msg.data.id,
      });
    }
  }

  // Always return 200 — any other status causes Pub/Sub to retry
  res.status(200).json({ message: "Webhook processed" });
});
```

---

## Part 3 — Key Gotchas

### `history.list` is exclusive of `startHistoryId`

`history.list(startHistoryId: N)` returns records with id **> N**, not >= N.

### Gmail's notification historyId ≠ the new message's historyId

The notification contains the *latest* historyId at delivery time — often a label or categorization event that happened after the message arrived. The actual `messageAdded` record lives at an earlier historyId. **Always use `user.lastHistoryId` as the anchor.**

### Nodemon must watch `.ts` files explicitly

```json
"dev": "nodemon --exec tsx index.ts --ext ts,js,json"
```

Without `--ext ts,js,json`, nodemon ignores TypeScript file changes and serves stale code silently.

### Per-user OAuth client, not the shared singleton

The `oAuth2Client` in `index.ts` is shared global state. Using it in the webhook handler causes credential race conditions when multiple users' notifications arrive concurrently. Always create `new google.auth.OAuth2(...)` per request.

### `watch()` expires every 7 days

`gmail.users.watch()` returns an `expiration` timestamp (~7 days out). After that, Gmail stops publishing. Re-authenticating via OAuth renews the watch automatically. For production, run a cron job that calls `watch()` for all users every 6 days.

---

## Part 4 — Testing

### Test the endpoint directly (bypass Pub/Sub)

```bash
# Pre-encoded base64 of {"emailAddress":"your@gmail.com","historyId":"<real-historyId>"}
curl -X POST http://localhost:3000/webhook/gmail \
  -H "Content-Type: application/json" \
  -d '{"message":{"data":"<base64>","messageId":"test-1","publishTime":"2026-01-01T00:00:00Z"},"subscription":"projects/<project>/subscriptions/gmail-sub"}'
```

To encode on the fly (single line, no variable):

```bash
curl -X POST http://localhost:3000/webhook/gmail \
  -H "Content-Type: application/json" \
  --data-raw "{\"message\":{\"data\":\"$(echo -n '{\"emailAddress\":\"your@gmail.com\",\"historyId\":\"123456\"}' | base64)\",\"messageId\":\"t\",\"publishTime\":\"2026-01-01T00:00:00Z\"},\"subscription\":\"test\"}"
```

### Check if Gmail is publishing to Pub/Sub

Create a temporary pull subscription on the same topic:

```bash
gcloud pubsub subscriptions create debug-pull --topic=gmail-notifications
# send an email, then:
gcloud pubsub subscriptions pull debug-pull --limit=5 --auto-ack
# cleanup:
gcloud pubsub subscriptions delete debug-pull
```

If this returns 0 items after an email arrives, `gmail.users.watch()` is not registered or the IAM permission is missing.

### Re-register watch manually (without re-authenticating)

```bash
node -e "
const { google } = require('googleapis');
require('dotenv').config();
const { MongoClient } = require('mongodb');
MongoClient.connect(process.env.MONGO_URI).then(async client => {
  const user = await client.db().collection('users').findOne({ email: 'your@gmail.com' });
  const auth = new google.auth.OAuth2(process.env.CLIENT_ID, process.env.CLIENT_SECRET);
  auth.setCredentials({ access_token: user.accessToken, refresh_token: user.refreshToken });
  const gmail = google.gmail({ version: 'v1', auth });
  await gmail.users.stop({ userId: 'me' }).catch(() => {});
  const res = await gmail.users.watch({
    userId: 'me',
    requestBody: { labelIds: ['INBOX'], topicName: process.env.GMAIL_PUBSUB_TOPIC }
  });
  console.log('Watch registered:', res.data);
  await client.db().collection('users').updateOne(
    { email: 'your@gmail.com' },
    { \$set: { lastHistoryId: res.data.historyId.toString() } }
  );
  client.close();
});
"
```

---

## Part 5 — End-to-End Checklist

- [ ] Pub/Sub topic exists
- [ ] `gmail-api-push@system.gserviceaccount.com` has `roles/pubsub.publisher` on topic
- [ ] Push subscription created and pointing to `https://<domain>/webhook/gmail`
- [ ] `GMAIL_PUBSUB_TOPIC` set in `.env`
- [ ] Server running with `npm run dev` (includes `--ext ts,js,json`)
- [ ] User authenticated via `/api/users/auth` (triggers `watch()` and sets `lastHistoryId`)
- [ ] Send a test email → logs appear in terminal
