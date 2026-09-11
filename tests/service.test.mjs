import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createService } from '../core/service.mjs';
import { businessDay, queueNumber } from '../core/security.mjs';
function database() {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(readFileSync(new URL('../drizzle/0000_woozy_war_machine.sql', import.meta.url), 'utf8'));
    sqlite.exec(readFileSync(new URL('../drizzle/0001_tidy_gargoyle.sql', import.meta.url), 'utf8'));
    sqlite.exec('PRAGMA foreign_keys=ON');
    class Query {
        constructor(sql, args = []) { this.sql = sql; this.args = args; }
        bind(...args) { return new Query(this.sql, args); }
        async first() { return sqlite.prepare(this.sql).get(...this.args) || null; }
        async all() { return { results: sqlite.prepare(this.sql).all(...this.args) }; }
        async run() { return this.execute(); }
        execute() { const stmt = sqlite.prepare(this.sql); if (/^\s*SELECT/i.test(this.sql))
            return { results: stmt.all(...this.args), meta: { changes: 0 } }; const r = stmt.run(...this.args); return { results: [], meta: { changes: Number(r.changes) } }; }
    }
    const db = { prepare: sql => new Query(sql), batch: async (statements) => { sqlite.exec('BEGIN IMMEDIATE'); try {
            const r = statements.map(s => s.execute());
            sqlite.exec('COMMIT');
            return r;
        }
        catch (e) {
            sqlite.exec('ROLLBACK');
            throw e;
        } } };
    return { db, sqlite };
}
async function fixture() {
    const { db, sqlite } = database();
    let now = Date.parse('2026-09-11T16:59:58Z');
    const service = createService(db, { clock: () => now, trustedSetup: true });
    let cookie = '';
    const call = async (path, body, custom = {}) => { const headers = { origin: 'https://trefiko.test', ...(body ? { 'content-type': 'application/json' } : {}), cookie, ...custom }; const r = await service(new Request('https://trefiko.test/api/' + path, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined })); return { status: r.status, data: await r.json(), cookie: r.headers.get('set-cookie')?.split(';')[0] }; };
    assert.equal((await call('setup', { username: 'admin', password: 'secure-pass-123', name: 'Admin', cafe: 'Test Cafe', timezone: 'Asia/Jakarta', sampleMenu: true })).status, 201);
    const login = await call('login', { username: 'admin', password: 'secure-pass-123' });
    assert.equal(login.status, 200);
    cookie = login.cookie;
    const products = (await call('products')).data.products;
    const order = (overrides = {}) => ({ id: crypto.randomUUID(), customer: 'Anggito', mode: 'dine-in', payment: 'cash', note: 'Tanpa gula', items: [{ id: products[0].id, quantity: 2 }], ...overrides });
    return { call, order, sqlite, products, setClock: n => now = n, getClock: () => now, getCookie: () => cookie, setCookie: c => cookie = c };
}
test('business day uses cafe timezone, supports all Indonesian zones and 1000+', () => { assert.equal(businessDay(Date.parse('2026-09-11T17:00:00Z'), 'Asia/Jakarta'), '2026-09-12'); assert.equal(businessDay(Date.parse('2026-09-11T16:00:00Z'), 'Asia/Makassar'), '2026-09-12'); assert.equal(businessDay(Date.parse('2026-09-11T15:00:00Z'), 'Asia/Jayapura'), '2026-09-12'); assert.equal(queueNumber(1001), 'A1001'); assert.equal(queueNumber(10001), 'A10001'); });
test('1,250 requests in concurrent batches get unique daily numbers; midnight preserves active orders', async () => { const f = await fixture(); const nums = []; for (let batch = 0; batch < 50; batch++) {
    const responses = await Promise.all(Array.from({ length: 25 }, () => f.call('orders', f.order())));
    for (const r of responses) {
        assert.equal(r.status, 201, JSON.stringify(r.data));
        nums.push(r.data.order.number);
    }
} assert.equal(new Set(nums).size, 1250); assert.deepEqual(nums.sort((a, b) => a - b), Array.from({ length: 1250 }, (_, i) => i + 1)); f.setClock(Date.parse('2026-09-11T17:00:01Z')); const next = await f.call('orders', f.order()); assert.equal(next.data.order.number, 1); assert.equal(next.data.order.day, '2026-09-12'); const board = (await f.call('board')).data; assert.equal(board.orders.length, 1251); assert.equal(board.stats.total, 1); assert.equal((await f.call('history?day=2026-09-11')).data.count, 1250); assert.equal((await f.call('history?day=2026-09-11&page=2')).data.orders.length, 30); f.sqlite.close(); });
test('idempotent order replay survives midnight, preserves price snapshot and rejects changed payload', async () => { const f = await fixture(), payload = f.order(); const concurrent = await Promise.all([f.call('orders', payload), f.call('orders', payload)]); assert.equal(concurrent.filter(r => r.status === 201).length, 1); assert.equal(concurrent.filter(r => r.status === 200).length, 1); f.setClock(Date.parse('2026-09-11T17:00:01Z')); const replay = await f.call('orders', payload); assert.equal(replay.status, 200); assert.equal(replay.data.order.day, '2026-09-11'); assert.equal((await f.call('orders', { ...payload, customer: 'Other' })).status, 409); const p = f.products[0]; await f.call('products', { ...p, price: 1, active: true }); assert.equal((await f.call('orders', payload)).data.order.total, p.price * 2); f.sqlite.close(); });
test('state machine and optimistic locking produce one ready event; recall is idempotent; completed orders cannot be recalled', async () => { const f = await fixture(); const o = (await f.call('orders', f.order())).data.order; const action = (a, version = 1, id = crypto.randomUUID()) => ({ id: o.id, action: a, version, requestId: id }); assert.equal((await f.call('orders/action', action('ready'))).status, 409); const preparation = await Promise.all([f.call('orders/action', action('prepare')), f.call('orders/action', action('prepare'))]); assert.equal(preparation.filter(r => r.status === 200).length, 1); assert.equal(preparation.filter(r => r.status === 409).length, 1); const ready = action('ready', 2); assert.equal((await f.call('orders/action', ready)).status, 200); assert.equal((await f.call('orders/action', ready)).status, 200); assert.equal((await f.call('events?after=0')).data.events.length, 1); const recall = action('recall', 3); assert.equal((await f.call('orders/action', recall)).status, 200); assert.equal((await f.call('orders/action', recall)).status, 200); assert.equal((await f.call('events?after=0')).data.events.length, 2); assert.equal((await f.call('orders/action', action('complete', 3))).status, 200); assert.equal((await f.call('orders/action', action('recall', 4))).status, 409); assert.equal((await f.call('board')).data.orders.length, 0); f.sqlite.close(); });
test('server validates prices, quantities, menu availability, cancellation reason and CSRF', async () => { const f = await fixture(); const p = f.order(); assert.equal((await f.call('orders', { ...p, items: [{ id: p.items[0].id, quantity: -1 }] })).status, 400); assert.equal((await f.call('orders', p, { origin: 'https://evil.test' })).status, 403); assert.equal((await f.call('orders', { ...p, expectedTotal: 1 })).status, 409);
    const o = (await f.call('orders', { ...p, total: 1 })).data.order; assert.equal(o.total, f.products[0].price * 2); const cancel = { id: o.id, action: 'cancel', version: 1, requestId: crypto.randomUUID() }; assert.equal((await f.call('orders/action', cancel)).status, 400); assert.equal((await f.call('orders/action', { ...cancel, reason: 'Permintaan pelanggan' })).status, 200); assert.equal((await f.call('history')).data.summary.sales, 0); await f.call('products', { ...f.products[0], active: false }); assert.equal((await f.call('orders', f.order())).status, 409); f.sqlite.close(); });
