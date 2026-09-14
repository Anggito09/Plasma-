import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';

// Buat 20 pelanggan dummy (acak, selisih 5 menit, 1-3 jenis item).
// Usage: node scripts/seed-20.mjs <baseUrl> <adminUser> <adminPass>
// Contoh: node scripts/seed-20.mjs https://app.temancipta.workers.dev ito <sandi-admin>
// Lalu jalankan SQL yang dihasilkan:
//   wrangler d1 execute DB --remote --config wrangler.deploy.json --file ./scripts/seed-20-orders.sql
const [base, adminUser, adminPass] = process.argv.slice(2);
if (!base || !adminUser || !adminPass) throw new Error('Usage: node scripts/seed-20.mjs <baseUrl> <adminUser> <adminPass>');
if (/[<>]|sandi|password/i.test(adminPass)) throw new Error('Ganti argumen sandi dengan SANDI ASLI akun admin (tanpa tanda < >).');
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
const jakartaDay = (t) => { const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(t)); return ['year', 'month', 'day'].map(k => p.find(x => x.type === k).value).join('-'); };
const hex = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map(x => x.toString(16).padStart(2, '0')).join('');
const sql = (s) => String(s).replace(/'/g, "''");

await api('login', { username: adminUser.toLowerCase(), password: adminPass });
const me = await api('me');
console.log('Login sebagai ' + me.user.name + ' (' + me.user.role + ')');

const products = (await api('products')).products.filter(p => p.active);
if (!products.length) throw new Error('Tidak ada menu aktif.');
const names = ['Budi', 'Sari', 'Dewi', 'Agus', 'Rina', 'Doni', 'Maya', 'Fajar', 'Lina', 'Eko', 'Putri', 'Andi', 'Wulan', 'Yoga', 'Fitri', 'Hendra', 'Ratna', 'Dimas', 'Sinta', 'Bagus'].sort(() => Math.random() - 0.5);
const payOpts = ['Tunai', 'Tunai', 'QRIS', 'QRIS', 'Kartu'];
const statuses = [...Array(14).fill('completed'), ...Array(3).fill('ready'), ...Array(2).fill('preparing'), 'waiting'].sort(() => Math.random() - 0.5);
const now = Date.now();
const maxByDay = {};
const rows = names.map((customer, i) => {
  const created = now - (names.length - 1 - i) * 5 * 60000;
  const day = jakartaDay(created);
  const picked = [...products].sort(() => Math.random() - 0.5).slice(0, 1 + Math.floor(Math.random() * 3));
  const items = picked.map(p => ({ id: p.id, name: p.name, price: p.price, quantity: 1 + Math.floor(Math.random() * 2) }));
  const total = items.reduce((s, x) => s + x.price * x.quantity, 0);
  const status = statuses[i];
  const prepared = ['preparing', 'ready', 'completed'].includes(status) ? created + 2 * 60000 : null;
  const ready = ['ready', 'completed'].includes(status) ? created + 5 * 60000 : null;
  const done = status === 'completed' ? Math.min(created + 8 * 60000, now) : null;
  return { id: randomUUID(), day, customer, mode: Math.random() < 0.6 ? 'dine-in' : 'takeaway', items, note: '', total, payment: payOpts[Math.floor(Math.random() * payOpts.length)], status, created, prepared, ready, done };
});
for (const day of [...new Set(rows.map(r => r.day))]) {
  const h = await api(`history?day=${day}`);
  maxByDay[day] = Math.max(0, ...h.orders.map(o => o.number));
}
const values = rows.map(r => {
  maxByDay[r.day] += 1;
  return `('${r.id}','${r.day}',${maxByDay[r.day]},'${sql(r.customer)}','${r.mode}','${sql(JSON.stringify(r.items))}','','${r.total}','${sql(r.payment)}','${r.status}',${r.created},${r.created},'${me.user.id}','${hex(32)}',1,NULL,${r.prepared ?? 'NULL'},${r.ready ?? 'NULL'},${r.done ?? 'NULL'})`;
});
writeFileSync('scripts/seed-20-orders.sql', 'INSERT INTO orders(id,day,number,customer,mode,items,note,total,payment,status,created_at,updated_at,created_by,fingerprint,version,cancel_reason,prepared_at,ready_at,completed_at) VALUES\n' + values.join(',\n') + ';\n');
console.log('20 pesanan ditulis ke scripts/seed-20-orders.sql');
console.log('Lanjut: wrangler d1 execute DB --remote --config wrangler.deploy.json --file ./scripts/seed-20-orders.sql');
