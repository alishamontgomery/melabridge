---
name: Ticket concurrency test fixtures
description: Durable constraints for testing atomic paid-ticket RPCs under parallel calls.
---

Concurrency regression scripts should seed isolated fixtures instead of relying on historical seed rows, because later cleanup migrations can remove those rows from a fully migrated database. Parallel calls that intentionally hit capacity or refund limits must tolerate worker exit failures and assert the committed database state afterward.

**Why:** A shell `wait` under `set -e` can stop the test on an expected rejected RPC, and a seed migration followed by cleanup makes fixed fixture assumptions silently invalid.

**How to apply:** Use deterministic test IDs, create the fixture before the run, use `wait || true` only around expected rejection groups, and verify order status, inventory, and attendee rows together.