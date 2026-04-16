# AI Agent Playbook for This Repository

## Objective
When modifying sync or extraction logic, protect analytics quality first: avoid false positives that classify newsletters/promotions as transactions.

## Safe Change Process
1. Read current behavior in EmailSyncService, DataProcessingPipeline, and TransactionExtractor.
2. Implement smallest possible change that preserves existing APIs.
3. Run npm run build after each focused patch set.
4. Validate with at least one known true-positive and one known false-positive sample.

## Repository Conventions
- Use TypeScript strict-compatible changes.
- Keep Mongoose writes idempotent via upsert keyed on userId + messageId.
- Avoid storing large raw email payloads unless explicitly requested.
- Prefer deterministic filters over broad fuzzy matching.

## High-Value Context
- Primary inbox scope: INBOX required, exclude CATEGORY_PROMOTIONS, CATEGORY_SOCIAL, CATEGORY_FORUMS.
- Transaction extraction should require strong evidence (amount + direction/reference signals).
- Promotional sender local-parts and offer/EMI phrases are strong reject indicators.

## Regression Checklist
- Build passes: npm run build.
- Initial sync query still applies primary inbox scope.
- Incremental sync still excludes non-primary categories.
- Promotional bank campaign emails do not produce transactionData.
- Genuine debit/credit alerts still produce transactionData.

## Common Pitfalls
- Adding generic keywords like paid/payment/spent without context can spike false positives.
- Relying on sender domain alone is insufficient for bank marketing traffic.
- Increasing confidence with no penalty path can silently reintroduce bad records.
