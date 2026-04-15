# Spendly Server Architecture

## Purpose
This service connects to Gmail, fetches user emails, filters for transaction-like messages, extracts transaction fields, and stores normalized records for analytics.

## Request Flow
1. API route triggers sync in EmailSyncService.
2. EmailSyncService chooses initialSync or incrementalSync based on GmailSync.lastHistoryId.
3. EmailSyncHelpers fetches message IDs and full message payloads from Gmail API.
4. DataProcessingPipeline parses headers/body, filters transaction candidates, transforms to normalized records.
5. Email model stores transaction-centric email rows keyed by userId + messageId.

## Main Modules
- index.ts: app bootstrap and route wiring.
- services/EmailSyncService.ts: orchestration for Gmail sync lifecycle.
- utils/emailSyncHelpers.ts: Gmail API pagination and batch fetch helpers.
- utils/dataProcessingPipeline.ts: parse/filter/transform persistence pipeline.
- utils/transactionExtractor.ts: rule-based transaction classification and extraction.
- models/emailModels.ts: Email persistence schema with transactionData sub-document.
- models/gmailSyncModels.ts: per-user sync checkpoints and status.

## Data Boundaries
- Current storage is transaction-focused. Raw email body and raw Gmail payload are intentionally not persisted to reduce DB load.
- TransactionData is persisted only when extraction confidence and rule checks pass.

## Gmail Scope Rules
- Initial sync query uses inbox-only with exclusions for promotions/social/forums.
- Incremental sync performs label-based primary filtering after history fetch.

## Failure and Recovery
- Sync status tracked in GmailSync (SYNCING, IDLE, FAILED).
- Gmail history expiry (410) falls back to initial sync.
- Duplicate-safe writes use upsert by (userId, messageId).
