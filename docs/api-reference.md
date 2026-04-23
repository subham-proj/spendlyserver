# Spendly Server — API Reference

## Overview

Spendly Server is a Node.js/Express backend that connects to a user's Gmail inbox via Google Pub/Sub push notifications, uses Groq AI to identify and parse transactional emails, and exposes analytics endpoints for expense tracking.

**Base URL (local):** `http://localhost:3000`  
**Stack:** Express 5 · MongoDB (Mongoose) · BullMQ (Redis) · Groq AI · Gmail API · Google OAuth 2.0

---

## Architecture

```
Gmail Inbox
  └─→ Google Pub/Sub topic (gmail-notifications)
        └─→ Push subscription → POST /webhook/gmail
              └─→ BullMQ queue (email-processing)
                    └─→ Worker → Groq AI (llama-3.3-70b-versatile)
                          └─→ MongoDB transactions collection
```

---

## Authentication

All protected endpoints require a **Bearer JWT** in the `Authorization` header.

```
Authorization: Bearer <token>
```

Tokens are issued at OAuth callback and expire in **7 days**.

---

## Endpoints

### Auth

#### `GET /api/users/auth`
Initiates Google OAuth 2.0 login flow.

Redirects the browser to Google's consent screen requesting Gmail read/modify and profile scopes.

**No auth required.**

---

#### `GET /auth/callback`
OAuth redirect URI — handled automatically by Google after user consent.

Exchanges the authorization code for tokens, upserts the user in MongoDB, registers a Gmail push notification watch, and returns the JWT.

**No auth required.**

| Field | Description |
|---|---|
| Query `code` | OAuth authorization code from Google |

**Response `200`**
```json
{
  "message": "Authenticated!",
  "user": {
    "_id": "69e8e5f5a6cae9006e683004",
    "email": "user@gmail.com",
    "lastHistoryId": "6193516",
    "createdAt": "2026-04-22T...",
    "updatedAt": "2026-04-23T..."
  },
  "token": "<jwt>",
  "googleTokens": {
    "access_token": "...",
    "refresh_token": "...",
    "expiry_date": 1776957600000,
    "scope": "..."
  }
}
```

**Error responses**

| Status | Reason |
|---|---|
| `400` | No authorization code in query |
| `500` | Google token exchange failed |

---

### Webhook (internal — called by Google Pub/Sub)

#### `POST /webhook/gmail`
Receives Gmail push notifications from Google Cloud Pub/Sub. **Do not call this manually in production.**

**No auth required** (Pub/Sub calls this directly).

**Request body** (sent by Pub/Sub):
```json
{
  "message": {
    "data": "<base64-encoded { emailAddress, historyId }>",
    "messageId": "pub-sub-message-id",
    "publishTime": "2026-04-23T15:00:00Z"
  },
  "subscription": "projects/spendly-493214/subscriptions/gmail-sub"
}
```

**Processing flow:**
1. Decodes the base64 `data` field → `{ emailAddress, historyId }`
2. Looks up the user's stored OAuth tokens
3. Calls `gmail.users.history.list` from the stored `lastHistoryId` anchor
4. For each new message, fetches subject + snippet via `messages.get`
5. Enqueues a job to BullMQ `email-processing` queue
6. Worker calls Groq to classify + extract transaction data
7. If transactional, upserts a `Transaction` document in MongoDB

Always returns `200` — any non-200 causes Pub/Sub to retry.

**Response `200`**
```json
{ "message": "Webhook processed" }
```

---

### Analytics

All analytics endpoints require authentication.

#### `GET /api/analytics/summary`
Returns a financial summary for the authenticated user.

| Query param | Values | Default | Description |
|---|---|---|---|
| `period` | `month` \| `all` | `month` | `month` = current calendar month · `all` = all-time |

**Response `200`**
```json
{
  "period": "month",
  "currency": "INR",
  "totalExpense": 9461.5,
  "totalIncome": 0,
  "totalSavings": -9461.5,
  "maxSpentCategory": {
    "category": "food",
    "amount": 4500
  }
}
```

| Field | Description |
|---|---|
| `totalExpense` | Sum of all `debit` transactions in the period |
| `totalIncome` | Sum of all `credit` transactions in the period |
| `totalSavings` | `totalIncome - totalExpense` (can be negative) |
| `maxSpentCategory` | Category with the highest debit total · `null` if no data |

---

#### `GET /api/analytics/daily-expenses`
Returns day-wise debit totals for the last 30 days. Suitable for line/bar charts.

No query params. Window is always today − 29 days → today (IST timezone).

**Response `200`**
```json
{
  "currency": "INR",
  "data": [
    { "date": "2026-03-25", "amount": 0 },
    { "date": "2026-03-26", "amount": 1200 },
    "...",
    { "date": "2026-04-23", "amount": 4500 }
  ]
}
```

- Always returns exactly **30 entries**, one per day, in ascending date order
- Days with no transactions have `amount: 0`
- Dates are `YYYY-MM-DD` strings in **IST (Asia/Kolkata)**

---

#### `GET /api/analytics/category-expenses`
Returns debit totals grouped by category. Suitable for donut/pie charts.

| Query param | Values | Default | Description |
|---|---|---|---|
| `period` | `month` \| `all` | `month` | `month` = current calendar month · `all` = all-time |

