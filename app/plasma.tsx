'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Coffee, Monitor, ChefHat, ReceiptText, Settings, LogOut, Search, Plus, Minus, ShoppingBag, Utensils, ArrowRight, Volume2, VolumeX, Maximize, Check, Clock, RotateCcw, Printer, X, Users, ShieldCheck, Ticket, ChevronLeft, ChevronRight, Loader2, Pencil, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { queueNumber } from '@/core/security.mjs';
type User = {
    id: string;
    name: string;
    username: string;
    role: string;
    active?: number;
};
type Config = {
    name: string;
    timezone: string;
    footer: string;
};
type Item = {
    id: string;
    name: string;
    price: number;
    quantity: number;
};
type Product = {
    id: string;
    name: string;
    category: string;
    price: number;
    active: number;
};
type Order = {
    id: string;
    day: string;
    number: number;
    customer: string;
    mode: string;
    items: Item[];
    note: string;
    total: number;
    payment: string;
    status: string;
    created_at: number;
    version: number;
    cancel_reason?: string;
};
type Board = {
    orders: Order[];
    stats?: {
        total: number;
        completed: number;
        sales: number;
    };
    latestEvent: number;
    day: string;
    serverTime: number;
};
const money = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
const statusNames: Record<string, string> = { waiting: 'Menunggu', preparing: 'Diproses', ready: 'Siap diambil', completed: 'Selesai', cancelled: 'Dibatalkan' };
const roleNames: Record<string, string> = { admin: 'Admin', cashier: 'Kasir', kitchen: 'Dapur', display: 'TV display' };
const time = (n: number, tz = 'Asia/Jakarta') => new Date(n).toLocaleTimeString('id-ID', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
function SelectField({ value, onChange, options, label }: {
    value: string;
    onChange: (s: string) => void;
    options: [
        string,
        string
    ][];
    label: string;
}) { return <Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label}><SelectValue /></SelectTrigger><SelectContent>{options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>; }
async function api(path: string, body?: unknown): Promise<any> { const r = await fetch('/api/' + path, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' }); let d: any; try {
    d = await r.json();
}
catch {
    throw new Error('Server tidak dapat dihubungi. Silakan coba lagi.');
} if (!r.ok) {
    const e = new Error(d.error || 'Permintaan gagal.') as Error & {
        status: number;
    };
    e.status = r.status;
    throw e;
} return d; }
function Empty({ title, children }: {
    title: string;
    children?: React.ReactNode;
}) { return <div className="empty"><Ticket size={32}/><h3>{title}</h3><p>{children}</p></div>; }
function Status({ status }: {
    status: string;
}) { return <span className={'status ' + status}>{statusNames[status]}</span>; }
export default function Plasma({ view = 'kasir' }: {
    view?: string;
}) {
    const [user, setUser] = useState<User | null>(null), [config, setConfig] = useState<Config | null>(null), [boot, setBoot] = useState<'loading' | 'setup' | 'login' | 'ready'>('loading'), [error, setError] = useState(''), [notice, setNotice] = useState('');
    const [board, setBoard] = useState<Board | null>(null), [connected, setConnected] = useState(false), [products, setProducts] = useState<Product[]>([]), [receipt, setReceipt] = useState<Order | null>(null);
    const loadMe = useCallback(async () => { const d = await api('me'); setUser(d.user); setConfig(d.config); setBoot('ready'); }, []);
    useEffect(() => { let alive = true; (async () => { try {
        const d = await api('bootstrap');
        if (!alive)
            return;
        if (!d.configured)
            setBoot('setup');
        else
            try {
                await loadMe();
            }
            catch {
                if (alive)
                    setBoot('login');
            }
    }
    catch (e) {
        setError((e as Error).message);
        setBoot('login');
    } })(); return () => { alive = false; }; }, [loadMe]);
    const refresh = useCallback(async () => { try {
        const b = await api('board');
        setBoard(b);
        setConnected(true);
    }
    catch (e) {
        setConnected(false);
        if ((e as any).status === 401) {
            setUser(null);
            setBoot('login');
        }
        throw e;
    } }, []);
    useEffect(() => { if (!user)
        return; let alive = true, t: ReturnType<typeof setTimeout>; const poll = async () => { try {
        await refresh();
    }
    catch { } if (alive)
        t = setTimeout(poll, 3000); }; poll(); return () => { alive = false; clearTimeout(t); }; }, [user, refresh]);
    const loadProducts = useCallback(async () => { const d = await api('products'); setProducts(d.products); }, []);
    useEffect(() => { if (user && ['admin', 'cashier'].includes(user.role))
        loadProducts().catch(e => setError(e.message)); }, [user, loadProducts]);
    const message = (s: string) => { setNotice(s); setError(''); };
    const perform = async (path: string, body: unknown) => { setError(''); try {
        const d = await api(path, body);
        await refresh().catch(() => { });
        return d;
    }
    catch (e) {
        setError((e as Error).message);
        throw e;
    } };
    const logout = async () => { try {
        await api('logout', {});
        setUser(null);
        setBoard(null);
        setBoot('login');
    }
    catch (e) {
        setError((e as Error).message);
    } };
    if (boot !== 'ready' || !user || !config)
        return <Auth boot={boot} error={error} onSubmit={async (values) => { setError(''); try {
            if (boot === 'setup') {
                await api('setup', values);
                setBoot('login');
                setNotice('Setup selesai. Silakan masuk dengan akun admin.');
            }
            else {
                await api('login', values);
                await loadMe();
            }
        }
        catch (e) {
            setError((e as Error).message);
            throw e;
        } }} notice={notice}/>;
    const actualView = user.role === 'display' ? 'display' : user.role === 'kitchen' && view !== 'display' ? 'dapur' : view;
    if (actualView === 'display')
        return <Display config={config} board={board} connected={connected} onLogout={logout}/>;
    const navigation = [['kasir', '/', Coffee], ['dapur', '/dapur', ChefHat], ['riwayat', '/riwayat', ReceiptText], ['pengaturan', '/pengaturan', Settings]] as const;
    return <><div className="app-shell no-print"><header className="topbar"><a className="brand" href="/"><span className="brand-icon"><Coffee size={23}/></span>plasma<span className="brand-dot">.</span></a><nav aria-label="Navigasi utama">{navigation.filter(([v]) => user.role === 'admin' || user.role === 'cashier' && v !== 'pengaturan' || user.role === 'kitchen' && v === 'dapur').map(([v, href, Icon]) => <a key={v} href={href} className={actualView === v ? 'active' : ''}><Icon size={18}/>{v.charAt(0).toUpperCase() + v.slice(1)}</a>)}</nav><div className="topbar-right"><a className="tv-link" href="/display" target="_blank" rel="noreferrer"><Monitor size={17}/>Buka TV</a><div className="profile"><span>{user.name.slice(0, 1).toUpperCase()}</span><div><strong>{user.name}</strong><small>{roleNames[user.role]}</small></div></div><Button variant="ghost" size="icon" aria-label="Keluar" onClick={logout}><LogOut /></Button></div></header>
 <div className="workspace-head"><div><p className="eyebrow">{config.name} <span>/</span> OPERASIONAL</p><h1>{{ kasir: 'Kasir', dapur: 'Antrean dapur', riwayat: 'Riwayat pesanan', pengaturan: 'Pengaturan' }[actualView]}</h1></div><div className="connection"><span className={connected ? 'online' : 'offline'}/>{connected ? 'Terhubung' : 'Menghubungkan ulang…'}<small>{board?.day} · {config.timezone.replace('Asia/', '')}</small></div></div>
 {error && <div className="banner error" role="alert">{error}<button onClick={() => setError('')} aria-label="Tutup pesan"><X size={18}/></button></div>}{notice && <div className="banner success" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Tutup pesan"><X size={18}/></button></div>}
 {actualView === 'kasir' && <Cashier products={products} board={board} config={config} connected={connected} onSave={async (b) => { let d; try { d = await perform('orders', b); } catch(e) { await loadProducts().catch(()=>{}); throw e; } setReceipt(d.order); message('Pesanan masuk antrean. Struk siap dicetak.'); return d; }} onReceipt={setReceipt}/>}
 {actualView === 'dapur' && <Kitchen board={board} config={config} user={user} connected={connected} onAction={b => perform('orders/action', b)} onReceipt={setReceipt}/>}
 {actualView === 'riwayat' && <History config={config} day={board?.day || ''} onReceipt={setReceipt}/>}
 {actualView === 'pengaturan' && user.role === 'admin' && <SettingsPanel config={config} products={products} onSave={async (path, b) => { const d = await perform(path, b); if (path === 'settings')
        await loadMe(); if (path === 'products')
        await loadProducts(); message('Perubahan berhasil disimpan.'); return d; }} onLogout={logout}/>}
 </div><Dialog open={!!receipt} onOpenChange={open => { if (!open)
        setReceipt(null); }}><DialogContent className="receipt-dialog no-print"><DialogHeader><DialogTitle>Struk pesanan</DialogTitle><DialogDescription>Gunakan kertas thermal 80 mm. Pilih printer di dialog cetak.</DialogDescription></DialogHeader>{receipt && <Receipt order={receipt} config={config}/>}<Button onClick={() => window.print()}><Printer />Cetak struk</Button></DialogContent></Dialog>{receipt && <div className="print-only"><Receipt order={receipt} config={config}/></div>}</>;
}
function Auth({ boot, error, notice, onSubmit }: {
    boot: string;
    error: string;
    notice: string;
    onSubmit: (v: any) => Promise<void>;
}) {
    const [busy, setBusy] = useState(false), [tz, setTz] = useState('Asia/Jakarta'), [sample, setSample] = useState(true);
    return <main className="auth"><section className="auth-brand"><a className="brand" href="/"><span className="brand-icon"><Coffee /></span>plasma.</a><div><p className="eyebrow">CAFE QUEUE SYSTEM</p><h1>Pesanan tertata.<br />Pelanggan nyaman.</h1><div className="auth-ticket"><span>NOMOR ANTREAN</span><strong>A0001</strong><p>Kasir → Dapur → TV display</p></div></div><p>Setiap pesanan, terhubung dalam satu antrean.</p></section><section className="auth-form">{boot === 'loading' ? <><Loader2 className="spin"/><p>Menghubungkan Plasma…</p></> : <form onSubmit={async (e) => { e.preventDefault(); const v = Object.fromEntries(new FormData(e.currentTarget)); setBusy(true); try {
        await onSubmit({ ...v, timezone: tz, sampleMenu: sample });
    }
    catch { }
    finally {
        setBusy(false);
    } }}><p className="eyebrow">SELAMAT DATANG DI PLASMA</p><h2>{boot === 'setup' ? 'Siapkan kafe Anda' : 'Masuk ke ruang kerja'}</h2><p className="muted">{boot === 'setup' ? 'Buat akun admin dan atur identitas kafe.' : 'Gunakan akun yang diberikan admin kafe.'}</p>{error && <p className="banner error" role="alert">{error}</p>}{notice && <p className="banner success">{notice}</p>}{boot === 'setup' && <><label>Nama kafe<Input name="cafe" required maxLength={80} placeholder="Nama kafe Anda"/></label><label>Nama admin<Input name="name" required maxLength={80}/></label><label>Zona waktu<SelectField label="Zona waktu" value={tz} onChange={setTz} options={[['Asia/Jakarta', 'WIB — Jakarta'], ['Asia/Makassar', 'WITA — Makassar'], ['Asia/Jayapura', 'WIT — Jayapura']]}/></label><label>Kunci setup <span className="muted">(untuk server mandiri)</span><Input name="setupKey" type="password" autoComplete="off"/></label></>}<label>Username<Input name="username" required autoComplete="username" maxLength={40} pattern="[A-Za-z0-9._\-]+" placeholder="contoh: admin"/></label><label>Kata sandi<Input name="password" type="password" required minLength={boot === 'setup' ? 10 : 1} maxLength={128} autoComplete={boot === 'setup' ? 'new-password' : 'current-password'} placeholder={boot === 'setup' ? 'Minimal 10 karakter' : 'Masukkan kata sandi'}/></label>{boot === 'setup' && <div className="switch-row"><Switch id="sample" checked={sample} onCheckedChange={setSample}/><Label htmlFor="sample">Tambahkan contoh menu yang bisa diedit</Label></div>}<Button className="full" disabled={busy}>{busy ? <Loader2 className="spin"/> : null}{boot === 'setup' ? 'Simpan pengaturan' : 'Masuk'}<ArrowRight /></Button><p className="login-help"><ShieldCheck size={15}/> Akses sesuai peran petugas</p></form>}</section></main>;
}
function Cashier({ products, board, config, connected, onSave, onReceipt }: {
    products: Product[];
    board: Board | null;
    config: Config;
    connected: boolean;
    onSave: (b: any) => Promise<any>;
    onReceipt: (o: Order) => void;
}) {
    const [cart, setCart] = useState<Item[]>([]), [customer, setCustomer] = useState(''), [note, setNote] = useState(''), [mode, setMode] = useState('dine-in'), [payment, setPayment] = useState('cash'), [category, setCategory] = useState('all'), [search, setSearch] = useState(''), [busy, setBusy] = useState(false);
    useEffect(()=>{setCart(items=>items.map(i=>{const p=products.find(p=>p.id===i.id);return p?{...i,price:p.price,name:p.name}:i;}));},[products]);
    const pending = useRef<{
        id: string;
        payload: string;
    } | null>(null);
    const active = products.filter(p => p.active), categories = [...new Set(active.map(p => p.category))];
    const filtered = active.filter(p => (category === 'all' || p.category === category) && p.name.toLowerCase().includes(search.toLowerCase()));
    const add = (p: Product) => setCart(c => { const old = c.find(i => i.id === p.id); return old ? c.map(i => i.id === p.id ? { ...i, quantity: Math.min(i.quantity + 1, 99) } : i) : [...c, { ...p, quantity: 1 }]; });
    const total = cart.reduce((s, i) => s + i.quantity * i.price, 0);
    const stats = [['Pesanan hari ini', board?.stats?.total || 0, ReceiptText], ['Dalam antrean', board?.orders.filter(o => o.status !== 'ready').length || 0, Clock], ['Siap diambil', board?.orders.filter(o => o.status === 'ready').length || 0, ShoppingBag]] as const;
    return <><div className="stats-row">{stats.map(([label, val, Icon]) => <div className="stat" key={label}><span><Icon size={20}/>{label}</span><strong>{val}</strong></div>)}</div><div className="cashier-grid"><section className="menu-area"><div className="section-top"><div><h2>Pilih menu</h2><p className="muted">{active.length} menu tersedia</p></div><div className="search"><Search size={18}/><Input placeholder="Cari menu…" aria-label="Cari menu" value={search} onChange={e => setSearch(e.target.value)}/></div></div><Tabs value={category} onValueChange={setCategory}><TabsList className="category-tabs"><TabsTrigger value="all">Semua menu</TabsTrigger>{categories.map(c => <TabsTrigger key={c} value={c}>{c}</TabsTrigger>)}</TabsList></Tabs><div className="menu-grid">{filtered.map(p => <button disabled={busy} className="menu-card" key={p.id} onClick={() => add(p)}><span className={'menu-symbol category-' + (p.category === 'Kopi' ? 'coffee' : p.category === 'Makanan' ? 'food' : 'drink')}>{p.category === 'Makanan' ? <Utensils size={31}/> : <Coffee size={31}/>}</span><span className="menu-category">{p.category}</span><strong>{p.name}</strong><span className="menu-bottom">{money(p.price)}<span className="add-icon"><Plus size={17}/></span></span>{cart.find(i => i.id === p.id) && <span className="menu-count">{cart.find(i => i.id === p.id)?.quantity}</span>}</button>)}</div>{!filtered.length && <Empty title={active.length ? 'Menu tidak ditemukan' : 'Belum ada menu'}>{active.length ? 'Coba kata pencarian lain.' : 'Admin dapat menambahkan menu melalui Pengaturan.'}</Empty>}<section className="recent-orders"><div className="section-top"><h2>Pesanan aktif terbaru</h2><a href="/dapur">Lihat antrean <ArrowRight size={15}/></a></div>{board?.orders.length ? board.orders.slice(-5).reverse().map(o => <button className="recent-row" key={o.id} onClick={() => onReceipt(o)}><strong>{queueNumber(o.number)}</strong><span>{o.customer}<small>{o.day !== board.day ? o.day + ' · ' : ''}{time(o.created_at, config.timezone)}</small></span><Status status={o.status}/><Printer size={16}/></button>) : <p className="muted">Pesanan baru akan muncul di sini.</p>}</section></section><aside className="cart"><div className="cart-heading"><div><h2>Pesanan baru</h2><p>Nomor dibuat setelah pesanan disimpan</p></div><ReceiptText size={24}/></div><form onSubmit={async (e) => { e.preventDefault(); if (!cart.length || busy)
        return; setBusy(true); const data = { customer: customer.trim(), mode, payment, note, expectedTotal:total, items: cart.map(i => ({ id: i.id, quantity: i.quantity })) }; const payload = JSON.stringify(data); if (!pending.current || pending.current.payload !== payload)
        pending.current = { id: crypto.randomUUID(), payload }; try {
        await onSave({ ...data, id: pending.current.id });
        setCart([]);
        setCustomer('');
        setNote('');
        pending.current = null;
    }
    catch { }
    finally {
        setBusy(false);
    } }}><fieldset disabled={busy}><label>Nama pelanggan <span className="required">*</span><Input required maxLength={60} value={customer} onChange={e => setCustomer(e.target.value)} placeholder="Nama yang akan dipanggil"/></label><Tabs value={mode} onValueChange={setMode}><TabsList className="mode-tabs"><TabsTrigger value="dine-in"><Utensils size={16}/>Dine in</TabsTrigger><TabsTrigger value="takeaway"><ShoppingBag size={16}/>Take away</TabsTrigger></TabsList></Tabs><div className="cart-items">{cart.length ? cart.map(i => <div className="cart-item" key={i.id}><div><strong>{i.name}</strong><small>{money(i.price)}</small></div><div className="quantity"><button type="button" aria-label={'Kurangi ' + i.name} onClick={() => setCart(c => c.map(x => x.id === i.id ? { ...x, quantity: x.quantity - 1 } : x).filter(x => x.quantity > 0))}><Minus size={14}/></button><span>{i.quantity}</span><button type="button" aria-label={'Tambah ' + i.name} onClick={() => setCart(c => c.map(x => x.id === i.id ? { ...x, quantity: Math.min(x.quantity + 1, 99) } : x))}><Plus size={14}/></button></div></div>) : <div className="cart-empty"><ShoppingBag size={31}/><p>Pesanan masih kosong</p><small>Pilih menu untuk mulai.</small></div>}</div><label>Catatan pesanan<Textarea maxLength={300} rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Contoh: less ice, tanpa gula"/></label><label>Pembayaran<SelectField label="Pembayaran" value={payment} onChange={setPayment} options={[['cash', 'Tunai'], ['qris', 'QRIS'], ['card', 'Kartu debit / kredit']]}/></label><div className="total"><span>Total <small>{cart.reduce((s, i) => s + i.quantity, 0)} item</small></span><strong>{money(total)}</strong></div><Button type="submit" className="full submit-order" disabled={!cart.length || !customer.trim() || busy || !connected}>{busy ? <Loader2 className="spin"/> : <ReceiptText />}{busy ? 'Menyimpan…' : 'Simpan & siapkan struk'}<ArrowRight /></Button><p className="payment-note">Pastikan pembayaran sudah diterima sebelum menyimpan.</p></fieldset></form></aside></div></>;
}
function Kitchen({ board, config, user, connected, onAction, onReceipt }: {
    board: Board | null;
    config: Config;
    user: User;
    connected: boolean;
    onAction: (b: any) => Promise<any>;
    onReceipt: (o: Order) => void;
}) {
    const [filter, setFilter] = useState('all'), [page, setPage] = useState(1), [busy, setBusy] = useState(''), [cancel, setCancel] = useState<Order | null>(null), [reason, setReason] = useState('');
    const filtered = board?.orders.filter(o => filter === 'all' || o.status === filter) || [], pages = Math.max(1, Math.ceil(filtered.length / 12));
    const current = Math.min(page, pages);
    const pending = useRef(new Map<string, string>());
    const act = async (o: Order, action: string) => { if (busy)
        return; const key = o.id + ':' + action; const requestId = pending.current.get(key) || crypto.randomUUID(); pending.current.set(key, requestId); setBusy(o.id); try {
        await onAction({ id: o.id, version: o.version, action, requestId, reason });
        pending.current.delete(key);
        setCancel(null);
        setReason('');
    }
    catch { }
    finally {
        setBusy('');
    } };
    return <section><div className="section-top kitchen-toolbar"><Tabs value={filter} onValueChange={v => { setFilter(v); setPage(1); }}><TabsList className="category-tabs">{['all', 'waiting', 'preparing', 'ready'].map(s => <TabsTrigger key={s} value={s}>{s === 'all' ? 'Semua antrean' : statusNames[s]} <span className="tab-count">{board?.orders.filter(o => s === 'all' || o.status === s).length || 0}</span></TabsTrigger>)}</TabsList></Tabs><span className="muted">Diperbarui otomatis setiap 3 detik</span></div><div className="kitchen-grid">{filtered.slice((current - 1) * 12, current * 12).map(o => <article className={'order-card ' + o.status} key={o.id}><header><strong>{queueNumber(o.number)}</strong><Status status={o.status}/></header><h2>{o.customer}</h2><p className="order-meta">{o.mode === 'takeaway' ? 'Take away' : 'Dine in'} · {time(o.created_at, config.timezone)} <span>· {Math.max(0, Math.floor(((board?.serverTime || o.created_at) - o.created_at) / 60000))} mnt</span></p>{o.day !== board?.day && <p className="old-date">Pesanan tanggal {o.day}</p>}<ul>{o.items.map(i => <li key={i.id}><b>{i.quantity}×</b><span>{i.name}</span></li>)}</ul>{o.note && <p className="order-note">{o.note}</p>}<footer>{o.status === 'waiting' && <Button disabled={!!busy || !connected} onClick={() => act(o, 'prepare')} className="full"><ChefHat />Mulai proses</Button>}{o.status === 'preparing' && <Button disabled={!!busy || !connected} onClick={() => act(o, 'ready')} className="full ready-button"><Volume2 />Siap & panggil</Button>}{o.status === 'ready' && <div className="ready-actions"><Button disabled={!!busy || !connected} variant="outline" onClick={() => act(o, 'recall')}><RotateCcw />Panggil ulang</Button><Button disabled={!!busy || !connected} onClick={() => act(o, 'complete')}><Check />Diambil</Button></div>}<div className="card-secondary"><Button variant="ghost" size="sm" onClick={() => onReceipt(o)}><Printer />Struk</Button>{user.role !== 'kitchen' && <Button variant="ghost" size="sm" onClick={() => setCancel(o)}>Batalkan</Button>}</div></footer></article>)}</div>{!filtered.length && <Empty title="Tidak ada pesanan di antrean ini">Pesanan dari kasir akan muncul otomatis.</Empty>}<Pager page={current} pages={pages} onChange={setPage}/><Dialog open={!!cancel} onOpenChange={v => { if (!v)
        setCancel(null); }}><DialogContent><DialogHeader><DialogTitle>Batalkan {cancel && queueNumber(cancel.number)}?</DialogTitle><DialogDescription>Pesanan tetap tersimpan dalam riwayat. Pengembalian pembayaran dilakukan oleh kasir.</DialogDescription></DialogHeader><label>Alasan pembatalan<Textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={200}/></label><Button variant="destructive" disabled={!reason.trim() || !!busy} onClick={() => cancel && act(cancel, 'cancel')}>Konfirmasi pembatalan</Button></DialogContent></Dialog></section>;
}
function Pager({ page, pages, onChange }: {
    page: number;
    pages: number;
    onChange: (n: number) => void;
}) { return <div className="pager"><Button variant="outline" size="icon" aria-label="Halaman sebelumnya" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft /></Button><span>Halaman {page} dari {pages}</span><Button variant="outline" size="icon" aria-label="Halaman berikutnya" disabled={page >= pages} onClick={() => onChange(page + 1)}><ChevronRight /></Button></div>; }
function Receipt({ order: o, config }: {
    order: Order;
    config: Config;
}) { return <article className="receipt"><Coffee size={27}/><h2>{config.name}</h2><p>{o.day} · {time(o.created_at, config.timezone)}</p><div className="receipt-number"><span>NOMOR ANTREAN</span><strong>{queueNumber(o.number)}</strong><h3>{o.customer}</h3><p>{o.mode === 'takeaway' ? 'TAKE AWAY' : 'DINE IN'}</p></div><div className="receipt-items">{o.items.map(i => <div key={i.id}><span>{i.quantity}× {i.name}</span><b>{money(i.quantity * i.price)}</b></div>)}</div>{o.note && <p className="receipt-note">Catatan: {o.note}</p>}<div className="receipt-total"><strong>TOTAL</strong><strong>{money(o.total)}</strong></div><p>Pembayaran: {{ cash: 'Tunai', qris: 'QRIS', card: 'Kartu' }[o.payment]} · <b>{statusNames[o.status]}</b></p>{o.cancel_reason && <p>Dibatalkan: {o.cancel_reason}</p>}<p className="receipt-footer">{config.footer}</p><small>ID: {o.id}</small></article>; }
function Display({ config, board, connected, onLogout }: {
    config: Config;
    board: Board | null;
    connected: boolean;
    onLogout: () => void;
}) {
    const [enabled, setEnabled] = useState(false), [audioError, setAudioError] = useState(''), [announcement, setAnnouncement] = useState<any>(null), [clock, setClock] = useState(''), [rotation, setRotation] = useState(0), [eventConnected, setEventConnected] = useState(true);
    const latestBoard = useRef(board), cursor = useRef<number | null>(null), sound = useRef(false), queue = useRef<any[]>([]), speaking = useRef(false), utterance = useRef<SpeechSynthesisUtterance | null>(null), watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
    latestBoard.current = board;
    const drain = useCallback(() => {
        if (speaking.current || !sound.current)
            return;
        if (queue.current[0] && (!latestBoard.current || latestBoard.current.serverTime < queue.current[0].created_at)) {
            setTimeout(() => drain(), 1000);
            return;
        }
        let ev = queue.current.shift();
        while (ev && !latestBoard.current?.orders.some(o => o.id === ev.order_id && o.status === 'ready'))
            ev = queue.current.shift();
        if (!ev)
            return;
        speaking.current = true;
        setAnnouncement(ev);
        const u = new SpeechSynthesisUtterance(`Nomor antrean A ${Number(ev.number)}, atas nama ${ev.customer}${ev.day !== latestBoard.current?.day ? ', pesanan tanggal ' + ev.day : ''}. Pesanan Anda sudah siap. Silakan ambil di konter.`);
        u.lang = 'id-ID';
        u.rate = .9;
        const voice = speechSynthesis.getVoices().find(v => v.lang.startsWith('id'));
        if (voice)
            u.voice = voice;
        const done = () => { if (watchdog.current)
            clearTimeout(watchdog.current); watchdog.current = null; speaking.current = false; utterance.current = null; setTimeout(() => drain(), 700); };
        u.onend = done;
        u.onerror = () => { if (!sound.current) {
            done();
            return;
        } setAudioError('Suara gagal diputar. Periksa audio perangkat, lalu aktifkan kembali.'); sound.current = false; setEnabled(false); queue.current = []; done(); };
        utterance.current = u;
        speechSynthesis.speak(u);
        watchdog.current = setTimeout(() => { sound.current = false; setEnabled(false); setAudioError('Panggilan suara terhenti. Aktifkan kembali dan minta petugas memanggil ulang.'); queue.current = []; speechSynthesis.cancel(); speaking.current = false; }, 25000);
    }, []);
    useEffect(() => { let alive = true, t: ReturnType<typeof setTimeout>; const poll = async () => { if (cursor.current === null && latestBoard.current)
        cursor.current = latestBoard.current.latestEvent; if (cursor.current !== null)
        try {
            const d = await api('events?after=' + cursor.current);
            if (!alive)
                return;
            setEventConnected(true);
            for (const ev of d.events) {
                cursor.current = ev.id;
                if (ev.status === 'ready') {
                    if (sound.current)
                        queue.current.push(ev);
                    else
                        setAnnouncement(ev);
                }
            }
            drain();
        }
        catch {
            setEventConnected(false);
        } if (alive)
        t = setTimeout(poll, 1500); }; poll(); return () => { alive = false; clearTimeout(t); sound.current = false; queue.current = []; if (watchdog.current)
        clearTimeout(watchdog.current); if ('speechSynthesis' in window)
        speechSynthesis.cancel(); }; }, [drain]);
    useEffect(() => { const tick = () => setClock(new Date().toLocaleTimeString('id-ID', { timeZone: config.timezone, hour: '2-digit', minute: '2-digit', second: '2-digit' })); tick(); const t = setInterval(tick, 1000), r = setInterval(() => setRotation(n => n + 1), 9000); return () => { clearInterval(t); clearInterval(r); }; }, [config.timezone]);
    const toggleSound = () => { if (!('speechSynthesis' in window)) {
        setAudioError('Perangkat ini tidak mendukung suara. Gunakan browser Chrome pada komputer yang terhubung ke TV.');
        return;
    } if (enabled) {
        sound.current = false;
        setEnabled(false);
        queue.current = [];
        if (watchdog.current)
            clearTimeout(watchdog.current);
        watchdog.current = null;
        speechSynthesis.cancel();
        speaking.current = false;
        return;
    } setAudioError(''); speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance('Panggilan antrean Plasma aktif.'); u.lang = 'id-ID'; u.onerror = () => { setAudioError('Suara tidak dapat diaktifkan. Periksa izin dan speaker.'); sound.current = false; setEnabled(false); }; speechSynthesis.speak(u); sound.current = true; setEnabled(true); };
    const ready = board?.orders.filter(o => o.status === 'ready') || [], waiting = board?.orders.filter(o => o.status !== 'ready') || [];
    const called = ready.find(o => o.id === announcement?.order_id) || ready.at(-1), others = ready.filter(o => o.id !== called?.id);
    const pages = Math.max(1, Math.ceil(waiting.length / 12)), rp = Math.max(1, Math.ceil(others.length / 4));
    return <main className="display"><header className="display-header"><div className="brand"><span className="brand-icon"><Coffee size={24}/></span>{config.name}</div><div className="display-clock"><strong suppressHydrationWarning>{clock}</strong><span>{board?.day} · {config.timezone.replace('Asia/', '')}</span></div></header>{(!connected || !eventConnected) && <div className="display-warning" role="alert">Koneksi terputus — antrean dan panggilan mungkin belum terbaru.</div>}{audioError && <div className="display-warning" role="alert">{audioError}</div>}<div className="display-main"><section className="now-calling"><p className="eyebrow"><Volume2 size={21}/> {called ? 'PESANAN SIAP DIAMBIL' : 'MENUNGGU PESANAN SIAP'}</p><div key={called?.id} className="call-number"><strong>{called ? queueNumber(called.number) : '—'}</strong><h1>{called?.customer || 'Selamat datang'}</h1></div>{called && called.day !== board?.day && <p className="previous-day">Pesanan tanggal {called.day}</p>}<p className="pickup-instruction">{called ? 'Silakan ambil pesanan Anda di konter.' : 'Pesanan Anda akan tampil dan dipanggil di sini.'}</p><div className="ready-strip">{others.slice((rotation % rp) * 4, (rotation % rp) * 4 + 4).map(o => <div key={o.id}><strong>{queueNumber(o.number)}</strong><span>{o.customer}</span>{o.day !== board?.day && <small>{o.day}</small>}</div>)}</div>{rp > 1 && <small>Pesanan siap lainnya · {rotation % rp + 1}/{rp}</small>}</section><section className="preparing-display"><div className="display-section-title"><h2><ChefHat size={25}/> Sedang disiapkan</h2><span>{waiting.length}</span></div><div className="display-queue">{waiting.slice((rotation % pages) * 12, (rotation % pages) * 12 + 12).map(o => <div key={o.id}><strong>{queueNumber(o.number)}</strong><span>{o.customer}</span><small>{statusNames[o.status]}{o.day !== board?.day ? ' · ' + o.day : ''}</small></div>)}</div>{!waiting.length && <div className="display-empty"><Coffee size={48}/><p>Belum ada pesanan dalam proses.</p></div>}{pages > 1 && <p className="display-pagination">Antrean {rotation % pages + 1} / {pages} · Berganti otomatis</p>}</section></div><footer className="display-footer"><span>{config.footer}</span><div><Button variant="ghost" onClick={toggleSound}>{enabled ? <Volume2 /> : <VolumeX />}{enabled ? 'Suara aktif' : 'Aktifkan suara'}</Button><Button variant="ghost" aria-label="Layar penuh" onClick={async () => { try {
        if (document.fullscreenElement)
            await document.exitFullscreen();
        else
            await document.documentElement.requestFullscreen();
    }
    catch {
        setAudioError('Layar penuh tidak tersedia. Gunakan tombol layar penuh perangkat.');
    } }}><Maximize /></Button><Button variant="ghost" aria-label="Keluar dari display" onClick={onLogout}><LogOut /></Button></div></footer></main>;
}
function History({ config, day, onReceipt }: {
    config: Config;
    day: string;
    onReceipt: (o: Order) => void;
}) {
    const [date, setDate] = useState(day), [search, setSearch] = useState(''), [page, setPage] = useState(1), [data, setData] = useState<any>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true);
    useEffect(() => { if (!date && day)
        setDate(day); }, [day, date]);
    useEffect(() => { if (!date)
        return; let alive = true; setLoading(true); const t = setTimeout(() => { api(`history?day=${date}&page=${page}&search=${encodeURIComponent(search)}`).then(d => { if (alive) {
        setData(d);
        setError('');
    } }).catch(e => { if (alive)
        setError(e.message); }).finally(() => { if (alive)
        setLoading(false); }); }, 250); return () => { alive = false; clearTimeout(t); }; }, [date, search, page]);
    return <section><div className="history-toolbar"><label>Tanggal<Input aria-label="Tanggal riwayat" type="date" value={date} onChange={e => { setDate(e.target.value); setPage(1); }}/></label><div className="search"><Search size={18}/><Input aria-label="Cari pesanan" placeholder="Nama atau nomor antrean" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}/></div></div>{error && <p className="banner error">{error}</p>}<div className="stats-row"><div className="stat"><span>Total pesanan</span><strong>{data?.summary.orders || 0}</strong></div><div className="stat"><span>Penjualan tercatat</span><strong>{money(data?.summary.sales || 0)}</strong></div><div className="stat"><span>Dibatalkan</span><strong>{data?.summary.cancelled || 0}</strong></div></div><div className="table-panel"><Table><TableHeader><TableRow>{['Antrean', 'Pelanggan', 'Waktu', 'Jenis', 'Total', 'Status', 'Struk'].map(t => <TableHead key={t}>{t}</TableHead>)}</TableRow></TableHeader><TableBody>{data?.orders.map((o: Order) => <TableRow key={o.id}><TableCell className="mono strong">{queueNumber(o.number)}</TableCell><TableCell>{o.customer}</TableCell><TableCell>{time(o.created_at, config.timezone)}</TableCell><TableCell>{o.mode === 'takeaway' ? 'Take away' : 'Dine in'}</TableCell><TableCell>{money(o.total)}</TableCell><TableCell><Status status={o.status}/></TableCell><TableCell><Button variant="ghost" size="icon" aria-label={'Struk ' + queueNumber(o.number)} onClick={() => onReceipt(o)}><Printer /></Button></TableCell></TableRow>)}</TableBody></Table>{loading ? <p className="loading-text">Memuat riwayat…</p> : !data?.orders.length ? <Empty title="Tidak ada pesanan">Pilih tanggal atau kata pencarian lain.</Empty> : null}</div><Pager page={page} pages={Math.max(1, Math.ceil((data?.count || 0) / 30))} onChange={setPage}/></section>;
}
function SettingsPanel({ config, products, onSave, onLogout }: {
    config: Config;
    products: Product[];
    onSave: (path: string, b: any) => Promise<any>;
    onLogout: () => void;
}) {
    const [tab, setTab] = useState('cafe'), [busy, setBusy] = useState(false), [users, setUsers] = useState<User[]>([]), [audit, setAudit] = useState<any[]>([]), [edit, setEdit] = useState<Partial<Product> | null>(null), [newUser, setNewUser] = useState(false), [role, setRole] = useState('cashier'), [error, setError] = useState('');
    const load = async () => { try {
        if (tab === 'users')
            setUsers((await api('users')).users);
        if (tab === 'audit')
            setAudit((await api('audit')).entries);
    }
    catch (e) {
        setError((e as Error).message);
    } };
    useEffect(() => { load(); }, [tab]);
    const save = async (path: string, values: any, done?: () => void) => { setBusy(true); setError(''); try {
        await onSave(path, values);
        await load();
        done?.();
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setBusy(false);
    } };
    return <section><Tabs value={tab} onValueChange={setTab}><TabsList className="category-tabs"><TabsTrigger value="cafe"><Settings />Identitas kafe</TabsTrigger><TabsTrigger value="menu"><Coffee />Menu</TabsTrigger><TabsTrigger value="users"><Users />Akun petugas</TabsTrigger><TabsTrigger value="audit"><Archive />Aktivitas</TabsTrigger><TabsTrigger value="password"><ShieldCheck />Kata sandi</TabsTrigger></TabsList>{error && <p className="banner error">{error}</p>}<TabsContent value="cafe"><form className="settings-form" onSubmit={e => { e.preventDefault(); save('settings', Object.fromEntries(new FormData(e.currentTarget))); }}><h2>Identitas & struk</h2><label>Nama kafe<Input name="name" defaultValue={config.name} maxLength={80} required/></label><label>Pesan di TV & struk<Textarea name="footer" defaultValue={config.footer} maxLength={200}/></label><div className="info-box"><Clock size={22}/><div><strong>Reset otomatis pukul 00.00</strong><p>Zona waktu: {config.timezone}. Nomor kembali ke A0001 untuk tanggal baru. Pesanan sebelumnya tetap disimpan.</p><p>Zona waktu dikunci setelah setup agar tanggal transaksi konsisten.</p></div></div><Button disabled={busy}>Simpan perubahan</Button></form></TabsContent><TabsContent value="menu"><div className="section-top"><h2>Daftar menu <span className="muted">({products.length})</span></h2><Button onClick={() => setEdit({ name: '', category: 'Kopi', price: 0, active: 1 })}><Plus />Tambah menu</Button></div><div className="table-panel"><Table><TableHeader><TableRow>{['Nama menu', 'Kategori', 'Harga', 'Status', 'Edit'].map(s => <TableHead key={s}>{s}</TableHead>)}</TableRow></TableHeader><TableBody>{products.map(p => <TableRow key={p.id}><TableCell className="strong">{p.name}</TableCell><TableCell>{p.category}</TableCell><TableCell>{money(p.price)}</TableCell><TableCell>{p.active ? 'Aktif' : 'Nonaktif'}</TableCell><TableCell><Button variant="ghost" aria-label={'Edit ' + p.name} onClick={() => setEdit(p)}><Pencil size={16}/></Button></TableCell></TableRow>)}</TableBody></Table></div></TabsContent><TabsContent value="users"><div className="section-top"><h2>Akun & akses</h2><Button onClick={() => setNewUser(true)}><Plus />Tambah akun</Button></div><div className="table-panel"><Table><TableHeader><TableRow>{['Nama', 'Username', 'Peran', 'Akses'].map(s => <TableHead key={s}>{s}</TableHead>)}</TableRow></TableHeader><TableBody>{users.map(u => <TableRow key={u.id}><TableCell>{u.name}</TableCell><TableCell>{u.username}</TableCell><TableCell>{roleNames[u.role]}</TableCell><TableCell>{u.role === 'admin' ? 'Admin utama' : <Switch aria-label={'Akses ' + u.name} checked={!!u.active} disabled={busy} onCheckedChange={active => save('users/access', { id: u.id, active })}/>}</TableCell></TableRow>)}</TableBody></Table></div><p className="muted settings-help">Gunakan akun display di perangkat TV. Akun ini hanya dapat membaca antrean dan menerima panggilan.</p></TabsContent><TabsContent value="audit"><div className="table-panel"><Table><TableHeader><TableRow>{['Waktu', 'Petugas', 'Aktivitas', 'ID objek'].map(s => <TableHead key={s}>{s}</TableHead>)}</TableRow></TableHeader><TableBody>{audit.map(a => <TableRow key={a.id}><TableCell>{new Date(a.created_at).toLocaleString('id-ID', { timeZone: config.timezone })}</TableCell><TableCell>{a.name}</TableCell><TableCell>{a.action}</TableCell><TableCell className="mono">{a.target}</TableCell></TableRow>)}</TableBody></Table></div><p className="muted settings-help">Menampilkan 100 aktivitas terbaru.</p></TabsContent><TabsContent value="password"><form className="settings-form" onSubmit={e => { e.preventDefault(); save('password', Object.fromEntries(new FormData(e.currentTarget)), () => { window.location.href = '/'; }); }}><h2>Ubah kata sandi</h2><label>Kata sandi saat ini<Input type="password" name="current" required autoComplete="current-password"/></label><label>Kata sandi baru<Input type="password" name="password" minLength={10} maxLength={128} required autoComplete="new-password"/></label><p className="muted">Semua sesi akun ini akan keluar setelah kata sandi diubah.</p><Button disabled={busy}>Ubah kata sandi</Button></form></TabsContent></Tabs><Dialog open={!!edit} onOpenChange={v => { if (!v)
        setEdit(null); }}><DialogContent><DialogHeader><DialogTitle>{edit?.id ? 'Edit menu' : 'Tambah menu'}</DialogTitle><DialogDescription>Harga pada pesanan yang sudah tersimpan tidak ikut berubah.</DialogDescription></DialogHeader>{edit && <form className="dialog-form" onSubmit={e => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.currentTarget)); save('products', { ...d, id: edit.id, price: Number(d.price), active: !!edit.active }, () => setEdit(null)); }}><label>Nama menu<Input name="name" defaultValue={edit.name} required maxLength={80}/></label><label>Kategori<Input name="category" defaultValue={edit.category} required maxLength={40}/></label><label>Harga (Rp)<Input type="number" name="price" defaultValue={edit.price} min={0} max={100000000} step={1} required/></label><div className="switch-row"><Switch id="product-active" checked={!!edit.active} onCheckedChange={active => setEdit({ ...edit, active: active ? 1 : 0 })}/><Label htmlFor="product-active">Menu aktif</Label></div><Button disabled={busy}>Simpan menu</Button></form>}</DialogContent></Dialog><Dialog open={newUser} onOpenChange={setNewUser}><DialogContent><DialogHeader><DialogTitle>Tambah akun petugas</DialogTitle><DialogDescription>Buat akses terpisah untuk setiap petugas atau perangkat TV.</DialogDescription></DialogHeader><form className="dialog-form" onSubmit={e => { e.preventDefault(); save('users', { ...Object.fromEntries(new FormData(e.currentTarget)), role }, () => setNewUser(false)); }}><label>Nama<Input name="name" required maxLength={80}/></label><label>Username<Input name="username" required maxLength={40} pattern="[A-Za-z0-9._\-]+" autoComplete="off"/></label><label>Kata sandi<Input name="password" type="password" required minLength={10} maxLength={128} autoComplete="new-password"/></label><label>Peran<SelectField value={role} onChange={setRole} label="Peran petugas" options={[['cashier', 'Kasir'], ['kitchen', 'Dapur'], ['display', 'TV display']]}/></label><Button disabled={busy}>Buat akun</Button></form></DialogContent></Dialog></section>;
}
