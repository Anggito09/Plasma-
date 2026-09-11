# Architecture and verification

## Data flow

The React screens call same-origin API routes. The shared service in `core/service.mjs` validates requests and applies role checks. Cloudflare D1 stores cafe settings, users, hashed sessions, login attempts, menu items, orders, call events, and audit entries. Drizzle migrations define the schema; runtime handlers do not create tables.

Order numbers are allocated by one `INSERT … SELECT COALESCE(MAX(number), 0) + 1` statement scoped to the server-derived business date. SQLite serializes writes, and a unique `(day, number)` index enforces the invariant. Order creation and its audit record execute in a transactional D1 batch. A request UUID is the primary key and an input fingerprint detects reuse with different data.

Status transitions use a version check. An update succeeds only when the expected status and version still match. Marking ready and inserting its announcement occur in the same transaction. Each call request has a unique ID. Event polling uses a monotonic cursor and pages of 100 so a batch of calls is not silently truncated. The display rotates all waiting orders across pages of 12 and additional ready orders across pages of 4.

The active board queries outstanding orders across all dates. History uses date-indexed queries and 30-row pages. No order deletion or nightly cleanup resets numbering; historical records remain available. Prices and item names are snapshots; later menu edits do not alter saved receipts. Payments are manual records, not payment processor confirmations.

## Security boundaries

- Passwords use PBKDF2-SHA256 with 100,000 iterations and a random per-password salt. Cloudflare Workers' Web Crypto implementation supports this iteration count.
- Session tokens contain two random UUIDs; only their SHA-256 hashes are stored. Cookies are HTTP-only, SameSite=Strict, and Secure on HTTPS. Sessions expire after 12 hours.
- Every mutation requires matching Origin and JSON content type. Server-side permission checks protect all operational API actions.
- Login attempts are limited to 8 per username/IP in 15 minutes. Counter updates are atomic. This is an application safeguard, not a replacement for production edge rate limits.
- The first setup requires a setup secret on standalone deployments. Private Sites may use the verified identity supplied by their owner-only gateway. The deployment script explicitly disables that gateway shortcut for direct Cloudflare deployments.
- Parameterized SQL is used throughout. Customer text is rendered through React escaping, including receipts. Print pages do not inject untrusted HTML.
- Application records are shared within one cafe installation. This is not a multi-tenant SaaS platform.

## Automated verification

Run `pnpm test` (Node.js 24). The suite uses a real SQLite engine behind a D1-compatible adapter and the same API service used by the application. It covers:

1. Indonesian timezone boundaries and numbers above 999 and 9999.
2. 1,250 order submissions in batches of 25 concurrent API promises: all daily numbers unique and consecutive.
3. A midnight transition that restarts numbering and preserves 1,250 outstanding orders from yesterday.
4. Idempotent retries across midnight, concurrent duplicate requests, changed-payload rejection, and historical menu price snapshots.
5. Invalid status transitions, concurrent stale updates, ready-event atomicity, recall idempotency, and completion.
6. Quantity validation, server-calculated prices, menu availability, cancellation reasons, and cross-origin rejection.
7. Role restrictions, account revocation, setup reuse prevention, login throttling, and session expiry.
8. Literal wildcard searches, pagination, and reading more than 100 call events.

`pnpm typecheck` checks TypeScript. `pnpm build` compiles all application routes and the Worker.

These checks validate logic and compilation. The 1,250-order test is a local correctness test, not a measured production throughput SLA. No physical printer, TV, speaker, production-network load, or browser speech engine was available to these tests. Validate these on the intended cafe devices and deployment before relying on the system in a live shift. Peak throughput and latency depend on hosting limits, concurrent devices, active backlog size, and connectivity.

## Important operational limits

There is no payment gateway, offline write queue, inventory deduction, accounting ledger, direct ESC/POS driver, automatic refund, or multi-cafe tenant administration. Do not infer those capabilities from the payment, menu, or sales screens. TV speech uses browser voices; it is not server-generated audio. Back up the deployment database and rehearse recovery independently of daily number resets.
