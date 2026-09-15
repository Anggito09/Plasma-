# Runbook demo & klien

## Sebelum demo
1. Ganti sandi admin (Pengaturan → Sandi) kalau sempat dikirim chat.
2. `npm run backup` — cek file muncul di `backups/`.
3. Buka `/api/health` harus `{ ok: true, demo: true }`.
4. Banner biru "Mode demo" harus tampil di app.temancipta.workers.dev.

## Saat demo error
| Gejala | Cek | Tindakan |
|---|---|---|
| "Menyambung…" terus | `/api/health` | Refresh. Kalau 503, Worker/D1 down. |
| Login 429 | 8 kali salah | Tunggu 15 menit. Jangan brute-force di depan klien. |
| Login 401 | Sandi | Reset via akun admin lain / restore backup. |
| Pesanan dobel | Kasir retry | Jangan buat pesanan baru. Cek Riwayat. |
| TV bisu | Browser | Aktifkan suara sekali, panggil ulang. |
| QRIS kosong | `public/qris.png` | Upload lalu deploy. |
| Analisa AI kosong | `/api/insights` | Fallback aturan tetap ada. Refresh. |

## Phishing
- URL resmi demo: `https://app.temancipta.workers.dev`
- Sandi tidak pernah diminta lewat WhatsApp/email.
- Login di domain lain memunculkan peringatan merah.
- Cookie HttpOnly + SameSite=Strict; CSRF origin dicek di setiap POST.

## Klien bayar (bukan demo)
1. Worker + D1 baru (`node scripts/provision-client.mjs`).
2. `TREFIKO_DEMO` jangan di-set (atau `false`).
3. Setup key privat, bukan chat biasa.
4. 2FA Cloudflare + backup harian Task Scheduler.
5. Uji restore 1x sebelum serah terima.

## Restore
```
npx wrangler d1 execute DB --remote --config wrangler.deploy.json --file backups/app-YYYYMMDDHHMM.sql
```
Hanya saat darurat. Konfirmasi nama file dulu.