**Response `200`**
```json
{
  "period": "month",
  "currency": "INR",
  "total": 78731,
  "categories": [
    { "category": "shopping",      "amount": 24564, "percentage": 31.2 },
    { "category": "finance",       "amount": 20821, "percentage": 26.4 },
    { "category": "health",        "amount": 8663,  "percentage": 11.0 },
    { "category": "utilities",     "amount": 8419,  "percentage": 10.7 },
    { "category": "entertainment", "amount": 4507,  "percentage": 5.7  },
    { "category": "food",          "amount": 3276,  "percentage": 4.2  },
    { "category": "travel",        "amount": 2028,  "percentage": 2.6  }
  ]
}
```

| Field | Description |
|---|---|
| `total` | Sum of all debit amounts across all categories |
| `categories` | Sorted by `amount` descending |
| `percentage` | Each category's share of total — one decimal place |

**Category values**

| Value | Description |
|---|---|
| `food` | Restaurants, Swiggy, Zomato, cafes |
| `shopping` | Amazon, Flipkart, retail |
| `travel` | Flights, Ola, Uber, hotels, IRCTC |
| `utilities` | Electricity, internet, mobile recharge |
| `entertainment` | Netflix, Spotify, movies, games |
| `health` | Pharmacy, hospitals, insurance |
| `finance` | Mutual funds, SIP, EMI, loan payments |
| `transfer` | UPI peer-to-peer, bank transfers |
| `other` | Uncategorised transactions |

---

### Dashboard

#### `GET /queues`
BullMQ Bull Board dashboard UI. Shows the `email-processing` queue with job counts, payloads, and results.

**No auth required.** Restrict access before deploying to production.

---

## Data Models

### User

| Field | Type | Description |
|---|---|---|
| `_id` | ObjectId | MongoDB document ID |
| `email` | String | Gmail address (unique, lowercase) |
| `accessToken` | String \| null | Google OAuth access token |
| `refreshToken` | String \| null | Google OAuth refresh token |
| `expiryDate` | Number \| null | Access token expiry (Unix ms) |
| `lastHistoryId` | String \| null | Gmail history ID anchor for Pub/Sub dedup |
| `createdAt` | Date | Auto-managed by Mongoose |
| `updatedAt` | Date | Auto-managed by Mongoose |

---

### Transaction

| Field | Type | Description |
|---|---|---|
| `_id` | ObjectId | MongoDB document ID |
| `userId` | ObjectId | Ref → User |
| `messageId` | String | Gmail message ID (unique — dedup key) |
| `from` | String | Sender email address |
| `subject` | String | Email subject line |
| `emailDate` | Date | Date from email headers |
| `amount` | Number \| null | Transaction amount |
| `currency` | String | Default `"INR"` |
| `merchant` | String \| null | Merchant name extracted by Groq |
| `category` | Enum \| null | See category values above |
| `transactionType` | `"debit"` \| `"credit"` \| null | Direction of the transaction |
| `rawSnippet` | String | Original Gmail message snippet |
| `processedAt` | Date | When Groq processed this email |
| `createdAt` | Date | Auto-managed by Mongoose |
| `updatedAt` | Date | Auto-managed by Mongoose |

---

## Error Responses

All protected endpoints return these standard error shapes:

| Status | Body | Cause |
|---|---|---|
| `400` | `{ "error": "No authorization code provided" }` | Missing OAuth code |
| `401` | `{ "error": "No authorization token provided" }` | Missing `Authorization` header |
| `401` | `{ "error": "Invalid token format" }` | JWT has no `userId` claim |
| `401` | `{ "error": "User not found" }` | JWT valid but user deleted |
| `500` | `{ "error": "<message>" }` | Unexpected server error |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `CLIENT_ID` | Yes | Google OAuth 2.0 Client ID |
| `CLIENT_SECRET` | Yes | Google OAuth 2.0 Client Secret |
| `MONGO_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Secret for signing JWTs |
| `GMAIL_PUBSUB_TOPIC` | Yes | Full Pub/Sub topic name e.g. `projects/<id>/topics/gmail-notifications` |
| `GROQ_API_KEY` | Yes | Groq API key for `llama-3.3-70b-versatile` |
| `REDIS_URL` | No | Redis connection URL · default `redis://localhost:6379` |
| `PORT` | No | Server port · default `3000` |
| `NODE_ENV` | No | Environment label (`dev` / `production`) |

---

## Running Locally

**Prerequisites:** Node.js 18+, MongoDB, Redis

```bash
# Install dependencies
npm install

# Development (auto-restart on file changes)
npm run dev

# Production build
npm run build
npm start
```

**Required services before starting:**
```bash
redis-server          # BullMQ queue backend
# MongoDB — use Atlas URI or local mongod
```

**ngrok (for local Pub/Sub testing):**
```bash
ngrok http 3000

# Update the Pub/Sub push endpoint whenever ngrok URL changes:
gcloud pubsub subscriptions modify-push-config gmail-sub \
  --push-endpoint=https://<ngrok-url>/webhook/gmail
```

---

## Related Docs

- [`docs/gmail-pubsub-webhook.md`](./gmail-pubsub-webhook.md) — Full Gmail Pub/Sub setup guide, gotchas, and testing instructions
