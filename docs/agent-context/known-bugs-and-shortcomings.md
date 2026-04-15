# Known Bugs and Shortcomings

## Classification Risks
- Rule-based extraction can still miss edge cases where transactional and promotional language are mixed.
- Sender-domain checks are deterministic and may require ongoing tuning for new sender patterns.
- Amount parsing is regex-based and can misread numbers in rare templates.

## Current Trade-offs
- Precision is prioritized over recall to avoid polluting analytics with non-transaction emails.
- Primary inbox filtering excludes Promotions/Social/Forums; this can skip real transactions if Gmail mislabels them.

## Operational Gaps
- No dedicated unit test suite for transactionExtractor regressions yet.
- No replay harness for historical false-positive samples.
- Debug logs are available but not yet centralized into structured metrics dashboards.

## Data Model Constraints
- body/raw email content is not stored to reduce DB footprint, so deep post-hoc forensic debugging depends on live logs or external Gmail re-fetch.

## Recommended Improvements
1. Add fixture-based tests for known false positives and true positives.
2. Externalize sender allow/deny and promo keyword lists to config.
3. Add classification reason codes for observability.
4. Add scheduled drift review of extraction patterns.
