import { digest, hashPassword, checkPassword, businessDay } from './security.mjs';
class HttpError extends Error {
    constructor(status, message) { super(message); this.status = status; }
}
const fail = (s, m) => { throw new HttpError(s, m); };
const str = (x, max = 100, min = 1) => { if (typeof x !== 'string' || x.trim().length < min || x.trim().length > max)
    fail(400, 'Isian tidak valid atau terlalu panjang.'); return x.trim(); };
const uuid = x => { if (typeof x !== 'string' || !/^[0-9a-f-]{36}$/i.test(x))
    fail(400, 'ID permintaan tidak valid.'); return x; };
const int = (x, min, max) => { if (!Number.isSafeInteger(x) || x < min || x > max)
    fail(400, 'Nilai angka tidak valid.'); return x; };
const oneOf = (x, values) => { if (!values.includes(x))
    fail(400, 'Pilihan tidak valid.'); return x; };
const publicUser = u => ({ id: u.id, name: u.name, username: u.username, role: u.role });
const isFoodCat = c => /makan|roti|kue|snack|food|bakery|cake|pastry|dessert/i.test(c || '');
const targets = c => ({ all: Number.isSafeInteger(c.target_ready_min) ? c.target_ready_min : 10, food: Number.isSafeInteger(c.target_food_min) ? c.target_food_min : 15, drink: Number.isSafeInteger(c.target_drink_min) ? c.target_drink_min : 5, tax: Number.isSafeInteger(c.tax_pct) ? Math.min(Math.max(c.tax_pct, 0), 50) : 0, service: Number.isSafeInteger(c.service_pct) ? Math.min(Math.max(c.service_pct, 0), 50) : 0 });
const parseOrder = o => o ? ({ ...o, items: JSON.parse(o.items), fingerprint: undefined }) : null;
const json = (data, status = 200, headers = {}) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });
export function createService(db, { clock = () => Date.now(), setupKey = '', trustedSetup = false, ai = null } = {}) {
    const q = (sql, ...args) => db.prepare(sql).bind(...args);
    const audit = (user, action, target, now) => q('INSERT INTO audit(actor,action,target,created_at) VALUES (?,?,?,?)', user.id, action, target, now);
    return async function handle(request) {
        try {
            const url = new URL(request.url), path = url.pathname.replace(/^\/api\/?/, ''), method = request.method, now = clock();
            let body = {};
            if (method !== 'GET') {
                const origin = request.headers.get('origin');
                if (!origin || origin !== url.origin)
                    fail(403, 'Asal permintaan tidak diizinkan.');
                if (!request.headers.get('content-type')?.startsWith('application/json'))
                    fail(415, 'Gunakan format JSON.');
                const raw = await request.text();
                if (raw.length > 32000)
                    fail(413, 'Pesanan terlalu besar.');
                try {
                    body = JSON.parse(raw);
                }
                catch {
                    fail(400, 'Data JSON tidak valid.');
                }
                if (!body || typeof body !== 'object' || Array.isArray(body))
                    fail(400, 'Data tidak valid.');
            }
            const config = await q('SELECT * FROM settings WHERE id=1').first();
            if (path === 'bootstrap' && method === 'GET')
                return json({ configured: !!config });
            if (path === 'setup' && method === 'POST') {
                if (config)
                    fail(409, 'Aplikasi sudah dikonfigurasi. Silakan masuk.');
                if (!trustedSetup && (!setupKey || body.setupKey !== setupKey))
                    fail(403, 'Kunci setup diperlukan. Gunakan TREFIKO_SETUP_KEY dari pengelola server.');
                const username = str(body.username, 40).toLowerCase();
                if (!/^[a-z0-9._-]+$/.test(username))
                    fail(400, 'Username hanya huruf, angka, titik, garis bawah, atau tanda hubung.');
                const password = str(body.password, 128, 10), name = str(body.name, 80), cafe = str(body.cafe, 80);
                const timezone = oneOf(body.timezone, ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura']);
                const hash = await hashPassword(password), id = crypto.randomUUID();
                const statements = [q('INSERT INTO settings(id,name,timezone,footer) VALUES(1,?,?,?)', cafe, timezone, 'Terima kasih. Silakan tunggu nomor dan nama Anda dipanggil.'), q('INSERT INTO users(id,username,name,password,role) VALUES(?,?,?,?,?)', id, username, name, hash, 'admin')];
                if (body.sampleMenu === true)
                    for (const [name, category, price] of [['Espresso', 'Kopi', 22000], ['Americano', 'Kopi', 26000], ['Caffe Latte', 'Kopi', 32000], ['Cappuccino', 'Kopi', 32000], ['Kopi Susu Gula Aren', 'Kopi', 28000], ['Kopi Tubruk', 'Kopi', 20000], ['Vietnam Drip', 'Kopi', 25000], ['Cold Brew', 'Kopi', 30000], ['Teh Manis', 'Teh', 15000], ['Teh Hijau Melati', 'Teh', 20000], ['Lemon Tea', 'Teh', 24000], ['Teh Leci', 'Teh', 26000], ['Matcha Latte', 'Non-kopi', 34000], ['Cokelat', 'Non-kopi', 30000], ['Susu Jahe', 'Non-kopi', 25000], ['Vanilla Milk', 'Non-kopi', 28000], ['Soda Gembira', 'Non-kopi', 28000], ['Lemon Squash', 'Non-kopi', 26000], ['Nasi Goreng', 'Makanan', 35000], ['Mie Goreng', 'Makanan', 32000], ['Ayam Goreng + Nasi', 'Makanan', 38000], ['Soto Ayam', 'Makanan', 30000], ['Salad Sayur', 'Makanan', 28000], ['French Fries', 'Makanan', 25000], ['Butter Croissant', 'Roti & Kue', 28000], ['Roti Bakar Cokelat', 'Roti & Kue', 25000], ['Pisang Goreng', 'Roti & Kue', 22000], ['Donat Glaze', 'Roti & Kue', 18000], ['Chocolate Brownie', 'Roti & Kue', 30000], ['Kukis Cokelat', 'Roti & Kue', 20000]])
                        statements.push(q('INSERT INTO products(id,name,category,price) VALUES(?,?,?,?)', crypto.randomUUID(), name, category, price));
                try {
                    await db.batch(statements);
                }
                catch (e) {
                    if ((await q('SELECT id FROM settings WHERE id=1').first()))
                        fail(409, 'Setup telah selesai di perangkat lain. Silakan masuk.');
                    throw e;
                }
                return json({ ok: true }, 201);
            }
            if (!config)
                fail(503, 'Selesaikan pengaturan awal aplikasi.');
            if (path === 'login' && method === 'POST') {
                const username = str(body.username, 40).toLowerCase(), password = str(body.password, 128);
                const ip = request.headers.get('cf-connecting-ip') || 'local';
                const key = await digest(ip + '|' + username);
                const attempt = await q('INSERT INTO attempts(key,count,until) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN until<=? THEN 1 ELSE count+1 END,until=CASE WHEN until<=? THEN excluded.until ELSE until END RETURNING count', key, now + 900000, now, now).first();
                if (attempt.count > 8)
                    fail(429, 'Terlalu banyak percobaan. Coba lagi setelah 15 menit.');
                const u = await q('SELECT * FROM users WHERE username=? AND active=1', username).first();
                const match = await checkPassword(password, u?.password || 'temancipta-dummy:0000000000000000000000000000000000000000000000000000000000000000');
                if (!u || !match)
                    fail(401, 'Username atau kata sandi salah.');
                const token = crypto.randomUUID() + crypto.randomUUID();
                await db.batch([q('INSERT INTO sessions(token,user_id,expires) VALUES(?,?,?)', await digest(token), u.id, now + 43200000), q('DELETE FROM attempts WHERE key=? OR until<?', key, now), q('DELETE FROM sessions WHERE expires<?', now)]);
                return json({ user: publicUser(u) }, 200, { 'Set-Cookie': `temancipta_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${url.protocol === 'https:' ? '; Secure' : ''}` });
            }
            const token = request.headers.get('cookie')?.split(';').map(s => s.trim()).find(s => s.startsWith('temancipta_session='))?.slice('temancipta_session='.length);
            const user = token ? await q('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>? AND u.active=1', await digest(token), now).first() : null;
            if (!user)
                fail(401, 'Silakan masuk untuk melanjutkan.');
            const allow = (...roles) => { if (!roles.includes(user.role))
                fail(403, 'Akun ini tidak memiliki akses untuk tindakan tersebut.'); };
            const day = businessDay(now, config.timezone);
            if (path === 'me' && method === 'GET')
                return json({ user: publicUser(user), config, day, serverTime: now });
            if (path === 'logout' && method === 'POST') {
                await q('DELETE FROM sessions WHERE token=?', await digest(token)).run();
                return json({ ok: true }, 200, { 'Set-Cookie': 'temancipta_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
            }
            if (path === 'products' && method === 'GET') {
                allow('admin', 'cashier', 'kitchen');
                return json({ products: (await q('SELECT * FROM products ORDER BY category,name').all()).results });
            }
            if (path === 'payments' && method === 'GET') {
                allow('admin', 'cashier');
                try {
                    await db.batch([q(`INSERT OR IGNORE INTO payments(id,name,active) VALUES('pay-tunai','Tunai',1),('pay-qris','QRIS',1),('pay-kartu','Kartu',1)`)]);
                    return json({ payments: (await q(`SELECT * FROM payments ORDER BY CASE WHEN name IN ('Tunai','QRIS','Kartu') THEN 0 ELSE 1 END, name`).all()).results });
                } catch { return json({ payments: [] }); }
            }
            if (path === 'payments' && method === 'POST') {
                allow('admin');
                const id = body.id ? uuid(body.id) : crypto.randomUUID(), name = str(body.name, 40);
                const dup = await q('SELECT id FROM payments WHERE name=?', name).first();
                if (dup && dup.id !== id) fail(409, 'Nama metode sudah dipakai.');
                await db.batch([q('INSERT INTO payments(id,name,active) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,active=excluded.active', id, name, body.active === false ? 0 : 1), audit(user, 'payment.save', id, now)]);
                return json({ ok: true, id });
            }
            if (path === 'products' && method === 'POST') {
                allow('admin', 'cashier');
                const id = body.id ? uuid(body.id) : crypto.randomUUID(), name = str(body.name, 80), category = str(body.category, 40), price = int(body.price, 0, 100000000), active = body.active === false ? 0 : 1;
                const img = body.img === undefined || body.img === null || body.img === '' ? '' : str(String(body.img), 500);
                if (img && !/^https?:\/\//i.test(img)) fail(400, 'Foto harus URL http(s).');
                await db.batch([q('INSERT INTO products(id,name,category,price,active,img) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,category=excluded.category,price=excluded.price,active=excluded.active,img=excluded.img', id, name, category, price, active, img), audit(user, 'product.save', id, now)]);
                return json({ ok: true, id });
            }
            if (path === 'orders' && method === 'POST') {
                allow('admin', 'cashier');
                const id = uuid(body.id), customer = str(body.customer, 60), mode = oneOf(body.mode, ['dine-in', 'takeaway']), note = str(body.note || '', 300, 0);
                let methods = [];
                try { methods = (await q('SELECT name FROM payments WHERE active=1').all()).results.map(p => p.name); } catch { methods = []; }
                const payment = oneOf(String(body.payment || '').trim().slice(0, 40), methods.length ? methods : ['Tunai', 'QRIS', 'Kartu']);
                if (!Array.isArray(body.items) || !body.items.length || body.items.length > 50)
                    fail(400, 'Pilih 1–50 menu.');
                const selected = body.items.map(i => ({ id: uuid(i.id), quantity: int(i.quantity, 1, 99) }));
                if (new Set(selected.map(i => i.id)).size !== selected.length)
                    fail(400, 'Menu duplikat. Gabungkan jumlahnya.');
                const t = targets(config);
                const products = (await q(`SELECT * FROM products WHERE active=1 AND id IN (${selected.map(() => '?').join(',')})`, ...selected.map(i => i.id)).all()).results;
                const items = selected.map(i => { const p = products.find(p => p.id === i.id); if (!p)
                    fail(409, 'Menu sudah berubah atau tidak tersedia. Muat ulang menu.'); return { id: p.id, name: p.name, price: p.price, quantity: i.quantity }; });
                const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
                int(subtotal, 0, 2000000000);
                const discount = body.discount === undefined || body.discount === '' || body.discount === null ? 0 : int(Number(body.discount), 0, subtotal);
                const service = Math.round((subtotal - discount) * t.service / 100);
                const tax = Math.round((subtotal - discount + service) * t.tax / 100);
                const total = subtotal - discount + service + tax;
                int(total, 0, 2000000000);
                if(body.expectedTotal !== undefined && body.expectedTotal !== total) fail(409, "Harga menu berubah. Total sudah diperbarui; periksa pembayaran sebelum menyimpan ulang.");
                const fingerprint = await digest(JSON.stringify({ customer, mode, payment, note, items: selected, discount }));
                const existing = await q('SELECT * FROM orders WHERE id=?', id).first();
                if (existing) {
                    if (existing.fingerprint !== fingerprint)
                        fail(409, 'Permintaan sebelumnya berbeda. Periksa riwayat sebelum membuat pesanan baru.');
                    return json({ order: parseOrder(existing), replayed: true });
                }
                const results = await db.batch([
                    q(`INSERT INTO orders(id,day,number,customer,mode,items,note,total,payment,status,created_at,updated_at,created_by,fingerprint,discount_rp,service_rp,tax_rp)
        SELECT ?,?,COALESCE(MAX(number),0)+1,?,?,?,?,?,?,'waiting',?,?,?,?,?,?,? FROM orders WHERE day=? ON CONFLICT(id) DO NOTHING`, id, day, customer, mode, JSON.stringify(items), note, total, payment, now, now, user.id, fingerprint, discount, service, tax, day),
                    q("INSERT INTO audit(actor,action,target,created_at) SELECT ?,'order.create',?,? WHERE changes()=1", user.id, id, now),
                    q('SELECT * FROM orders WHERE id=?', id)
                ]);
                const order = results[2].results[0];
                if (order.fingerprint !== fingerprint)
                    fail(409, 'ID pesanan sudah digunakan untuk data berbeda.');
                return json({ order: parseOrder(order) }, results[0].meta.changes ? 201 : 200);
            }
            if (path === 'board' && method === 'GET') {
                // Active orders from every date survive midnight; completed records are paginated separately.
                const active = (await q("SELECT * FROM orders WHERE status IN ('waiting','preparing','ready') ORDER BY created_at").all()).results;
                const stats = await q("SELECT COUNT(*) AS total,COALESCE(SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END),0) AS completed,COALESCE(SUM(CASE WHEN status!='cancelled' THEN total ELSE 0 END),0) AS sales FROM orders WHERE day=?", day).first();
                const latest = await q('SELECT COALESCE(MAX(id),0) AS id FROM events').first();
                return json({ orders: user.role === 'display' ? active.map(o => ({ id: o.id, number: o.number, day: o.day, customer: o.customer, status: o.status, created_at: o.created_at })) : active.map(parseOrder), stats: user.role === 'display' ? undefined : stats, latestEvent: latest.id, day, serverTime: now });
            }
            if (path === 'events' && method === 'GET') {
                const after = int(Number(url.searchParams.get('after') || 0), 0, Number.MAX_SAFE_INTEGER);
                return json({ events: (await q("SELECT e.*,o.status FROM events e JOIN orders o ON e.order_id=o.id WHERE e.id>? ORDER BY e.id LIMIT 100", after).all()).results });
            }
            if (path === 'orders/action' && method === 'POST') {
                const id = uuid(body.id), requestId = uuid(body.requestId), action = oneOf(body.action, ['prepare', 'ready', 'recall', 'complete', 'cancel']);
                if (action === 'cancel')
                    allow('admin', 'cashier');
                else
                    allow('admin', 'cashier', 'kitchen');
                const order = await q('SELECT * FROM orders WHERE id=?', id).first();
                if (!order)
                    fail(404, 'Pesanan tidak ditemukan.');
                if (action === 'ready' || action === 'recall') {
                    const event = await q('SELECT * FROM events WHERE request_id=?', requestId).first();
                    if (event) {
                        if (event.order_id !== id)
                            fail(409, 'ID panggilan sudah dipakai.');
                        return json({ ok: true, replayed: true });
                    }
                }
                if (action === 'recall') {
                    const result = await db.batch([q("INSERT INTO events(request_id,order_id,day,number,customer,created_at) SELECT ?,id,day,number,customer,? FROM orders WHERE id=? AND status='ready' ON CONFLICT(request_id) DO NOTHING", requestId, now, id), q("INSERT INTO audit(actor,action,target,created_at) SELECT ?,'order.recall',?,? WHERE changes()=1", user.id, id, now)]);
                    if (!result[0].meta.changes)
                        fail(409, 'Pesanan sudah diambil atau belum siap.');
                    return json({ ok: true });
                }
                const transitions = { prepare: ['waiting', 'preparing'], ready: ['preparing', 'ready'], complete: ['ready', 'completed'], cancel: [order.status, 'cancelled'] };
                const [from, to] = transitions[action];
                if (action === 'cancel' && !['waiting', 'preparing', 'ready'].includes(order.status))
                    fail(409, 'Pesanan ini tidak dapat dibatalkan.');
                if (order.status !== from)
                    fail(409, 'Status telah berubah. Muat ulang antrean.');
                const version = int(body.version, 1, Number.MAX_SAFE_INTEGER), reason = action === 'cancel' ? str(body.reason, 200) : null;
                const stamp = action === 'prepare' ? ',prepared_at=COALESCE(prepared_at,?)' : action === 'ready' ? ',ready_at=COALESCE(ready_at,?)' : action === 'complete' ? ',completed_at=COALESCE(completed_at,?)' : '';
                const statements = [q(`UPDATE orders SET status=?,updated_at=?,version=version+1,cancel_reason=?${stamp} WHERE id=? AND status=? AND version=?`, to, now, reason, ...(stamp ? [now] : []), id, from, version)];
                if (action === 'ready')
                    statements.push(q('INSERT INTO events(request_id,order_id,day,number,customer,created_at) SELECT ?,?,?,?,?,? WHERE changes()=1', requestId, id, order.day, order.number, order.customer, now));
                statements.push(q('INSERT INTO audit(actor,action,target,created_at) SELECT ?,?,?,? WHERE changes()=1', user.id, 'order.' + action, id, now));
                const result = await db.batch(statements);
                if (!result[0].meta.changes)
                    fail(409, 'Pesanan diubah oleh petugas lain. Muat ulang antrean.');
                return json({ ok: true });
            }
            if (path === 'history' && method === 'GET') {
                allow('admin', 'cashier');
                const date = url.searchParams.get('day') || day;
                if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
                    fail(400, 'Tanggal tidak valid.');
                const page = int(Number(url.searchParams.get('page') || 1), 1, 100000), search = (url.searchParams.get('search') || '').slice(0, 60);
                const where = "day=? AND (customer LIKE ? ESCAPE '\\' OR CAST(number AS TEXT)=?)";
                const safe = '%' + search.replace(/[\\%_]/g, '\\$&') + '%';
                const values = [date, safe, search.replace(/^A0*/i, '')];
                const count = await q('SELECT COUNT(*) AS count FROM orders WHERE ' + where, ...values).first();
                const rows = await q('SELECT * FROM orders WHERE ' + where + ' ORDER BY created_at DESC LIMIT 30 OFFSET ?', ...values, (page - 1) * 30).all();
                const summary = await q("SELECT COUNT(*) AS orders,COALESCE(SUM(CASE WHEN status!='cancelled' THEN total ELSE 0 END),0) AS sales,COALESCE(SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END),0) AS cancelled FROM orders WHERE day=?", date).first();
                const timing = await q("SELECT COALESCE(AVG(CASE WHEN ready_at IS NOT NULL THEN ready_at-created_at END),0) AS avg_ready,COALESCE(AVG(CASE WHEN completed_at IS NOT NULL AND ready_at IS NOT NULL THEN completed_at-ready_at END),0) AS avg_take,COUNT(CASE WHEN ready_at IS NOT NULL THEN 1 END) AS n_ready FROM orders WHERE day=?", date).first();
                const durs = (await q('SELECT ready_at-created_at AS d FROM orders WHERE day=? AND ready_at IS NOT NULL AND ready_at>=created_at ORDER BY d', date).all()).results.map(r => r.d);
                const medianReady = durs.length ? durs[Math.floor(durs.length / 2)] : 0;
                const tg = targets(config);
                const targetMin = tg.all;
                const prodCats = (await q('SELECT id,category FROM products').all()).results;
                const foodIds = new Set(prodCats.filter(p => isFoodCat(p.category)).map(p => p.id));
                const rowTarget = itemsJson => { try { return JSON.parse(itemsJson).some(i => foodIds.has(i.id)) ? tg.food : tg.drink; } catch { return tg.all; } };
                const readyRows = (await q('SELECT items,ready_at,created_at FROM orders WHERE day=? AND ready_at IS NOT NULL', date).all()).results;
                const nOnTarget = readyRows.filter(r => r.ready_at >= r.created_at && r.ready_at - r.created_at <= rowTarget(r.items) * 60000).length;
                const slowest = (await q('SELECT number,customer,ready_at-created_at AS wait FROM orders WHERE day=? AND ready_at IS NOT NULL ORDER BY wait DESC LIMIT 10', date).all()).results;
                const perCustomer = (await q("SELECT customer,COUNT(*) AS n,COALESCE(SUM(CASE WHEN status!='cancelled' THEN total ELSE 0 END),0) AS spent,AVG(CASE WHEN ready_at IS NOT NULL AND ready_at>=created_at THEN ready_at-created_at END) AS avgwait,MAX(CASE WHEN ready_at IS NOT NULL AND ready_at>=created_at THEN ready_at-created_at END) AS maxwait FROM orders WHERE day=? GROUP BY customer HAVING avgwait IS NOT NULL ORDER BY avgwait DESC LIMIT 8", date).all()).results;
                const tzOff = config.timezone === 'Asia/Makassar' ? 8 * 3600000 : config.timezone === 'Asia/Jayapura' ? 9 * 3600000 : 7 * 3600000;
                const perHour = (await q("SELECT CAST(((created_at + ?) / 3600000) % 24 AS INTEGER) AS h,COUNT(*) AS n,AVG(CASE WHEN ready_at IS NOT NULL AND ready_at>=created_at THEN ready_at-created_at END) AS avgwait FROM orders WHERE day=? AND status!='cancelled' GROUP BY h ORDER BY h", tzOff, date).all()).results;
                const perStaff = (await q("SELECT o.created_by AS id,COALESCE(u.name,'-') AS name,COUNT(*) AS n,COALESCE(SUM(CASE WHEN o.status!='cancelled' THEN o.total ELSE 0 END),0) AS sales,AVG(CASE WHEN o.ready_at IS NOT NULL AND o.ready_at>=o.created_at THEN o.ready_at-o.created_at END) AS avgwait FROM orders o LEFT JOIN users u ON u.id=o.created_by WHERE o.day=? AND o.status!='cancelled' GROUP BY o.created_by HAVING avgwait IS NOT NULL ORDER BY avgwait ASC LIMIT 8", date).all()).results;
                return json({ orders: rows.results.map(parseOrder), count: count.count, page, summary: { ...summary, avgReady: timing.avg_ready, avgTake: timing.avg_take, nReady: timing.n_ready, medianReady, perCustomer, perHour, perStaff, targetMin, targetFood: tg.food, targetDrink: tg.drink, nOnTarget, slowest } });
            }
            if (path === 'settings' && method === 'POST') {
                allow('admin');
                const name = str(body.name, 80), footer = str(body.footer, 200, 0);
                const target = body.target === undefined || body.target === '' ? (Number.isSafeInteger(config.target_ready_min) ? config.target_ready_min : 10) : int(Number(body.target), 1, 180);
                const keep = v => Number.isSafeInteger(v) ? v : 0;
                const targetFood = body.targetFood === undefined || body.targetFood === '' ? keep(config.target_food_min) || 15 : int(Number(body.targetFood), 1, 180);
                const targetDrink = body.targetDrink === undefined || body.targetDrink === '' ? keep(config.target_drink_min) || 5 : int(Number(body.targetDrink), 1, 180);
                const taxPct = body.taxPct === undefined || body.taxPct === '' ? keep(config.tax_pct) : int(Number(body.taxPct), 0, 50);
                const servicePct = body.servicePct === undefined || body.servicePct === '' ? keep(config.service_pct) : int(Number(body.servicePct), 0, 50);
                await db.batch([q('UPDATE settings SET name=?,footer=?,target_ready_min=?,target_food_min=?,target_drink_min=?,tax_pct=?,service_pct=? WHERE id=1', name, footer, target, targetFood, targetDrink, taxPct, servicePct), audit(user, 'settings.update', '1', now)]);
                return json({ ok: true });
            }
            if (path === 'users' && method === 'GET') {
                allow('admin');
                return json({ users: (await q('SELECT id,username,name,role,active FROM users ORDER BY name').all()).results });
            }
            if (path === 'users' && method === 'POST') {
                allow('admin');
                const username = str(body.username, 40).toLowerCase();
                if (!/^[a-z0-9._-]+$/.test(username))
                    fail(400, 'Format username tidak valid.');
                const name = str(body.name, 80), role = oneOf(body.role, ['cashier', 'kitchen', 'display']), password = str(body.password, 128, 10), id = crypto.randomUUID();
                if (await q('SELECT id FROM users WHERE username=?', username).first())
                    fail(409, 'Username sudah dipakai.');
                await db.batch([q('INSERT INTO users(id,username,name,role,password) VALUES(?,?,?,?,?)', id, username, name, role, await hashPassword(password)), audit(user, 'user.create', id, now)]);
                return json({ ok: true }, 201);
            }
            if (path === 'users/access' && method === 'POST') {
                allow('admin');
                const id = uuid(body.id);
                if (id === user.id)
                    fail(400, 'Akun sendiri tidak dapat dinonaktifkan.');
                const target = await q('SELECT id,role FROM users WHERE id=?', id).first();
                if (!target || target.role === 'admin')
                    fail(400, 'Akun ini tidak dapat diubah.');
                await db.batch([q('UPDATE users SET active=? WHERE id=?', body.active === true ? 1 : 0, id), q('DELETE FROM sessions WHERE user_id=?', id), audit(user, 'user.access', id, now)]);
                return json({ ok: true });
            }
            if (path === 'password' && method === 'POST') {
                const old = str(body.current, 128), password = str(body.password, 128, 10);
                if (!await checkPassword(old, user.password))
                    fail(400, 'Kata sandi lama salah.');
                await db.batch([q('UPDATE users SET password=? WHERE id=?', await hashPassword(password), user.id), q('DELETE FROM sessions WHERE user_id=?', user.id), audit(user, 'user.password', user.id, now)]);
                return json({ ok: true });
            }
            if (path === 'audit' && method === 'GET') {
                allow('admin');
                return json({ entries: (await q('SELECT a.*,u.name FROM audit a LEFT JOIN users u ON u.id=a.actor ORDER BY a.id DESC LIMIT 100').all()).results });
            }
            if (path === 'finance' && method === 'GET') {
                allow('admin');
                const from = url.searchParams.get('from') || day, to = url.searchParams.get('to') || day;
                if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to)
                    fail(400, 'Rentang tanggal tidak valid.');
                const sales = await q("SELECT day,COUNT(*) AS orders,COALESCE(SUM(total),0) AS sales FROM orders WHERE day>=? AND day<=? AND status!='cancelled' GROUP BY day ORDER BY day", from, to).all();
                const spent = await q('SELECT day,category,COUNT(*) AS count,COALESCE(SUM(amount),0) AS total FROM expenses WHERE day>=? AND day<=? GROUP BY day,category ORDER BY day', from, to).all();
                const expenses = await q('SELECT e.*,u.name AS author FROM expenses e LEFT JOIN users u ON u.id=e.created_by WHERE e.day>=? AND e.day<=? ORDER BY e.day DESC,e.created_at DESC LIMIT 200', from, to).all();
                return json({ from, to, sales: sales.results, spent: spent.results, expenses: expenses.results });
            }
            if (path === 'expenses' && method === 'POST') {
                allow('admin');
                const id = body.id ? uuid(body.id) : crypto.randomUUID();
                const category = oneOf(body.category, ['bahan', 'operasional', 'gaji', 'lainnya']);
                const note = str(body.note || '', 120, 0), amount = int(body.amount, 1, 2000000000);
                const expenseDay = typeof body.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.day) ? body.day : day;
                await db.batch([q('INSERT INTO expenses(id,day,category,note,amount,created_at,created_by) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET day=excluded.day,category=excluded.category,note=excluded.note,amount=excluded.amount', id, expenseDay, category, note || category, amount, now, user.id), audit(user, 'expense.save', id, now)]);
                return json({ ok: true, id });
            }
            if (path === 'expenses/delete' && method === 'POST') {
                allow('admin');
                const id = uuid(body.id);
                await db.batch([q('DELETE FROM expenses WHERE id=?', id), audit(user, 'expense.delete', id, now)]);
                return json({ ok: true });
            }
            if (path === 'insights' && method === 'GET') {
                allow('admin');
                const from = url.searchParams.get('from') || day, to = url.searchParams.get('to') || day;
                if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to)
                    fail(400, 'Rentang tanggal tidak valid.');
                const days = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
                if (days > 93)
                    fail(400, 'Maksimal 93 hari.');
                const agg = await q("SELECT COUNT(*) AS orders,COALESCE(SUM(total),0) AS sales FROM orders WHERE day>=? AND day<=? AND status!='cancelled'", from, to).first();
                agg.cancelled = (await q("SELECT COUNT(*) AS n FROM orders WHERE day>=? AND day<=? AND status='cancelled'", from, to).first()).n;
                const perDay = (await q("SELECT day,COUNT(*) AS orders,COALESCE(SUM(total),0) AS sales FROM orders WHERE day>=? AND day<=? AND status!='cancelled' GROUP BY day ORDER BY day", from, to).all()).results;
                const paymix = (await q("SELECT payment,COUNT(*) AS n FROM orders WHERE day>=? AND day<=? AND status!='cancelled' GROUP BY payment ORDER BY n DESC", from, to).all()).results;
                const tg = targets(config);
                const targetMin = tg.all;
                const timing = await q("SELECT COALESCE(AVG(CASE WHEN ready_at IS NOT NULL THEN ready_at-created_at END),0) AS avg_ready,COUNT(CASE WHEN ready_at IS NOT NULL THEN 1 END) AS n_ready FROM orders WHERE day>=? AND day<=?", from, to).first();
                const medianRows = (await q('SELECT ready_at-created_at AS d FROM orders WHERE day>=? AND day<=? AND ready_at IS NOT NULL AND ready_at>=created_at ORDER BY d', from, to).all()).results.map(r => r.d);
                const medianReady = medianRows.length ? medianRows[Math.floor(medianRows.length / 2)] : 0;
                const prodCats = (await q('SELECT id,category FROM products').all()).results;
                const foodIds = new Set(prodCats.filter(p => isFoodCat(p.category)).map(p => p.id));
                const rowIsFood = itemsJson => { try { return JSON.parse(itemsJson).some(i => foodIds.has(i.id)); } catch { return false; } };
                const itemRows = (await q("SELECT day,items,ready_at,created_at FROM orders WHERE day>=? AND day<=? AND status!='cancelled' LIMIT 3000", from, to).all()).results;
                const items = {};
                const waitByMenu = {};
                const dayMix = {};
                let nOn = 0;
                for (const r of itemRows) {
                    let wait = r.ready_at != null && r.created_at != null && r.ready_at >= r.created_at ? r.ready_at - r.created_at : null;
                    const food = rowIsFood(r.items);
                    const lim = (food ? tg.food : tg.drink) * 60000;
                    if (wait != null) {
                        dayMix[r.day] = dayMix[r.day] || { ready: 0, on: 0 };
                        dayMix[r.day].ready += 1;
                        if (wait <= lim) { dayMix[r.day].on += 1; nOn += 1; }
                    }
                    try {
                        for (const i of JSON.parse(r.items)) {
                            const name = String(i.name || '').slice(0, 60);
                            if (!name) continue;
                            items[name] = items[name] || { name, qty: 0, revenue: 0 };
                            items[name].qty += i.quantity || 0;
                            items[name].revenue += (i.quantity || 0) * (i.price || 0);
                            if (wait != null) {
                                waitByMenu[name] = waitByMenu[name] || { name, totalWait: 0, n: 0, maxWait: 0 };
                                waitByMenu[name].totalWait += wait;
                                waitByMenu[name].n += 1;
                                waitByMenu[name].maxWait = Math.max(waitByMenu[name].maxWait, wait);
                            }
                        }
                    } catch { }
                }
                const topItems = Object.values(items).sort((a, b) => b.qty - a.qty).slice(0, 8);
                const activeProducts = (await q('SELECT name FROM products WHERE active=1 ORDER BY name').all()).results.map(r => String(r.name));
                const deadNames = activeProducts.filter(n => !items[n]);
                const deadMenu = deadNames.map((name, i) => ({ name, saran: deadNames.length >= 5 && i >= 3 ? 'coret' : 'promo' }));
                const slowMenu = Object.values(waitByMenu).map(v => ({ name: v.name, avgWait: Math.round(v.totalWait / v.n), maxWait: v.maxWait, n: v.n, solid: v.n >= 3 })).sort((a, b) => b.avgWait - a.avgWait || b.n - a.n).slice(0, 8);
                const pctOn = timing.n_ready ? Math.round(nOn / timing.n_ready * 100) : 0;
                const targetTrend = perDay.map(d => { const m = dayMix[d.day]; return { day: d.day, pct: m && m.ready ? Math.round(m.on / m.ready * 100) : null, n: m ? m.ready : 0 }; });
                const tzOff = config.timezone === 'Asia/Makassar' ? 8 * 3600000 : config.timezone === 'Asia/Jayapura' ? 9 * 3600000 : 7 * 3600000;
                const perHour = (await q("SELECT CAST(((created_at + ?) / 3600000) % 24 AS INTEGER) AS h,COUNT(*) AS n,AVG(CASE WHEN ready_at IS NOT NULL AND ready_at>=created_at THEN ready_at-created_at END) AS avgwait FROM orders WHERE day>=? AND day<=? AND status!='cancelled' GROUP BY h ORDER BY h", tzOff, from, to).all()).results;
                const peak = perHour.filter(r => r.avgwait != null).sort((a, b) => b.avgwait - a.avgwait)[0] || null;
                const stats = { from, to, days, orders: agg.orders, sales: agg.sales, cancelled: agg.cancelled, avgTicket: agg.orders ? Math.round(agg.sales / agg.orders) : 0, perDay, paymix, topItems, avgReady: timing.avg_ready, medianReady, nReady: timing.n_ready, nOnTarget: nOn, pctOnTarget: pctOn, targetMin, targetFood: tg.food, targetDrink: tg.drink, slowMenu, deadMenu, targetTrend, perHour, peakHour: peak ? { h: peak.h, avgWait: Math.round(peak.avgwait), n: peak.n } : null };
                let narrative = '', source = 'aturan';
                const rupiah = n => 'Rp' + Math.round(n).toLocaleString('id-ID');
                const fmt = ms => {
                    if (!ms) return '–';
                    const m = Math.round(ms / 60000);
                    if (m < 60) return `${m} mnt`;
                    return `${Math.floor(m / 60)} j ${m % 60} mnt`;
                };
                const trenHalf = () => {
                    if (perDay.length < 2) return '';
                    const half = Math.floor(perDay.length / 2), a = perDay.slice(0, half).reduce((s, d) => s + d.sales, 0), b = perDay.slice(half).reduce((s, d) => s + d.sales, 0);
                    const pct = a ? Math.round((b - a) / a * 100) : 0;
                    return ` Paruh kedua ${pct >= 0 ? 'naik' : 'turun'} ${Math.abs(pct)}% vs paruh pertama.`;
                };
                const slowPhrase = s => `${s.name} rata-rata ${fmt(s.avgWait)}`;
                const deadPromo = deadMenu.filter(d => d.saran === 'promo').map(d => d.name);
                const deadCoret = deadMenu.filter(d => d.saran === 'coret').map(d => d.name);
                const rules = () => {
                    const lines = [];
                    lines.push(`1. Tren: ${from}–${to} ${agg.orders} pesanan, omzet ${rupiah(agg.sales)}, nota rata-rata ${rupiah(stats.avgTicket)}.${trenHalf()}`);
                    if (topItems.length) {
                        let menu = `2. Menu andalan: ${topItems.slice(0, 3).map(t => `${t.name} (${t.qty}x)`).join(', ')}.`;
                        const slowClaim = slowMenu.find(s => s.solid) || slowMenu[0];
                        const slowTag = slowClaim && !slowClaim.solid ? ' (estimasi, sampel kecil)' : '';
                        if (slowClaim) menu += ` ${slowPhrase(slowClaim)}${slowTag}, paling lambat.${slowMenu[1] && slowMenu[1] !== slowClaim ? ` Lalu ${slowPhrase(slowMenu[1])}.` : ''}`;
                        if (deadPromo.length) menu += ` Menu mati (0 laku), saran promo: ${deadPromo.slice(0, 4).join(', ')}.`;
                        if (deadCoret.length) menu += ` Pertimbangkan coret: ${deadCoret.slice(0, 4).join(', ')}.`;
                        lines.push(menu);
                    } else lines.push(`2. Menu: belum ada penjualan pada rentang ini.${deadMenu.length ? ` Menu mati (0 laku): ${deadMenu.slice(0, 6).map(d => d.name).join(', ')} — saran promo/coret.` : ''}`);
                    const rated = targetTrend.filter(t => t.pct != null);
                    const best = rated.length ? rated.reduce((a, b) => b.pct - a.pct >= 0 ? b : a) : null;
                    const worst = rated.length ? rated.reduce((a, b) => b.pct - a.pct <= 0 ? b : a) : null;
                    const peakTxt = stats.peakHour ? ` Jam tersibuk ${String(stats.peakHour.h).padStart(2, '0')}.00 (rata ${fmt(stats.peakHour.avgWait)}, ${stats.peakHour.n} pesanan).` : '';
                    const trendTxt = rated.length > 1 && best && worst && best.day !== worst.day ? ` Terbaik ${best.day} (${best.pct}%), terlemah ${worst.day} (${worst.pct}%).` : '';
                    if (timing.n_ready) lines.push(`3. Kecepatan vs target: rata-rata ${fmt(timing.avg_ready)} (tipikal ${fmt(medianReady)}), tercapai ${pctOn}% dari target (makanan ${tg.food} mnt, minuman ${tg.drink} mnt; ${nOn}/${timing.n_ready}).${peakTxt}${trendTxt}${timing.avg_ready > targetMin * 60000 ? ' Butuh evaluasi dapur/jam ramai.' : ' Kecepatan bagus — pertahankan.'}`);
                    else lines.push(`3. Kecepatan: belum ada pesanan yang sampai siap. Target ${targetMin} mnt belum terukur.`);
                    if (paymix.length) {
                        const top = paymix[0], share = agg.orders ? Math.round(top.n / agg.orders * 100) : 0;
                        const rest = paymix.slice(1, 3).map(p => `${p.payment} (${p.n}x)`).join(', ');
                        lines.push(`4. Bayar: ${top.payment} dominan ${share}% (${top.n}x)${rest ? ', lalu ' + rest : ''}.${/tunai/i.test(top.payment) && share >= 50 ? ' Dorong QRIS/bank.' : ''}`);
                    } else lines.push(`4. Bayar: belum ada data.`);
                    const recs = [];
                    if (slowMenu.length && slowMenu[0].avgWait > targetMin * 60000) recs.push(`percepat ${slowMenu[0].name} (rata-rata ${fmt(slowMenu[0].avgWait)}${slowMenu[0].solid ? '' : ', estimasi'})`);
                    if (deadPromo.length) recs.push(`promo ${deadPromo[0]} (0 laku)`);
                    else if (deadCoret.length) recs.push(`coret ${deadCoret[0]} (tidak laku)`);
                    if (pctOn < 85 && timing.n_ready) recs.push(stats.peakHour ? `tambah orang jam ${String(stats.peakHour.h).padStart(2, '0')}.00 (rata ${fmt(stats.peakHour.avgWait)})` : `kejar target ${targetMin} mnt di jam ramai`);
                    if (/tunai/i.test(paymix[0]?.payment || '') && agg.orders && Math.round(paymix[0].n / agg.orders * 100) >= 50) recs.push(`dorong QRIS`);
                    if (!recs.length) recs.push('pertahankan jam ramai', 'cek stok andalan', 'pantau kecepatan harian');
                    lines.push(`5. Saran: ${recs.slice(0, 3).join('; ')}.`);
                    return lines.join('\n');
                };
                try {
                    if (!ai) throw new Error('no-ai');
                    const facts = {
                        periode: `${from}–${to} (${days} hari)`,
                        pesanan: agg.orders,
                        omzet: Math.round(agg.sales),
                        notaRata: stats.avgTicket,
                        tren: trenHalf().trim() || 'satu hari',
                        andalan: topItems.slice(0, 5).map(t => `${t.name} ${t.qty}x`),
                        lambat: slowMenu.slice(0, 5).map(s => `${s.name} rata-rata ${fmt(s.avgWait)} (${s.n} pesanan)`),
                        matiPromo: deadPromo.slice(0, 8),
                        matiCoret: deadCoret.slice(0, 8),
                        kecepatan: `rata ${fmt(timing.avg_ready)}, tipikal ${fmt(medianReady)}, tercapai ${pctOn}% dari target (makanan ${tg.food} mnt, minuman ${tg.drink} mnt; ${nOn}/${timing.n_ready})`,
                        jamRamai: stats.peakHour ? `jam ${String(stats.peakHour.h).padStart(2, '0')}.00 rata ${fmt(stats.peakHour.avgWait)} dari ${stats.peakHour.n} pesanan` : 'belum ada data siap',
                        trenTarget: targetTrend.filter(t => t.pct != null).map(t => `${t.day} ${t.pct}%`).join(', ') || 'satu hari',
                        bayar: paymix.slice(0, 4).map(p => `${p.payment} ${p.n}x`),
                    };
                    const res = await ai.run('@cf/meta/llama-3.1-8b-instruct', { messages: [
                        { role: 'system', content: 'Kamu analis kafe. Jawab Bahasa Indonesia. Tepat 5 baris bernomor 1. sampai 5. Maksimal 200 kata. Jangan sebut nama pelanggan. Jangan mengarang angka — pakai data user. Struktur wajib: 1) tren penjualan (omzet, jumlah pesanan, naik/turun), 2) menu andalan + menu lambat (sebut "rata-rata X mnt, paling lambat") + menu mati 0 laku dengan saran promo atau coret, 3) kecepatan vs target — wajib frasa "tercapai N% dari target M mnt" plus jam tersibuk dan hari terbaik/terlemah bila ada datanya, 4) metode pembayaran, 5) tiga saran konkret (satu harus soal jam tersibuk bila kecepatan di bawah target). Jangan tambah baris ke-6.' },
                        { role: 'user', content: `Fakta: ${JSON.stringify(facts)}. Tulis 5 baris sesuai struktur. Baris 3 wajib memuat: tercapai ${pctOn}% dari target (makanan ${tg.food} mnt, minuman ${tg.drink} mnt).` },
                    ] });
                    narrative = String(res?.response || '').slice(0, 2000);
                    if (!narrative) throw new Error('empty');
                    const numbered = narrative.split('\n').map(s => s.trim()).filter(l => /^\d+\./.test(l));
                    if (numbered.length < 5) throw new Error('structure');
                    source = 'ai';
                } catch { narrative = rules(); }
                return json({ ...stats, narrative, source });
            }
            fail(404, 'Halaman API tidak ditemukan.');
        }
        catch (e) {
            if (e instanceof HttpError)
                return json({ error: e.message }, e.status);
            console.error('Temancipta API failure', e);
            return json({ error: 'Layanan sementara tidak tersedia. Data isian tetap disimpan di layar; silakan coba lagi.' }, 503);
        }
    };
}