test('display and kitchen roles cannot access admin or cashier APIs; revocation invalidates sessions', async () => { const f = await fixture(); const admin = f.getCookie(); for (const role of ['display', 'kitchen', 'cashier']) {
    await f.call('users', { username: role, name: role, password: 'staff-password-123', role });
    const login = await f.call('login', { username: role, password: 'staff-password-123' });
    f.setCookie(login.cookie);
    assert.equal((await f.call('users')).status, 403);
    assert.equal((await f.call('settings', { name: 'X', footer: '' })).status, 403);
    if (role !== 'cashier')
        assert.equal((await f.call('orders', f.order())).status, 403);
    if (role === 'display') {
        assert.equal((await f.call('history')).status, 403);
        assert.equal((await f.call('board')).data.stats, undefined);
    }
    f.setCookie(admin);
} const us = (await f.call('users')).data.users.find(u => u.role === 'cashier'); const login = await f.call('login', { username: 'cashier', password: 'staff-password-123' }); await f.call('users/access', { id: us.id, active: false }); f.setCookie(login.cookie); assert.equal((await f.call('me')).status, 401); f.sqlite.close(); });
test('setup cannot run twice, login throttles and sessions expire', async () => { const f = await fixture(); assert.equal((await f.call('setup', {})).status, 409); for (let i = 0; i < 8; i++)
    assert.equal((await f.call('login', { username: 'nobody', password: 'wrong' })).status, 401); assert.equal((await f.call('login', { username: 'nobody', password: 'wrong' })).status, 429); f.setClock(f.getClock() + 43200001); assert.equal((await f.call('me')).status, 401); f.sqlite.close(); });
