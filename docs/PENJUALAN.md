# Penjualan Temancipta

## Vonis kesiapan

Layak dijual untuk **skala kecil/pilot (1–10 kafe)** setelah backup otomatis + 2FA + harga menutup cloud. Belum layak untuk puluhan kafe/enterprise sebelum ada monitoring, runbook support, dan ToS/privasi.

## Model jualan

| | Pola 1: akun milik klien (disarankan) | Pola 2: semua di akun kamu |
|---|---|---|
| Cloudflare | Klien bikin akun sendiri (gratis cukup untuk 1 kafe) | Akun kamu, upgrade Paid $5/bln |
| Domain | `kasir.namakafe.id` milik klien | Bisa milik klien atau kamu |
| Kamu jual | Setup + lisensi/support bulanan | Paket all-in per bulan |
| Batas | Tak terbatas (1 akun = 1 kafe) | Praktis s.d. ~10 kafe |
| Risiko | Data milik klien, tanggung jawab ringan | 1 akun jebol = semua klien kena |

Mulai pola 2 untuk 3–5 kafe pertama, pindah pola 1 di atas ~10 kafe. Demo (`app.temancipta.workers.dev`) tidak boleh dipakai kafe bayar.

## Template harga (angka estimasi, verifikasi di dashboard setelah 1 kafe jalan seminggu)

Asumsi per kafe/bln: ±2 jt request, ±10 jt rows read D1. Kurs $1 = Rp16.500.

| Komponen | 5 kafe (pola 2) | 10 kafe (pola 2) |
|---|---|---|
| Workers Paid $5 (10 jt req incl, +$0,30/jt) | $5 + $0 = $5 | $5 + $3 = $8 |
| Modal cloud per kafe | $1 ≈ Rp16.500 | $0,8 ≈ Rp13.200 |
| Domain .id (Rp150rb/th ÷ 12) | Rp12.500 | Rp12.500 |
| **Total modal per kafe** | **±Rp29.000** | **±Rp26.000** |
| Harga jual saran per kafe | Rp99.000 | Rp99.000 |
| Margin per kafe | ±Rp70.000 | ±Rp73.000 |

Setup fee sekali bayar: Rp500rb–1,5jt (domain, deploy, training, cetak QR). Pola 1: modal cloud $0 di kamu, tagih jasa Rp50–75rb/kafe/bln murni.

Awasi di dashboard: Workers → D1 → Metrics (rows read). Kalau overage D1 muncul, naikkan harga sebelum tambah klien.

## Checklist sebelum jual

- [x] Header keamanan API (nosniff, deny iframe, referrer, permissions)
- [x] Login: throttle 8x/15 mnt, cookie HttpOnly+SameSite, CSRF origin
- [x] Retry otomatis GET/POST 5xx (kecuali login)
- [x] Banner mode demo + `/api/health`
- [x] Peringatan domain palsu di halaman masuk
- [x] Keluar dari semua perangkat
- [x] Runbook `docs/RUNBOOK.md`
- [ ] Backup otomatis harian (skrip `npm run backup` sudah ada — pasang Task Scheduler)
- [ ] 2FA di akun Cloudflare + batasi akses API token
- [ ] Kunci setup dikirim privat, tidak lewat chat biasa
- [ ] Monitoring worker down (peringatan ke kamu, bukan ke klien)
- [ ] ToS + kebijakan privasi (data nama pelanggan & transaksi)
- [ ] Harga menutup cloud + margin (pakai template di atas)
