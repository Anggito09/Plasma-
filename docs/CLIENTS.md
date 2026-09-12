# Multi-client: 1 database per kafe, tabel sama

Model: tiap kafe punya D1 + Worker sendiri. Skema (`drizzle/*.sql`) identik di semua client. Data tidak pernah tercampur karena database fisik terpisah.

## Client baru (1 perintah)

```sh
pnpm build
pnpm client:new kopi-sudirman
```

Skrip akan: buat D1 `trefiko-kopi-sudirman` → tulis `wrangler.kopi-sudirman.json` → migrasi remote → simpan `TREFIKO_SETUP_KEY` → deploy → catat di `clients.local.json` + tampilkan kunci setup sekali.

URL: `https://trefiko-kopi-sudirman.<subdomain>.workers.dev`. Beri kunci setup ke admin kafe, mereka setup nama kafe sendiri.

## Update semua client

```sh
pnpm build
pnpm clients:all        # migrasi + deploy semua
pnpm clients:migrate    # hanya migrasi
pnpm clients:deploy     # hanya deploy
```

## File yang tidak di-commit

- `clients.local.json` — registry DB ID semua client.
- `wrangler.<slug>.json` — config deploy per client.
- Kunci setup tiap client — simpan di password manager, jangan di repo/chat.

## Batas paket

- Free: maks 10 database → maks ~10 client.
- Paid ($5/bln): 50.000 database, 10 juta request/bln included.
- Pantau di dashboard: Workers & Pages → D1 → Metrics.