test('history search escapes SQL wildcards and event cursor reads more than 100 calls in pages', async () => { const f = await fixture(); const o = (await f.call('orders', f.order({ customer: '100% Cafe' }))).data.order; assert.equal((await f.call('history?search=%25')).data.count, 1); assert.equal((await f.call('history?search=_')).data.count, 0);     await f.call('orders/action', { id: o.id, version: 1, action: 'prepare', requestId: crypto.randomUUID() }); await f.call('orders/action', { id: o.id, version: 2, action: 'ready', requestId: crypto.randomUUID() }); for (let i = 0; i < 105; i++)
    await f.call('orders/action', { id: o.id, version: 3, action: 'recall', requestId: crypto.randomUUID() }); const first = (await f.call('events?after=0')).data.events; assert.equal(first.length, 100); assert.equal((await f.call('events?after=' + first.at(-1).id)).data.events.length, 6); f.sqlite.close(); });
test('finance is admin-only; expenses feed profit summary', async () => { const f = await fixture(); const o = (await f.call('orders', f.order())).data.order; await f.call('users', { username: 'kasir1', name: 'Kasir', password: 'staff-password-123', role: 'cashier' }); const login = await f.call('login', { username: 'kasir1', password: 'staff-password-123' }); const admin = f.getCookie(); f.setCookie(login.cookie); assert.equal((await f.call('finance')).status, 403); assert.equal((await f.call('expenses', { category: 'bahan', note: 'Susu', amount: 50000 })).status, 403); f.setCookie(admin); assert.equal((await f.call('expenses', { category: 'salah', note: 'x', amount: 1 })).status, 400); assert.equal((await f.call('expenses', { category: 'bahan', note: 'Susu', amount: 0 })).status, 400); const saved = await f.call('expenses', { category: 'bahan', note: 'Susu 5L', amount: 150000 }); assert.equal(saved.status, 200); await f.call('expenses', { category: 'gaji', note: 'Harian', amount: 100000 }); const fin = (await f.call('finance')).data; assert.equal(fin.sales[0].sales, o.total); assert.equal(fin.expenses.length, 2); assert.equal((await f.call('expenses/delete', { id: saved.data.id })).status, 200); assert.equal((await f.call('finance')).data.expenses.length, 1); f.sqlite.close(); });
