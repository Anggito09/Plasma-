# Plasma

Cafe ordering and queue management with cashier, kitchen, receipt printing, and a voice-enabled TV display.

- Daily queue numbers reset at midnight in the cafe's Indonesian timezone, with no 999-order ceiling.
- Concurrent-safe numbering, idempotent order creation, and optimistic status updates.
- Cashier, kitchen, display, and administrator accounts with server-side permissions.
- Menu management, customer names, order notes, payment records, and 80 mm receipts.
- Live queue refresh, sequential Indonesian voice calls, recall, and rotating TV pages.
- Searchable daily history, sales summaries, cancellation reasons, and audit records.

**Stack:** React, TypeScript, Vinext, Cloudflare Workers, D1/SQLite, Drizzle, and Shadcn UI.

## Getting started

Requires Node.js 24 and the pnpm version declared in `package.json`.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm build
pnpm local:prepare
pnpm start
```

Open the URL printed by the server. For first setup, use the key generated in `.dev.vars`. Create the cafe and administrator, then add staff and display accounts in Settings. The local database is stored under `.wrangler/state`; keep it outside source control.

| Screen | Route |
| --- | --- |
| Cashier | `/` |
| Kitchen | `/dapur` |
| TV display | `/display` |
| Order history | `/riwayat` |
| Administration | `/pengaturan` |

```sh
pnpm typecheck
pnpm test
```

See [deployment](docs/DEPLOYMENT.md), [operation](docs/OPERATIONS.md), and [architecture and verification](docs/ARCHITECTURE.md).

Payment methods are recorded manually; payment gateways and direct ESC/POS printing are not integrated. Receipts use the browser print dialog. Voice availability depends on the browser and installed Indonesian voices. This repository contains one cafe installation; use separate deployments/databases for independent cafes.
