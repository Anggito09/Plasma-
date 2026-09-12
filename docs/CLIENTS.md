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

## Batas paket (koreksi)

- Free: 10 database, tapi request 100 rb/hari per akun habis oleh ~1 kafe (kasir/dapur poll 3 dtk + TV 1,5 dtk ≈ 65–115 rb/hari). Realistis: free hanya untuk 1 kafe demo, client ke-2 butuh Paid.
- Paid ($5/bln): 50.000 DB (bisa minta naik sampai jutaan), 10 jt request/bln included +$0,30/jt, rows read 25 M/bln included. Static asset gratis, hanya API polling yang dihitung.
- Estimasi 100 kafe ≈ 240 jt req/bln → ±$75/bln total (≈$0,75/kafe).
- Hemat: longgarkan TV ke 5–10 dtk, cursor delta sudah ada, pertimbangkan read replication. Bisa pangkas ~50%.
- Pantau di dashboard: Workers & Pages → D1 → Metrics.
