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
const parseOrder = o => o ? ({ ...o, items: JSON.parse(o.items), fingerprint: undefined }) : null;
const json = (data, status = 200, headers = {}) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });
export function createService(db, { clock = () => Date.now(), setupKey = '', trustedSetup = false } = {}) {
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
                    fail(409, 'Trefiko sudah dikonfigurasi. Silakan masuk.');
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
                    for (const [name, category, price] of [['Espresso', 'Kopi', 22000], ['Americano', 'Kopi', 26000], ['Cappuccino', 'Kopi', 32000], ['Cafe Latte', 'Kopi', 32000], ['Kopi Susu Gula Aren', 'Kopi', 28000], ['Matcha Latte', 'Non-kopi', 34000], ['Chocolate', 'Non-kopi', 30000], ['Lemon Tea', 'Non-kopi', 24000], ['Butter Croissant', 'Makanan', 28000], ['French Fries', 'Makanan', 25000], ['Chicken Sandwich', 'Makanan', 42000], ['Chocolate Brownie', 'Makanan', 30000]])
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
                fail(503, 'Selesaikan pengaturan awal Trefiko.');
            if (path === 'login' && method === 'POST') {
                const username = str(body.username, 40).toLowerCase(), password = str(body.password, 128);
                const ip = request.headers.get('cf-connecting-ip') || 'local';
                const key = await digest(ip + '|' + username);
                const attempt = await q('INSERT INTO attempts(key,count,until) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN until<=? THEN 1 ELSE count+1 END,until=CASE WHEN until<=? THEN excluded.until ELSE until END RETURNING count', key, now + 900000, now, now).first();
                if (attempt.count > 8)
                    fail(429, 'Terlalu banyak percobaan. Coba lagi setelah 15 menit.');
                const u = await q('SELECT * FROM users WHERE username=? AND active=1', username).first();
                const match = await checkPassword(password, u?.password || 'trefiko-dummy:0000000000000000000000000000000000000000000000000000000000000000');
                if (!u || !match)
                    fail(401, 'Username atau kata sandi salah.');
                const token = crypto.randomUUID() + crypto.randomUUID();
                await db.batch([q('INSERT INTO sessions(token,user_id,expires) VALUES(?,?,?)', await digest(token), u.id, now + 43200000), q('DELETE FROM attempts WHERE key=? OR until<?', key, now), q('DELETE FROM sessions WHERE expires<?', now)]);
                return json({ user: publicUser(u) }, 200, { 'Set-Cookie': `trefiko_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${url.protocol === 'https:' ? '; Secure' : ''}` });
            }
            const token = request.headers.get('cookie')?.split(';').map(s => s.trim()).find(s => s.startsWith('trefiko_session='))?.slice('trefiko_session='.length);
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
                return json({ ok: true }, 200, { 'Set-Cookie': 'trefiko_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
            }
            if (path === 'products' && method === 'GET') {
                allow('admin', 'cashier');
                return json({ products: (await q('SELECT * FROM products ORDER BY category,name').all()).results });
            }
            if (path === 'products' && method === 'POST') {
                allow('admin');
                const id = body.id ? uuid(body.id) : crypto.randomUUID(), name = str(body.name, 80), category = str(body.category, 40), price = int(body.price, 0, 100000000), active = body.active === false ? 0 : 1;
                await db.batch([q('INSERT INTO products(id,name,category,price,active) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,category=excluded.category,price=excluded.price,active=excluded.active', id, name, category, price, active), audit(user, 'product.save', id, now)]);
                return json({ ok: true, id });
            }
            if (path === 'orders' && method === 'POST') {
                allow('admin', 'cashier');
                const id = uuid(body.id), customer = str(body.customer, 60), mode = oneOf(body.mode, ['dine-in', 'takeaway']), payment = oneOf(body.payment, ['cash', 'qris', 'card']), note = str(body.note || '', 300, 0);
                if (!Array.isArray(body.items) || !body.items.length || body.items.length > 50)
                    fail(400, 'Pilih 1–50 menu.');
                const selected = body.items.map(i => ({ id: uuid(i.id), quantity: int(i.quantity, 1, 99) }));
                if (new Set(selected.map(i => i.id)).size !== selected.length)
                    fail(400, 'Menu duplikat. Gabungkan jumlahnya.');
                const fingerprint = await digest(JSON.stringify({ customer, mode, payment, note, items: selected }));
                const existing = await q('SELECT * FROM orders WHERE id=?', id).first();
                if (existing) {
                    if (existing.fingerprint !== fingerprint)
                        fail(409, 'Permintaan sebelumnya berbeda. Periksa riwayat sebelum membuat pesanan baru.');
                    return json({ order: parseOrder(existing), replayed: true });
                }
                const products = (await q(`SELECT * FROM products WHERE active=1 AND id IN (${selected.map(() => '?').join(',')})`, ...selected.map(i => i.id)).all()).results;
                const items = selected.map(i => { const p = products.find(p => p.id === i.id); if (!p)
                    fail(409, 'Menu sudah berubah atau tidak tersedia. Muat ulang menu.'); return { id: p.id, name: p.name, price: p.price, quantity: i.quantity }; });
                const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
                int(total, 0, 2000000000);
                if(body.expectedTotal !== undefined && body.expectedTotal !== total) fail(409, "Harga menu berubah. Total sudah diperbarui; periksa pembayaran sebelum menyimpan ulang.");
                const results = await db.batch([
                    q(`INSERT INTO orders(id,day,number,customer,mode,items,note,total,payment,status,created_at,updated_at,created_by,fingerprint)
        SELECT ?,?,COALESCE(MAX(number),0)+1,?,?,?,?,?,?,'waiting',?,?,?,? FROM orders WHERE day=? ON CONFLICT(id) DO NOTHING`, id, day, customer, mode, JSON.stringify(items), note, total, payment, now, now, user.id, fingerprint, day),
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
                const statements = [q('UPDATE orders SET status=?,updated_at=?,version=version+1,cancel_reason=? WHERE id=? AND status=? AND version=?', to, now, reason, id, from, version)];
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
                return json({ orders: rows.results.map(parseOrder), count: count.count, page, summary });
            }
            if (path === 'settings' && method === 'POST') {
                allow('admin');
                const name = str(body.name, 80), footer = str(body.footer, 200, 0);
                await db.batch([q('UPDATE settings SET name=?,footer=? WHERE id=1', name, footer), audit(user, 'settings.update', '1', now)]);
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
            fail(404, 'Halaman API tidak ditemukan.');
        }
        catch (e) {
            if (e instanceof HttpError)
                return json({ error: e.message }, e.status);
            console.error('Trefiko API failure', e);
            return json({ error: 'Layanan sementara tidak tersedia. Data isian tetap disimpan di layar; silakan coba lagi.' }, 503);
        }
    };
}
