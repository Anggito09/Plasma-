# Deployment

Plasma is a server-backed app; GitHub Pages cannot host its API or database. The provided runtime targets Cloudflare Workers and D1. A separate database/deployment is required for each independent cafe.

## Local development (Windows, macOS, or Linux)

Install Node.js 24. Then run each command separately, including in PowerShell:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm build
pnpm local:prepare
pnpm start
```

`local:prepare` generates an ignored `.dev.vars` file containing a random setup key, prepares the local D1 database through tracked migrations, and copies the development variables beside the built Worker. Open `.dev.vars` locally, copy the setup key into the initial setup form, and create your administrator account. Never commit that file. No administrator or customer records are seeded automatically; the setup screen offers an optional editable sample menu.

`pnpm start` prints the local URL. Use a fresh build and run `pnpm local:prepare` after source/schema changes. Local data is under `.wrangler/state`, separate from hosted data. The local server is a development runtime, not a production service. `pnpm dev` is available for source development; local binding and secret loading are controlled by the starter's Vite integration.

## Cloudflare deployment under your account

Requires a Cloudflare account with Workers and D1 access. Run from a workstation with the Wrangler login available:

```sh
pnpm exec wrangler login
pnpm exec wrangler d1 create plasma
pnpm build
node scripts/configure-cloudflare.mjs YOUR_D1_DATABASE_ID
pnpm exec wrangler d1 migrations apply DB --remote --config wrangler.deploy.json
pnpm exec wrangler secret put PLASMA_SETUP_KEY --config wrangler.deploy.json
pnpm exec wrangler deploy --config wrangler.deploy.json
```

Use the real D1 ID returned by database creation. Set a long random setup key at the secret prompt and use it only to create the first administrator. The deployment config forces standalone mode, which disables the private Sites identity shortcut. Use HTTPS and do not configure a reverse proxy to inject unverified identity headers. Run the configuration script again after rebuilding, using the same database ID for the same installation. Do not overwrite a live database with a new empty one.

Before an update, back up the database and apply only new migrations. Generated migration files and metadata are append-only after deployment. To export a backup:

```sh
pnpm exec wrangler d1 export DB --remote --config wrangler.deploy.json --output plasma-backup.sql
```

The export contains customer names and operational records. Keep backups private and outside Git. Test restore in a separate database before using a backup for recovery.

## Private preview delivered with this project

The private preview is controlled by its owner-only gateway, in addition to Plasma's own login. Open it as the owner and complete the initial setup. Do not assume cafe staff can open that owner-only URL with their own accounts. For a cafe rollout, deploy under the cafe's hosting account and use Plasma's staff/display accounts there.

The preview's logical `DB` binding and project identity are recorded in `.openai/hosting.json`; real database resources and secrets are managed by its hosting platform. Keep this identity intact when editing the existing preview.

## Cafe installation checklist

- Configure cafe name and timezone correctly at setup.
- Create separate cashier, kitchen, and display accounts.
- Test several simultaneous cashier orders, the TV call queue, recall, and collection.
- Print a sample 80 mm receipt with the actual printer.
- Test a name with spaces and punctuation using the installed Indonesian voice.
- Test a temporary disconnect and retry without changing the pending order.
- Confirm staff sign in before each shift; sessions last 12 hours.
- Schedule backups in your hosting infrastructure and test recovery.
- Measure peak traffic on the chosen hosting plan before rollout. The included 1,250-order local test is a correctness check, not a production capacity guarantee.
