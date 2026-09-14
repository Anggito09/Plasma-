import { randomUUID } from 'node:crypto';

// Buat catatan pengeluaran dummy acak via API (tanpa SQL).
// Usage: node scripts/seed-expenses.mjs <baseUrl> <adminUser> <adminPass> [jumlah=20] [hari=7]
// Contoh: node scripts/seed-expenses.mjs https://app.temancipta.workers.dev ito <sandi-admin> 20 7
const [base, adminUser, adminPass, countArg, daysArg] = process.argv.slice(2);
if (!base || !adminUser || !adminPass) throw new Error('Usage: node scripts/seed-expenses.mjs <baseUrl> <adminUser> <adminPass> [jumlah] [hari]');
if (/[<>]|sandi|password/i.test(adminPass)) throw new Error('Ganti argumen sandi dengan SANDI ASLI akun admin (tanpa tanda < >).');
const COUNT = Math.min(Math.max(parseInt(countArg || '20', 10) || 20, 1), 100);
const DAYS = Math.min(Math.max(parseInt(daysArg || '7', 10) || 7, 1), 31);
const origin = new URL(base).origin;
let cookie = '';
async function api(path, body) {
  const r = await fetch(origin + '/api/' + path, {
    method: body ? 'POST' : 'GET',
    headers: { origin, ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const set = r.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0];
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(path + ': ' + (d.error || r.status));
  return d;
}
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const between = (min, max) => Math.round((min + Math.random() * (max - min)) / 1000) * 1000;
const NOTES = {
  bahan: ['Beras 5kg', 'Ayam 3kg', 'Kopi arabika 1kg', 'Susu UHT 6L', 'Gula aren 2kg', 'Telur 1 tray', 'Gas LPG 3kg', 'Es batu 2 balok', 'Teh melati 500g', 'Cokelat bubuk 1kg'],
  operasional: ['Listrik', 'Air galon 3x', 'Cup plastik 1 pak', 'Tisu & sedotan', 'Kantong takeaway', 'Sabun & lap'],
  gaji: ['Gaji harian kasir', 'Gaji harian dapur', 'Lembur mingguan'],
  lainnya: ['Servis blender', 'Ganti lampu', 'Kebersihan', 'Parkir langganan'],
};
const RANGE = { bahan: [50000, 450000], operasional: [20000, 200000], gaji: [50000, 150000], lainnya: [10000, 120000] };
const CATS = ['bahan', 'bahan', 'bahan', 'operasional', 'operasional', 'gaji', 'lainnya'];

await api('login', { username: adminUser.toLowerCase(), password: adminPass });
const me = await api('me');
console.log('Login sebagai ' + me.user.name + ' (' + me.user.role + ')');

const jakartaDay = (t) => { const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(t)); return ['year', 'month', 'day'].map(k => p.find(x => x.type === k).value).join('-'); };
let total = 0;
for (let i = 0; i < COUNT; i++) {
  const cat = pick(CATS);
  const day = jakartaDay(Date.now() - Math.floor(Math.random() * DAYS) * 86400000);
  const amount = between(...RANGE[cat]);
  await api('expenses', { id: randomUUID(), category: cat, note: pick(NOTES[cat]), amount, day });
  total += amount;
}
console.log(`${COUNT} pengeluaran dummy tersimpan (${DAYS} hari terakhir), total Rp${total.toLocaleString('id-ID')}.`);
console.log('Cek di halaman Keuangan dengan rentang tanggal yang sama.');
