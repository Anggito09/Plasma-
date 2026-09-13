'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Coffee, Monitor, ChefHat, ReceiptText, Settings, LogOut, Search, Plus, Minus, ShoppingBag, Utensils, ArrowRight, Volume2, VolumeX, Maximize, Check, Clock, RotateCcw, Printer, X, Users, ShieldCheck, Ticket, ChevronLeft, ChevronRight, Loader2, Pencil, Archive, Wallet, TrendingUp, TrendingDown, Trash2, Sparkles, Store, CupSoda, CakeSlice, Sandwich, Cookie, Croissant, Donut, Milk, Leaf, Snowflake, GlassWater, Citrus, Soup, Salad, Popcorn, Drumstick } from 'lucide-react';
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

type User = { id: string; name: string; username: string; role: string; active?: number };
type Config = { name: string; timezone: string; footer: string };
type Item = { id: string; name: string; price: number; quantity: number };
type Product = { id: string; name: string; category: string; price: number; active: number };
type Payment = { id: string; name: string; active: number };
type Order = { id: string; day: string; number: number; customer: string; mode: string; items: Item[]; note: string; total: number; payment: string; status: string; created_at: number; version: number; cancel_reason?: string; prepared_at?: number | null; ready_at?: number | null; completed_at?: number | null };
type Board = { orders: Order[]; stats?: { total: number; completed: number; sales: number }; latestEvent: number; day: string; serverTime: number };
type Expense = { id: string; day: string; category: string; note: string; amount: number; created_at: number; author?: string };

const money = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);
const fmtDur = (ms?: number | null) => {
  if (!ms || ms < 0) return '–';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} dtk`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} mnt`;
  return `${Math.floor(m / 60)} j ${m % 60} mnt`;
};
const statusNames: Record<string, string> = { waiting: 'Menunggu', preparing: 'Diproses', ready: 'Siap diambil', completed: 'Selesai', cancelled: 'Dibatalkan' };
const roleNames: Record<string, string> = { admin: 'Admin', cashier: 'Kasir', kitchen: 'Dapur', display: 'TV' };
const expenseNames: Record<string, string> = { bahan: 'Bahan baku', operasional: 'Operasional', gaji: 'Gaji', lainnya: 'Lainnya' };
const viewTitles: Record<string, { title: string; sub: string }> = {
  kasir: { title: 'Kasir', sub: 'Buat pesanan dalam 3 langkah' },
  dapur: { title: 'Dapur', sub: 'Ketuk kartu untuk pindah status' },
  riwayat: { title: 'Riwayat', sub: 'Cari pesanan & cetak ulang struk' },
  keuangan: { title: 'Keuangan', sub: 'Masuk, keluar, dan laba bersih' },
  pengaturan: { title: 'Pengaturan', sub: 'Kafe, menu, dan petugas' },
};
const time = (n: number, tz = 'Asia/Jakarta') => new Date(n).toLocaleTimeString('id-ID', { timeZone: tz, hour: '2-digit', minute: '2-digit' });

function SelectField({ value, onChange, options, label }: { value: string; onChange: (s: string) => void; options: [string, string][]; label: string }) {
  return <Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label}><SelectValue /></SelectTrigger><SelectContent>{options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>;
}
async function api(path: string, body?: unknown): Promise<any> {
  const r = await fetch('/api/' + path, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  let d: any;
  try { d = await r.json(); } catch { throw new Error('Tidak terhubung ke server.'); }
  if (!r.ok) { const e = new Error(d.error || 'Gagal memproses.') as Error & { status: number }; e.status = r.status; throw e; }
  return d;
}
function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return <div className="empty"><Ticket size={30} /><h3>{title}</h3><p>{children}</p></div>;
}
function Status({ status }: { status: string }) { return <span className={'status ' + status}>{statusNames[status]}</span>; }
function Brand({ name, sub }: { name: string; sub?: string }) {
  const initial = (name.trim()[0] || 'T').toUpperCase();
  return (
    <a className="brand" href="/">
      <span className="cafe-mark" aria-hidden="true">{initial}</span>
      <span className="brand-text">{name}<small>{sub || 'Oleh Temancipta'}</small></span>
    </a>
  );
}

export default function Temancipta({ view = 'kasir' }: { view?: string }) {
  const [user, setUser] = useState<User | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [boot, setBoot] = useState<'loading' | 'setup' | 'login' | 'ready'>('loading');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [board, setBoard] = useState<Board | null>(null);
  const [connected, setConnected] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [receipt, setReceipt] = useState<Order | null>(null);

  const loadMe = useCallback(async () => { const d = await api('me'); setUser(d.user); setConfig(d.config); setBoot('ready'); }, []);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await api('bootstrap');
        if (!alive) return;
        if (!d.configured) setBoot('setup');
        else try { await loadMe(); } catch { if (alive) setBoot('login'); }
      } catch (e) { setError((e as Error).message); setBoot('login'); }
    })();
    return () => { alive = false; };
  }, [loadMe]);

  const refresh = useCallback(async () => {
    try { const b = await api('board'); setBoard(b); setConnected(true); }
    catch (e) {
      setConnected(false);
      if ((e as any).status === 401) { setUser(null); setBoot('login'); }
      throw e;
    }
  }, []);
  useEffect(() => {
    if (!user) return;
    let alive = true, t: ReturnType<typeof setTimeout>;
    const poll = async () => { try { await refresh(); } catch { } if (alive) t = setTimeout(poll, 3000); };
    poll();
    return () => { alive = false; clearTimeout(t); };
  }, [user, refresh]);

  const loadProducts = useCallback(async () => { const d = await api('products'); setProducts(d.products); }, []);
  const loadPayments = useCallback(async () => { try { const d = await api('payments'); setPayments(d.payments); } catch { } }, []);
  useEffect(() => { if (user && ['admin', 'cashier'].includes(user.role)) loadProducts().catch(e => setError(e.message)); }, [user, loadProducts]);
  useEffect(() => { if (user && ['admin', 'cashier'].includes(user.role)) loadPayments(); }, [user, loadPayments]);

  const message = (s: string) => { setNotice(s); setError(''); };
  const perform = async (path: string, body: unknown) => {
    setError('');
    try { const d = await api(path, body); await refresh().catch(() => { }); return d; }
    catch (e) { setError((e as Error).message); throw e; }
  };
  const logout = async () => {
    try { await api('logout', {}); setUser(null); setBoard(null); setBoot('login'); }
    catch (e) { setError((e as Error).message); }
  };

  if (boot !== 'ready' || !user || !config)
    return <Auth boot={boot} error={error} notice={notice} onSubmit={async (values) => {
      setError('');
      try {
        if (boot === 'setup') { await api('setup', values); setBoot('login'); setNotice('Kafe siap. Masuk dengan akun admin.'); }
        else { await api('login', values); await loadMe(); }
      } catch (e) { setError((e as Error).message); throw e; }
    }} />;

  const actualView = user.role === 'display' ? 'display' : user.role === 'kitchen' && view !== 'display' ? 'dapur' : view;
  if (actualView === 'display') return <Display config={config} board={board} connected={connected} onLogout={logout} />;
  const isAdmin = user.role === 'admin';
  const navigation = [
    ['kasir', '/', Coffee, 'Kasir'],
    ['dapur', '/dapur', ChefHat, 'Dapur'],
    ['riwayat', '/riwayat', ReceiptText, 'Riwayat'],
    ...(isAdmin ? [['keuangan', '/keuangan', Wallet, 'Keuangan'] as const] : []),
    ...(isAdmin ? [['pengaturan', '/pengaturan', Settings, 'Pengaturan'] as const] : []),
  ] as const;
  const head = viewTitles[actualView] || viewTitles.kasir;

  return (
    <>
      <div className="app-shell no-print">
        <header className="topbar">
          <Brand name={config.name} />
          <nav aria-label="Navigasi utama">
            {navigation.filter(([v]) => isAdmin || user.role === 'cashier' && v !== 'pengaturan' || user.role === 'kitchen' && v === 'dapur').map(([v, href, Icon, label]) => (
              <a key={v} href={href} className={actualView === v ? 'active' : ''}><Icon size={18} />{label}</a>
            ))}
          </nav>
          <div className="topbar-right">
            <a className="tv-link" href="/display" target="_blank" rel="noreferrer"><Monitor size={16} />TV</a>
            <div className="profile"><span>{user.name.slice(0, 1).toUpperCase()}</span><div><strong>{user.name}</strong><small>{roleNames[user.role]}</small></div></div>
            <Button variant="ghost" size="icon" aria-label="Keluar" onClick={logout}><LogOut /></Button>
          </div>
        </header>

        <div className="workspace-head">
          <div>
            <p className="eyebrow">{config.name}</p>
            <h1>{head.title}</h1>
            <p className="muted">{head.sub}</p>
          </div>
          <div className="connection"><span className={connected ? 'online' : 'offline'} />{connected ? 'Live' : 'Menyambung…'}<small>{board?.day}</small></div>
        </div>

        {error && <div className="banner error" role="alert">{error}<button onClick={() => setError('')} aria-label="Tutup pesan"><X size={17} /></button></div>}
        {notice && <div className="banner success" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Tutup pesan"><X size={17} /></button></div>}

        {actualView === 'kasir' && <Cashier products={products} payments={payments} board={board} config={config} connected={connected} onSave={async (b) => {
          let d;
          try { d = await perform('orders', b); } catch (e) { await loadProducts().catch(() => { }); throw e; }
          setReceipt(d.order); message(`${queueNumber(d.order.number)} tersimpan. Struk siap.`); return d;
        }} onReceipt={setReceipt} />}
        {actualView === 'dapur' && <Kitchen board={board} config={config} user={user} connected={connected} onAction={b => perform('orders/action', b)} onReceipt={setReceipt} />}
        {actualView === 'riwayat' && <History config={config} day={board?.day || ''} onReceipt={setReceipt} />}
        {actualView === 'keuangan' && isAdmin && <Finance config={config} day={board?.day || ''} onSaved={(s) => message(s)} />}
        {actualView === 'pengaturan' && isAdmin && <SettingsPanel config={config} products={products} payments={payments} onSave={async (path, b) => {
          const d = await perform(path, b);
          if (path === 'settings') await loadMe();
          if (path === 'products') await loadProducts();
          if (path === 'payments') await loadPayments();
          message('Tersimpan.'); return d;
        }} onLogout={logout} />}
        <footer className="app-foot"><img src="/logo-temancipta.svg" alt="Temancipta" className="foot-logo" /><span>Oleh Temancipta · untuk kafe & UMKM</span></footer>
      </div>
      <Dialog open={!!receipt} onOpenChange={open => { if (!open) setReceipt(null); }}>
        <DialogContent className="receipt-dialog no-print">
          <DialogHeader><DialogTitle>Struk {receipt && queueNumber(receipt.number)}</DialogTitle><DialogDescription>Kertas thermal 80 mm.</DialogDescription></DialogHeader>
          {receipt && <Receipt order={receipt} config={config} />}
          <Button onClick={() => window.print()}><Printer />Cetak</Button>
        </DialogContent>
      </Dialog>
      {receipt && <div className="print-only"><Receipt order={receipt} config={config} /></div>}
    </>
  );
}

function Auth({ boot, error, notice, onSubmit }: { boot: string; error: string; notice: string; onSubmit: (v: any) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [tz, setTz] = useState('Asia/Jakarta');
  const [sample, setSample] = useState(true);
  return (
    <main className="auth">
      <section className="auth-brand">
        <div className="brand">
          <img src="/logo-temancipta.svg" alt="Temancipta" className="brand-logo-wide" />
        </div>
        <div className="auth-hero">
          <p className="eyebrow light">KASIR • DAPUR • TV ANTREAN • KEUANGAN</p>
          <h1>Kasir & antrean<br />untuk kafe Anda.</h1>
          <p className="auth-desc">Kelola pesanan, dapur, TV antrean bersuara, dan keuangan dalam satu aplikasi yang cepat dan rapi.</p>
          <div className="auth-steps">
            <span><b>1</b>Kami daftarkan usaha Anda</span>
            <span><b>2</b>Petugas tinggal login</span>
            <span><b>3</b>Jualan langsung jalan</span>
          </div>
        </div>
      </section>
      <section className="auth-form">
        {boot === 'loading' ? <><Loader2 className="spin" /><p>Menghubungkan…</p></> : (
          <form onSubmit={async (e) => {
            e.preventDefault();
            const v = Object.fromEntries(new FormData(e.currentTarget));
            setBusy(true);
            try { await onSubmit({ ...v, timezone: tz, sampleMenu: sample }); } catch { } finally { setBusy(false); }
          }}>
            <p className="eyebrow">MASUK PETUGAS</p>
            <h2>{boot === 'setup' ? 'Daftarkan usaha' : 'Masuk'}</h2>
            <p className="muted">{boot === 'setup' ? 'Hanya diisi sekali oleh penyedia layanan.' : 'Gunakan akun dari admin usaha Anda.'}</p>
            {error && <p className="banner error" role="alert">{error}</p>}
            {notice && <p className="banner success">{notice}</p>}
            {boot === 'setup' && (
              <>
                <label>Nama kafe<Input name="cafe" required maxLength={80} placeholder="cth: Kopi Sudirman" /></label>
                <label>Nama admin<Input name="name" required maxLength={80} /></label>
                <label>Zona waktu<SelectField label="Zona waktu" value={tz} onChange={setTz} options={[['Asia/Jakarta', 'WIB — Jakarta'], ['Asia/Makassar', 'WITA — Makassar'], ['Asia/Jayapura', 'WIT — Jayapura']]} /></label>
                <label>Kunci setup <span className="muted">(khusus penyedia layanan)</span><Input name="setupKey" type="password" autoComplete="off" /></label>
              </>
            )}
            <label>Username<Input name="username" required autoComplete="username" maxLength={40} pattern="[A-Za-z0-9._\-]+" placeholder="cth: admin" /></label>
            <label>Kata sandi<Input name="password" type="password" required minLength={boot === 'setup' ? 10 : 1} maxLength={128} autoComplete={boot === 'setup' ? 'new-password' : 'current-password'} placeholder={boot === 'setup' ? 'Minimal 10 karakter' : '••••••••'} /></label>
            {boot === 'setup' && <div className="switch-row"><Switch id="sample" checked={sample} onCheckedChange={setSample} /><Label htmlFor="sample">Isi contoh menu</Label></div>}
            <Button className="full" disabled={busy}>{busy ? <Loader2 className="spin" /> : null}{boot === 'setup' ? 'Simpan' : 'Masuk'}<ArrowRight /></Button>
          </form>
        )}
      </section>
    </main>
  );
}

function menuIcon(p: { name: string; category: string }) {
  const n = p.name.toLowerCase();
  if (/croissant|roti bakar|pisang goreng/.test(n)) return { Icon: Croissant, cls: 'category-bakery' };
  if (/donat|donut/.test(n)) return { Icon: Donut, cls: 'category-bakery' };
  if (/brownies|brownis|brownie|cake|kue/.test(n)) return { Icon: CakeSlice, cls: 'category-bakery' };
  if (/kukis|cookie/.test(n)) return { Icon: Cookie, cls: 'category-snack' };
  if (/kentang|fries/.test(n)) return { Icon: Popcorn, cls: 'category-snack' };
  if (/sandwich|burger/.test(n)) return { Icon: Sandwich, cls: 'category-food' };
  if (/soto|sop|soup/.test(n)) return { Icon: Soup, cls: 'category-food' };
  if (/salad/.test(n)) return { Icon: Salad, cls: 'category-food' };
  if (/nasi|mie|mi |ayam/.test(n)) return { Icon: Drumstick, cls: 'category-food' };
  if (/soda|squash|mojito|gembira/.test(n)) return { Icon: CupSoda, cls: 'category-cold' };
  if (/es |iced|cold|dingin/.test(n)) return { Icon: Snowflake, cls: 'category-cold' };
  if (/matcha|cokelat|chocolate|susu|milk|vanilla|jahe/.test(n)) return { Icon: Milk, cls: 'category-milky' };
  if (/teh|tea|lemon|leci|melati/.test(n)) return { Icon: Leaf, cls: 'category-tea' };
  if (/kopi|coffee|espresso|latte|cappuccino|americano|mocha|brew|tubruk|drip/.test(n)) return { Icon: Coffee, cls: 'category-coffee' };
  if (p.category === 'Makanan') return { Icon: Utensils, cls: 'category-food' };
  if (p.category === 'Teh') return { Icon: Leaf, cls: 'category-tea' };
  if (p.category === 'Roti & Kue') return { Icon: Croissant, cls: 'category-bakery' };
  if (/jus|juice|jeruk|alpukat|mangga/.test(n)) return { Icon: Citrus, cls: 'category-cold' };
  return { Icon: GlassWater, cls: 'category-drink' };
}

function Cashier({ products, payments, board, config, connected, onSave, onReceipt }: { products: Product[]; payments: Payment[]; board: Board | null; config: Config; connected: boolean; onSave: (b: any) => Promise<any>; onReceipt: (o: Order) => void }) {
  const [cart, setCart] = useState<Item[]>([]);
  const [customer, setCustomer] = useState('');
  const [note, setNote] = useState('');
  const [mode, setMode] = useState('dine-in');
  const [payment, setPayment] = useState('Tunai');
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setCart(items => items.map(i => { const p = products.find(p => p.id === i.id); return p ? { ...i, price: p.price, name: p.name } : i; })); }, [products]);
  const pending = useRef<{ id: string; payload: string } | null>(null);
  const active = products.filter(p => p.active);
  const categories = [...new Set(active.map(p => p.category))];
  const filtered = active.filter(p => (category === 'all' || p.category === category) && p.name.toLowerCase().includes(search.toLowerCase()));
  const add = (p: Product) => setCart(c => { const old = c.find(i => i.id === p.id); return old ? c.map(i => i.id === p.id ? { ...i, quantity: Math.min(i.quantity + 1, 99) } : i) : [...c, { ...p, quantity: 1 }]; });
  const total = cart.reduce((s, i) => s + i.quantity * i.price, 0);
  const count = cart.reduce((s, i) => s + i.quantity, 0);
  const stats = [
    ['Hari ini', board?.stats?.total || 0, ReceiptText],
    ['Antre', board?.orders.filter(o => o.status !== 'ready').length || 0, Clock],
    ['Siap', board?.orders.filter(o => o.status === 'ready').length || 0, ShoppingBag],
  ] as const;
  const methods = payments.filter(p => p.active);
  const method = methods.some(m => m.name === payment) ? payment : (methods[0]?.name || 'Tunai');
  const [qrisOpen, setQrisOpen] = useState(false);
  const [bankListOpen, setBankListOpen] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrisMissing, setQrisMissing] = useState(false);
  const isBankName = (n: string) => !/qris/i.test(n) && !/^(tunai|cash|kartu|card)$/i.test(n.trim());
  const isBank = isBankName(method);
  const bankMethods = methods.filter(m => !/^(tunai|cash)$/i.test(m.name) && !/qris/i.test(m.name));
  const bankParts = method.split(' - ');
  const bankName = bankParts[0];
  const bankNumber = bankParts.slice(1).join(' - ');
  const choosePay = (v: string) => {
    setCopied(false);
    if (/qris/i.test(v)) { setPayment('QRIS'); setQrisOpen(true); }
    else if (/^(kartu|card)$/i.test(v.trim())) setBankListOpen(true);
    else setPayment(v);
  };
  const chooseBank = (name: string) => { setPayment(name); setCopied(false); setBankListOpen(false); setBankOpen(true); };
  const copyNumber = async () => {
    const text = bankNumber || method;
    try { await navigator.clipboard.writeText(text); }
    catch { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };
  return (
    <>
      <ol className="steps"><li className={cart.length ? 'done' : 'now'}><b>1</b>Pilih menu</li><li className={cart.length && !customer.trim() ? 'now' : customer.trim() ? 'done' : ''}><b>2</b>Nama pelanggan</li><li className={cart.length && customer.trim() ? 'now' : ''}><b>3</b>Simpan</li></ol>
      <div className="stats-row">{stats.map(([label, val, Icon]) => <div className="stat" key={label}><span><Icon size={19} />{label}</span><strong>{val}</strong></div>)}</div>
      <div className="cashier-grid">
        <section className="menu-area">
          <div className="section-top">
            <div><h2>Menu</h2><p className="muted">{active.length} tersedia</p></div>
            <div className="search"><Search size={17} /><Input placeholder="Cari…" aria-label="Cari menu" value={search} onChange={e => setSearch(e.target.value)} /></div>
          </div>
          <Tabs value={category} onValueChange={setCategory}><TabsList className="category-tabs"><TabsTrigger value="all">Semua</TabsTrigger>{categories.map(c => <TabsTrigger key={c} value={c}>{c}</TabsTrigger>)}</TabsList></Tabs>
          <div className="menu-grid">
            {filtered.map((p, i) => {
              const qty = cart.find(i => i.id === p.id)?.quantity || 0;
              const { Icon, cls } = menuIcon(p);
              return (
                <button disabled={busy} className={'menu-card' + (qty ? ' in-cart' : '')} key={p.id} onClick={() => add(p)} style={{ animationDelay: `${Math.min(i * 35, 350)}ms` }}>
                  <span className={'menu-symbol ' + cls}><Icon size={28} /></span>
                  <span className="menu-category">{p.category}</span>
                  <strong>{p.name}</strong>
                  <span className="menu-bottom">{money(p.price)}<span className="add-icon"><Plus size={16} /></span></span>
                  {!!qty && <span className="menu-count">{qty}</span>}
                </button>
              );
            })}
          </div>
          {!filtered.length && <Empty title={active.length ? 'Tidak ketemu' : 'Belum ada menu'}>{active.length ? 'Coba kata lain.' : 'Tambah lewat Pengaturan → Menu.'}</Empty>}
          <section className="recent-orders">
            <div className="section-top"><h2>Aktif terbaru</h2><a href="/dapur">Dapur <ArrowRight size={14} /></a></div>
            {board?.orders.length ? board.orders.slice(-5).reverse().map(o => (
              <button className="recent-row" key={o.id} onClick={() => onReceipt(o)}>
                <strong>{queueNumber(o.number)}</strong>
                <span>{o.customer}<small>{time(o.created_at, config.timezone)}</small></span>
                <Status status={o.status} />
              </button>
            )) : <p className="muted">Belum ada pesanan aktif.</p>}
          </section>
        </section>
        <aside className="cart">
          <div className="cart-heading"><div><h2>Pesanan</h2><p>{count} item</p></div><ReceiptText size={22} /></div>
          <form onSubmit={async (e) => {
            e.preventDefault();
            if (!cart.length || busy) return;
            setBusy(true);
            const data = { customer: customer.trim(), mode, payment: method, note, expectedTotal: total, items: cart.map(i => ({ id: i.id, quantity: i.quantity })) };
            const payload = JSON.stringify(data);
            if (!pending.current || pending.current.payload !== payload) pending.current = { id: crypto.randomUUID(), payload };
            try { await onSave({ ...data, id: pending.current.id }); setCart([]); setCustomer(''); setNote(''); pending.current = null; }
            catch { } finally { setBusy(false); }
          }}>
            <fieldset disabled={busy}>
              <label>Nama pelanggan <span className="required">*</span><Input required maxLength={60} value={customer} onChange={e => setCustomer(e.target.value)} placeholder="Nama untuk dipanggil" /></label>
              <Tabs value={mode} onValueChange={setMode}><TabsList className="mode-tabs"><TabsTrigger value="dine-in"><Utensils size={15} />Di sini</TabsTrigger><TabsTrigger value="takeaway"><ShoppingBag size={15} />Bawa pulang</TabsTrigger></TabsList></Tabs>
              <div className="cart-items">
                {cart.length ? cart.map(i => (
                  <div className="cart-item" key={i.id}>
                    <div><strong>{i.name}</strong><small>{money(i.price)}</small></div>
                    <div className="quantity">
                      <button type="button" aria-label={'Kurangi ' + i.name} onClick={() => setCart(c => c.map(x => x.id === i.id ? { ...x, quantity: x.quantity - 1 } : x).filter(x => x.quantity > 0))}><Minus size={14} /></button>
                      <span>{i.quantity}</span>
                      <button type="button" aria-label={'Tambah ' + i.name} onClick={() => setCart(c => c.map(x => x.id === i.id ? { ...x, quantity: Math.min(x.quantity + 1, 99) } : x))}><Plus size={14} /></button>
                    </div>
                  </div>
                )) : <div className="cart-empty"><ShoppingBag size={30} /><p>Kosong</p><small>Ketuk menu untuk isi.</small></div>}
              </div>
              <label>Catatan<Textarea maxLength={300} rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="cth: less ice" /></label>
              <label>Bayar pakai<SelectField label="Pembayaran" value={isBank ? 'Kartu' : method} onChange={choosePay} options={[['Tunai', 'Tunai'], ['QRIS', 'QRIS'], ['Kartu', 'Kartu / Bank']]} /></label>
              {/qris/i.test(method) && (
                <div className="qris-box">
                  {!qrisMissing ? <img src="/qris.png" alt="QRIS kafe" className="qris-img" onError={() => setQrisMissing(true)} /> : <p className="muted">QR belum dipasang — simpan file public/qris.png lalu deploy ulang.</p>}
                  <p><strong>{money(total)}</strong> · Pelanggan scan untuk bayar</p>
                  <Button type="button" variant="outline" onClick={() => setQrisOpen(true)}><Maximize size={15} /> Lihat QR besar</Button>
                </div>
              )}
              {isBank && (
                <div className="bank-box">
                  <p>Transfer ke <strong>{bankName}</strong></p>
                  <p className="mono">{bankNumber || method}</p>
                  <p><strong>{money(total)}</strong></p>
                  <Button type="button" variant="outline" onClick={() => setBankOpen(true)}>Detail transfer</Button>
                </div>
              )}
              <div className="total"><span>Total</span><strong>{money(total)}</strong></div>
              <Button type="submit" className="full submit-order" disabled={!cart.length || !customer.trim() || busy || !connected}>{busy ? <Loader2 className="spin" /> : <ReceiptText />}{busy ? 'Menyimpan…' : 'Simpan pesanan'}<ArrowRight /></Button>
            </fieldset>
          </form>
        </aside>
      </div>
      <Dialog open={qrisOpen} onOpenChange={setQrisOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Scan QRIS</DialogTitle><DialogDescription>{money(total)} · pastikan nominal sesuai</DialogDescription></DialogHeader>
          {!qrisMissing ? <img src="/qris.png" alt="QRIS kafe" className="qris-big" onError={() => setQrisMissing(true)} /> : <p className="muted">QR belum dipasang — simpan file public/qris.png lalu deploy ulang.</p>}
          <Button onClick={() => setQrisOpen(false)}>Tutup</Button>
        </DialogContent>
      </Dialog>
      <Dialog open={bankListOpen} onOpenChange={setBankListOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Pilih bank / kartu</DialogTitle><DialogDescription>{money(total)}</DialogDescription></DialogHeader>
          <div className="bank-list">
            {bankMethods.map(b => (
              <button key={b.id} type="button" className="bank-pick" onClick={() => chooseBank(b.name)}>
                <strong>{b.name.split(' - ')[0]}</strong>
                <small className="mono">{b.name.split(' - ').slice(1).join(' - ') || 'EDC'}</small>
              </button>
            ))}
            {!bankMethods.length && <p className="muted">Belum ada bank. Tambah di Pengaturan → Bayar.</p>}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={bankOpen} onOpenChange={setBankOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Transfer {bankName}</DialogTitle><DialogDescription>{money(total)} · cek nominal sebelum kirim</DialogDescription></DialogHeader>
          <div className="bank-big"><span>{bankName}</span>{bankNumber ? <strong className="mono">{bankNumber}</strong> : <strong>Bayar dengan kartu di EDC.</strong>}</div>
          {bankNumber ? <Button onClick={copyNumber}>{copied ? <Check size={16} /> : null}{copied ? 'Disalin!' : 'Salin nomor'}</Button> : <Button onClick={() => setBankOpen(false)}>Tutup</Button>}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Kitchen({ board, config, user, connected, onAction, onReceipt }: { board: Board | null; config: Config; user: User; connected: boolean; onAction: (b: any) => Promise<any>; onReceipt: (o: Order) => void }) {
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState('');
  const [cancel, setCancel] = useState<Order | null>(null);
  const [reason, setReason] = useState('');
  const filtered = board?.orders.filter(o => filter === 'all' || o.status === filter) || [];
  const pages = Math.max(1, Math.ceil(filtered.length / 12));
  const current = Math.min(page, pages);
  const pending = useRef(new Map<string, string>());
  const act = async (o: Order, action: string) => {
    if (busy) return;
    const key = o.id + ':' + action;
    const requestId = pending.current.get(key) || crypto.randomUUID();
    pending.current.set(key, requestId);
    setBusy(o.id);
    try { await onAction({ id: o.id, version: o.version, action, requestId, reason }); pending.current.delete(key); setCancel(null); setReason(''); }
    catch { } finally { setBusy(''); }
  };
  return (
    <section>
      <div className="section-top kitchen-toolbar">
        <Tabs value={filter} onValueChange={v => { setFilter(v); setPage(1); }}>
          <TabsList className="category-tabs">{['all', 'waiting', 'preparing', 'ready'].map(s => <TabsTrigger key={s} value={s}>{s === 'all' ? 'Semua' : statusNames[s]} <span className="tab-count">{board?.orders.filter(o => s === 'all' || o.status === s).length || 0}</span></TabsTrigger>)}</TabsList>
        </Tabs>
      </div>
      <div className="kitchen-grid">
        {filtered.slice((current - 1) * 12, current * 12).map(o => (
          <article className={'order-card ' + o.status} key={o.id}>
            <header><strong>{queueNumber(o.number)}</strong><Status status={o.status} /></header>
            <h2>{o.customer}</h2>
            <p className="order-meta">{o.mode === 'takeaway' ? 'Bawa pulang' : 'Di sini'} · {time(o.created_at, config.timezone)} · {Math.max(0, Math.floor(((board?.serverTime || o.created_at) - o.created_at) / 60000))} mnt</p>
            <ul>{o.items.map(i => <li key={i.id}><b>{i.quantity}×</b><span>{i.name}</span></li>)}</ul>
            {o.note && <p className="order-note">{o.note}</p>}
            <footer>
              {o.status === 'waiting' && <Button disabled={!!busy || !connected} onClick={() => act(o, 'prepare')} className="full"><ChefHat />Proses</Button>}
              {o.status === 'preparing' && <Button disabled={!!busy || !connected} onClick={() => act(o, 'ready')} className="full ready-button"><Volume2 />Siap & panggil</Button>}
              {o.status === 'ready' && <div className="ready-actions"><Button disabled={!!busy || !connected} variant="outline" onClick={() => act(o, 'recall')}><RotateCcw />Ulangi</Button><Button disabled={!!busy || !connected} onClick={() => act(o, 'complete')}><Check />Diambil</Button></div>}
              <div className="card-secondary">
                <Button variant="ghost" size="sm" onClick={() => onReceipt(o)}><Printer />Struk</Button>
                {user.role !== 'kitchen' && <Button variant="ghost" size="sm" onClick={() => setCancel(o)}>Batal</Button>}
              </div>
            </footer>
          </article>
        ))}
      </div>
      {!filtered.length && <Empty title="Antrean kosong">Pesanan baru muncul otomatis.</Empty>}
      <Pager page={current} pages={pages} onChange={setPage} />
      <Dialog open={!!cancel} onOpenChange={v => { if (!v) setCancel(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Batalkan {cancel && queueNumber(cancel.number)}?</DialogTitle><DialogDescription>Tetap tersimpan di riwayat.</DialogDescription></DialogHeader>
          <label>Alasan<Textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={200} /></label>
          <Button variant="destructive" disabled={!reason.trim() || !!busy} onClick={() => cancel && act(cancel, 'cancel')}>Ya, batalkan</Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Pager({ page, pages, onChange }: { page: number; pages: number; onChange: (n: number) => void }) {
  return <div className="pager"><Button variant="outline" size="icon" aria-label="Sebelumnya" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft /></Button><span>{page} / {pages}</span><Button variant="outline" size="icon" aria-label="Berikutnya" disabled={page >= pages} onClick={() => onChange(page + 1)}><ChevronRight /></Button></div>;
}

function Receipt({ order: o, config }: { order: Order; config: Config }) {
  return (
    <article className="receipt">
      <img src="/logo-temancipta.svg" alt="Temancipta" className="receipt-logo wide" />
      <h2>{config.name}</h2>
      <p>{o.day} · {time(o.created_at, config.timezone)}</p>
      <div className="receipt-number"><span>ANTREAN</span><strong>{queueNumber(o.number)}</strong><h3>{o.customer}</h3><p>{o.mode === 'takeaway' ? 'BAWA PULANG' : 'DI SINI'}</p></div>
      <div className="receipt-items">{o.items.map(i => <div key={i.id}><span>{i.quantity}× {i.name}</span><b>{money(i.quantity * i.price)}</b></div>)}</div>
      {o.note && <p className="receipt-note">Catatan: {o.note}</p>}
      <div className="receipt-total"><strong>TOTAL</strong><strong>{money(o.total)}</strong></div>
      <p>{{ cash: 'Tunai', qris: 'QRIS', card: 'Kartu' }[o.payment] || o.payment} · <b>{statusNames[o.status]}</b></p>
      {o.cancel_reason && <p>Batal: {o.cancel_reason}</p>}
      <p className="receipt-footer">{config.footer}</p>
    </article>
  );
}

function Finance({ config, day, onSaved }: { config: Config; day: string; onSaved: (s: string) => void }) {
  const [from, setFrom] = useState(day);
  const [to, setTo] = useState(day);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ category: 'bahan', note: '', amount: '', day: day });
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (day) { setFrom(f => f || day); setTo(t => t || day); setForm(f => ({ ...f, day: f.day || day })); } }, [day]);
  const load = useCallback(async () => {
    if (!from || !to) return;
    setLoading(true);
    try { const d = await api(`finance?from=${from}&to=${to}`); setData(d); setError(''); }
    catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, [from, to]);
  useEffect(() => { load(); }, [load]);
  const salesByDay: Record<string, number> = {};
  (data?.sales || []).forEach((s: any) => { salesByDay[s.day] = s.sales; });
  const spentByDay: Record<string, number> = {};
  const spentByCat: Record<string, number> = { bahan: 0, operasional: 0, gaji: 0, lainnya: 0 };
  (data?.spent || []).forEach((s: any) => { spentByDay[s.day] = (spentByDay[s.day] || 0) + s.total; spentByCat[s.category] = (spentByCat[s.category] || 0) + s.total; });
  const days = [...new Set([...Object.keys(salesByDay), ...Object.keys(spentByDay)])].sort();
  const totalSales = Object.values(salesByDay).reduce((a, b) => a + b, 0);
  const totalSpent = Object.values(spentByDay).reduce((a, b) => a + b, 0);
  const profit = totalSales - totalSpent;
  const maxBar = Math.max(1, ...days.map(d => Math.max(salesByDay[d] || 0, spentByDay[d] || 0)));
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api('expenses', { category: form.category, note: form.note, amount: Number(form.amount), day: form.day || undefined });
      setForm(f => ({ ...f, note: '', amount: '' }));
      await load();
      onSaved('Pengeluaran tersimpan.');
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    if (!confirm('Hapus pengeluaran ini?')) return;
    try { await api('expenses/delete', { id }); await load(); onSaved('Pengeluaran dihapus.'); }
    catch (e) { setError((e as Error).message); }
  };
  return (
    <section className="finance">
      <div className="finance-range">
        <label>Dari<Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
        <label>Sampai<Input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
        <div className="quick-range">
          <Button variant="outline" size="sm" onClick={() => { setFrom(day); setTo(day); }}>Hari ini</Button>
          <Button variant="outline" size="sm" onClick={() => { const d = new Date(day + 'T00:00:00'); d.setDate(d.getDate() - 6); setFrom(d.toISOString().slice(0, 10)); setTo(day); }}>7 hari</Button>
          <Button variant="outline" size="sm" onClick={() => { setFrom(day.slice(0, 7) + '-01'); setTo(day); }}>Bulan ini</Button>
        </div>
      </div>
      {error && <p className="banner error">{error}</p>}
      <div className="stats-row">
        <div className="stat good"><span><TrendingUp size={19} />Masuk</span><strong>{money(totalSales)}</strong><small>Penjualan non-batal</small></div>
        <div className="stat bad"><span><TrendingDown size={19} />Keluar</span><strong>{money(totalSpent)}</strong><small>Semua pengeluaran</small></div>
        <div className={'stat ' + (profit >= 0 ? 'good' : 'bad')}><span><Wallet size={19} />Laba</span><strong>{money(profit)}</strong><small>Masuk − keluar</small></div>
      </div>
      <div className="finance-grid">
        <div className="panel">
          <h2>Grafik harian</h2>
          {loading ? <p className="muted">Memuat…</p> : !days.length ? <p className="muted">Belum ada data pada rentang ini.</p> : (
            <div className="bars">
              {days.map(d => (
                <div className="bar-row" key={d}>
                  <span>{d.slice(5)}</span>
                  <div className="bar-track">
                    <div className="bar in" style={{ width: `${Math.max(2, ((salesByDay[d] || 0) / maxBar) * 100)}%` }} />
                    <div className="bar out" style={{ width: `${Math.max(2, ((spentByDay[d] || 0) / maxBar) * 100)}%` }} />
                  </div>
                  <b className={((salesByDay[d] || 0) - (spentByDay[d] || 0)) >= 0 ? 'pos' : 'neg'}>{money((salesByDay[d] || 0) - (spentByDay[d] || 0))}</b>
                </div>
              ))}
              <p className="legend"><i className="in" />Masuk<i className="out" />Keluar</p>
            </div>
          )}
          <h2 className="mt">Keluar per kategori</h2>
          <div className="cat-rows">
            {Object.entries(expenseNames).map(([k, label]) => (
              <div key={k}><span>{label}</span><div className="bar-track"><div className="bar out" style={{ width: `${totalSpent ? Math.max(2, (spentByCat[k] / totalSpent) * 100) : 0}%` }} /></div><b>{money(spentByCat[k])}</b></div>
            ))}
          </div>
        </div>
        <div className="panel">
          <h2>Catat pengeluaran</h2>
          <form className="expense-form" onSubmit={save}>
            <label>Tanggal<Input type="date" value={form.day} onChange={e => setForm({ ...form, day: e.target.value })} required /></label>
            <label>Kategori<SelectField label="Kategori" value={form.category} onChange={v => setForm({ ...form, category: v })} options={Object.entries(expenseNames) as [string, string][]} /></label>
            <label>Jumlah (Rp)<Input type="number" min={1} max={2000000000} required value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="cth: 150000" /></label>
            <label>Keterangan<Input maxLength={120} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="cth: Susu 5L" /></label>
            <Button disabled={busy} className="full">{busy ? <Loader2 className="spin" /> : <Plus />}Simpan</Button>
          </form>
          <h2 className="mt">Terakhir dicatat</h2>
          <div className="expense-list">
            {(data?.expenses || []).slice(0, 30).map((x: Expense) => (
              <div className="expense-row" key={x.id}>
                <div><strong>{money(x.amount)}</strong><small>{x.day} · {expenseNames[x.category]}{x.note && x.note !== x.category ? ` · ${x.note}` : ''}</small></div>
                <Button variant="ghost" size="icon" aria-label="Hapus" onClick={() => remove(x.id)}><Trash2 size={16} /></Button>
              </div>
            ))}
            {!(data?.expenses || []).length && !loading && <p className="muted">Belum ada pengeluaran.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}

function Display({ config, board, connected, onLogout }: { config: Config; board: Board | null; connected: boolean; onLogout: () => void }) {
  const [enabled, setEnabled] = useState(false);
  const [audioError, setAudioError] = useState('');
  const [announcement, setAnnouncement] = useState<any>(null);
  const [clock, setClock] = useState('');
  const [rotation, setRotation] = useState(0);
  const [eventConnected, setEventConnected] = useState(true);
  const latestBoard = useRef(board);
  const cursor = useRef<number | null>(null);
  const sound = useRef(false);
  const queue = useRef<any[]>([]);
  const speaking = useRef(false);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  latestBoard.current = board;
  const drain = useCallback(() => {
    if (speaking.current || !sound.current) return;
    if (queue.current[0] && (!latestBoard.current || latestBoard.current.serverTime < queue.current[0].created_at)) { setTimeout(() => drain(), 1000); return; }
    let ev = queue.current.shift();
    while (ev && !latestBoard.current?.orders.some(o => o.id === ev.order_id && o.status === 'ready')) ev = queue.current.shift();
    if (!ev) return;
    speaking.current = true;
    setAnnouncement(ev);
    const u = new SpeechSynthesisUtterance(`Nomor antrean A ${Number(ev.number)}, atas nama ${ev.customer}. Pesanan sudah siap. Silakan ambil di konter.`);
    u.lang = 'id-ID';
    u.rate = 0.9;
    const voice = speechSynthesis.getVoices().find(v => v.lang.startsWith('id'));
    if (voice) u.voice = voice;
    const done = () => { if (watchdog.current) clearTimeout(watchdog.current); watchdog.current = null; speaking.current = false; utterance.current = null; setTimeout(() => drain(), 700); };
    u.onend = done;
    u.onerror = () => { if (!sound.current) { done(); return; } setAudioError('Suara gagal. Aktifkan ulang.'); sound.current = false; setEnabled(false); queue.current = []; done(); };
    utterance.current = u;
    speechSynthesis.speak(u);
    watchdog.current = setTimeout(() => { sound.current = false; setEnabled(false); setAudioError('Suara berhenti. Aktifkan ulang.'); queue.current = []; speechSynthesis.cancel(); speaking.current = false; }, 25000);
  }, []);
  useEffect(() => {
    let alive = true, t: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (cursor.current === null && latestBoard.current) cursor.current = latestBoard.current.latestEvent;
      if (cursor.current !== null) try {
        const d = await api('events?after=' + cursor.current);
        if (!alive) return;
        setEventConnected(true);
        for (const ev of d.events) {
          cursor.current = ev.id;
          if (ev.status === 'ready') { if (sound.current) queue.current.push(ev); else setAnnouncement(ev); }
        }
        drain();
      } catch { setEventConnected(false); }
      if (alive) t = setTimeout(poll, 5000);
    };
    poll();
    return () => { alive = false; clearTimeout(t); sound.current = false; queue.current = []; if (watchdog.current) clearTimeout(watchdog.current); if ('speechSynthesis' in window) speechSynthesis.cancel(); };
  }, [drain]);
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('id-ID', { timeZone: config.timezone, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    tick();
    const t = setInterval(tick, 1000), r = setInterval(() => setRotation(n => n + 1), 9000);
    return () => { clearInterval(t); clearInterval(r); };
  }, [config.timezone]);
  const toggleSound = () => {
    if (!('speechSynthesis' in window)) { setAudioError('Perangkat tidak mendukung suara. Pakai Chrome.'); return; }
    if (enabled) { sound.current = false; setEnabled(false); queue.current = []; if (watchdog.current) clearTimeout(watchdog.current); watchdog.current = null; speechSynthesis.cancel(); speaking.current = false; return; }
    setAudioError('');
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance('Panggilan antrean aktif.');
    u.lang = 'id-ID';
    u.onerror = () => { setAudioError('Suara gagal aktif.'); sound.current = false; setEnabled(false); };
    speechSynthesis.speak(u);
    sound.current = true;
    setEnabled(true);
  };
  const ready = board?.orders.filter(o => o.status === 'ready') || [];
  const waiting = board?.orders.filter(o => o.status !== 'ready') || [];
  const called = ready.find(o => o.id === announcement?.order_id) || ready.at(-1);
  const others = ready.filter(o => o.id !== called?.id);
  const pages = Math.max(1, Math.ceil(waiting.length / 12));
  const rp = Math.max(1, Math.ceil(others.length / 4));
  return (
    <main className="display">
      <header className="display-header">
        <div className="brand"><span className="cafe-mark" aria-hidden="true">{(config.name.trim()[0] || 'T').toUpperCase()}</span>{config.name}</div>
        <div className="display-clock"><strong suppressHydrationWarning>{clock}</strong><span>{board?.day}</span></div>
      </header>
      {(!connected || !eventConnected) && <div className="display-warning" role="alert">Terputus — data mungkin belum terbaru.</div>}
      {audioError && <div className="display-warning" role="alert">{audioError}</div>}
      <div className="display-main">
        <section className="now-calling">
          <p className="eyebrow"><Volume2 size={20} /> {called ? 'SIAP DIAMBIL' : 'MENUNGGU'}</p>
          <div key={called?.id} className="call-number"><strong>{called ? queueNumber(called.number) : '—'}</strong><h1>{called?.customer || 'Selamat datang'}</h1></div>
          <p className="pickup-instruction">{called ? 'Ambil di konter.' : 'Nomor siap tampil di sini.'}</p>
          <div className="ready-strip">{others.slice((rotation % rp) * 4, (rotation % rp) * 4 + 4).map(o => <div key={o.id}><strong>{queueNumber(o.number)}</strong><span>{o.customer}</span></div>)}</div>
        </section>
        <section className="preparing-display">
          <div className="display-section-title"><h2><ChefHat size={24} /> Disiapkan</h2><span>{waiting.length}</span></div>
          <div className="display-queue">{waiting.slice((rotation % pages) * 12, (rotation % pages) * 12 + 12).map(o => <div key={o.id} className={'dq-' + o.status}><strong>{queueNumber(o.number)}</strong><span>{o.customer}</span><small>{statusNames[o.status]}</small></div>)}</div>
          {!waiting.length && <div className="display-empty"><Coffee size={44} /><p>Kosong.</p></div>}
        </section>
      </div>
      <footer className="display-footer">
        <span>{config.footer}</span>
        <div>
          <Button variant="ghost" onClick={toggleSound}>{enabled ? <Volume2 /> : <VolumeX />}{enabled ? 'Suara on' : 'Suara'}</Button>
          <Button variant="ghost" aria-label="Layar penuh" onClick={async () => {
            try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
            catch { setAudioError('Layar penuh gagal.'); }
          }}><Maximize /></Button>
          <Button variant="ghost" aria-label="Keluar" onClick={onLogout}><LogOut /></Button>
        </div>
      </footer>
    </main>
  );
}

function History({ config, day, onReceipt }: { config: Config; day: string; onReceipt: (o: Order) => void }) {
  const [date, setDate] = useState(day);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => { if (!date && day) setDate(day); }, [day, date]);
  useEffect(() => {
    if (!date) return;
    let alive = true;
    setLoading(true);
    const t = setTimeout(() => {
      api(`history?day=${date}&page=${page}&search=${encodeURIComponent(search)}`).then(d => { if (alive) { setData(d); setError(''); } }).catch(e => { if (alive) setError(e.message); }).finally(() => { if (alive) setLoading(false); });
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [date, search, page]);
  return (
    <section>
      <div className="history-toolbar">
        <label>Tanggal<Input aria-label="Tanggal" type="date" value={date} onChange={e => { setDate(e.target.value); setPage(1); }} /></label>
        <div className="search"><Search size={17} /><Input aria-label="Cari" placeholder="Nama / nomor" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></div>
      </div>
      {error && <p className="banner error">{error}</p>}
      <div className="stats-row">
        <div className="stat"><span>Pesanan</span><strong>{data?.summary.orders || 0}</strong></div>
        <div className="stat"><span>Penjualan</span><strong>{money(data?.summary.sales || 0)}</strong></div>
        <div className="stat"><span>Batal</span><strong>{data?.summary.cancelled || 0}</strong></div>
      </div>
      <div className="stats-row">
        <div className="stat good"><span><Clock size={19} />Rata siap</span><strong>{fmtDur(data?.summary.avgReady)}</strong><small>pesan → siap · {data?.summary.nReady || 0} pesanan</small></div>
        <div className="stat good"><span><Check size={19} />Rata ambil</span><strong>{fmtDur(data?.summary.avgTake)}</strong><small>siap → diambil</small></div>
      </div>
      <div className="table-panel">
        <Table><TableHeader><TableRow>{['Antrean', 'Pelanggan', 'Jam', 'Jenis', 'Total', 'Lama siap', 'Status', ''].map(t => <TableHead key={t}>{t}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{data?.orders.map((o: Order) => <TableRow key={o.id}><TableCell className="mono strong">{queueNumber(o.number)}</TableCell><TableCell>{o.customer}</TableCell><TableCell>{time(o.created_at, config.timezone)}</TableCell><TableCell>{o.mode === 'takeaway' ? 'Bawa pulang' : 'Di sini'}</TableCell><TableCell>{money(o.total)}</TableCell><TableCell>{fmtDur(o.ready_at ? o.ready_at - o.created_at : null)}</TableCell><TableCell><Status status={o.status} /></TableCell><TableCell><Button variant="ghost" size="icon" aria-label={'Struk ' + queueNumber(o.number)} onClick={() => onReceipt(o)}><Printer /></Button></TableCell></TableRow>)}</TableBody></Table>
        {loading ? <p className="loading-text">Memuat…</p> : !data?.orders.length ? <Empty title="Kosong">Ganti tanggal / kata kunci.</Empty> : null}
      </div>
      <Pager page={page} pages={Math.max(1, Math.ceil((data?.count || 0) / 30))} onChange={setPage} />
    </section>
  );
}

function SettingsPanel({ config, products, payments, onSave, onLogout }: { config: Config; products: Product[]; payments: Payment[]; onSave: (path: string, b: any) => Promise<any>; onLogout: () => void }) {
  const [tab, setTab] = useState('cafe');
  const [busy, setBusy] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [edit, setEdit] = useState<Partial<Product> | null>(null);
  const [editPay, setEditPay] = useState<Partial<Payment> | null>(null);
  const [newUser, setNewUser] = useState(false);
  const [role, setRole] = useState('cashier');
  const [error, setError] = useState('');
  const load = async () => {
    try {
      if (tab === 'users') setUsers((await api('users')).users);
      if (tab === 'audit') setAudit((await api('audit')).entries);
    } catch (e) { setError((e as Error).message); }
  };
  useEffect(() => { load(); }, [tab]);
  const save = async (path: string, values: any, done?: () => void) => {
    setBusy(true); setError('');
    try { await onSave(path, values); await load(); done?.(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <section>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="category-tabs">
          <TabsTrigger value="cafe"><Store size={16} />Kafe</TabsTrigger>
          <TabsTrigger value="menu"><Coffee size={16} />Menu</TabsTrigger>
          <TabsTrigger value="pay"><Wallet size={16} />Bayar</TabsTrigger>
          <TabsTrigger value="users"><Users size={16} />Petugas</TabsTrigger>
          <TabsTrigger value="audit"><Archive size={16} />Aktivitas</TabsTrigger>
          <TabsTrigger value="password"><ShieldCheck size={16} />Sandi</TabsTrigger>
        </TabsList>
        {error && <p className="banner error">{error}</p>}
        <TabsContent value="cafe">
          <form className="settings-form" onSubmit={e => { e.preventDefault(); save('settings', Object.fromEntries(new FormData(e.currentTarget))); }}>
            <h2>Kafe & struk</h2>
            <label>Nama kafe<Input name="name" defaultValue={config.name} maxLength={80} required /></label>
            <label>Teks struk & TV<Textarea name="footer" defaultValue={config.footer} maxLength={200} /></label>
            <div className="info-box"><Clock size={20} /><div><strong>Nomor reset 00.00</strong><p>{config.timezone} · kembali ke A0001 tiap tanggal baru.</p></div></div>
            <Button disabled={busy}>Simpan</Button>
          </form>
        </TabsContent>
        <TabsContent value="menu">
          <div className="section-top"><h2>Menu <span className="muted">({products.length})</span></h2><Button onClick={() => setEdit({ name: '', category: 'Kopi', price: 0, active: 1 })}><Plus />Tambah</Button></div>
          <div className="table-panel"><Table><TableHeader><TableRow>{['Menu', 'Kategori', 'Harga', 'Status', ''].map(s => <TableHead key={s}>{s}</TableHead>)}</TableRow></TableHeader>
            <TableBody>{products.map(p => <TableRow key={p.id}><TableCell className="strong">{p.name}</TableCell><TableCell>{p.category}</TableCell><TableCell>{money(p.price)}</TableCell><TableCell>{p.active ? 'Aktif' : 'Mati'}</TableCell><TableCell><Button variant="ghost" aria-label={'Edit ' + p.name} onClick={() => setEdit(p)}><Pencil size={16} /></Button></TableCell></TableRow>)}</TableBody></Table></div>
        </TabsContent>
        <TabsContent value="pay">
          <div className="section-top"><h2>Bayar <span className="muted">({payments.filter(p => p.active).length} aktif)</span></h2><Button onClick={() => setEditPay({ name: '', active: 1 })}><Plus />Tambah</Button></div>
          <div className="info-box"><Wallet size={20} /><div><strong>Contoh: BRI - 1234567890</strong><p>Bank & kartu dipilih lewat menu Kartu di kasir. Tulis nomor setelah " - ".</p></div></div>
          <div className="table-panel"><Table><TableHeader><TableRow>{['Metode', 'Status', ''].map(s => <TableHead key={s}>{s}</TableHead>)}</TableRow></TableHeader>
            <TableBody>{payments.map(p => <TableRow key={p.id}><TableCell className="strong">{p.name}</TableCell><TableCell><Switch aria-label={'Aktif ' + p.name} checked={!!p.active} disabled={busy} onCheckedChange={active => save('payments', { id: p.id, name: p.name, active })} /></TableCell><TableCell><Button variant="ghost" aria-label={'Edit ' + p.name} onClick={() => setEditPay(p)}><Pencil size={16} /></Button></TableCell></TableRow>)}</TableBody></Table></div>
        </TabsContent>
        <TabsContent value="users">
          <div className="section-top"><h2>Petugas</h2><Button onClick={() => setNewUser(true)}><Plus />Tambah</Button></div>
          <div className="table-panel"><Table><TableHeader><TableRow>{['Nama', 'Username', 'Peran', 'Akses'].map(s => <TableHead key={s}>{s}</TableHead>)}</TableRow></TableHeader>
            <TableBody>{users.map(u => <TableRow key={u.id}><TableCell>{u.name}</TableCell><TableCell>{u.username}</TableCell><TableCell>{roleNames[u.role]}</TableCell><TableCell>{u.role === 'admin' ? 'Utama' : <Switch aria-label={'Akses ' + u.name} checked={!!u.active} disabled={busy} onCheckedChange={active => save('users/access', { id: u.id, active })} />}</TableCell></TableRow>)}</TableBody></Table></div>
        </TabsContent>
        <TabsContent value="audit">
          <div className="table-panel"><Table><TableHeader><TableRow>{['Waktu', 'Petugas', 'Aksi', 'ID'].map(s => <TableHead key={s}>{s}</TableHead>)}</TableRow></TableHeader>
            <TableBody>{audit.map(a => <TableRow key={a.id}><TableCell>{new Date(a.created_at).toLocaleString('id-ID', { timeZone: config.timezone })}</TableCell><TableCell>{a.name}</TableCell><TableCell>{a.action}</TableCell><TableCell className="mono">{a.target}</TableCell></TableRow>)}</TableBody></Table></div>
        </TabsContent>
        <TabsContent value="password">
          <form className="settings-form" onSubmit={e => { e.preventDefault(); save('password', Object.fromEntries(new FormData(e.currentTarget)), () => { window.location.href = '/'; }); }}>
            <h2>Ganti sandi</h2>
            <label>Sandi lama<Input type="password" name="current" required autoComplete="current-password" /></label>
            <label>Sandi baru<Input type="password" name="password" minLength={10} maxLength={128} required autoComplete="new-password" /></label>
            <Button disabled={busy}>Ubah</Button>
          </form>
        </TabsContent>
      </Tabs>
      <Dialog open={!!edit} onOpenChange={v => { if (!v) setEdit(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.id ? 'Edit menu' : 'Tambah menu'}</DialogTitle><DialogDescription>Struk lama tidak berubah.</DialogDescription></DialogHeader>
          {edit && <form className="dialog-form" onSubmit={e => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.currentTarget)); save('products', { ...d, id: edit.id, price: Number(d.price), active: !!edit.active }, () => setEdit(null)); }}>
            <label>Nama<Input name="name" defaultValue={edit.name} required maxLength={80} /></label>
            <label>Kategori<Input name="category" defaultValue={edit.category} required maxLength={40} /></label>
            <label>Harga (Rp)<Input type="number" name="price" defaultValue={edit.price} min={0} max={100000000} step={1} required /></label>
            <div className="switch-row"><Switch id="product-active" checked={!!edit.active} onCheckedChange={active => setEdit({ ...edit, active: active ? 1 : 0 })} /><Label htmlFor="product-active">Aktif</Label></div>
            <Button disabled={busy}>Simpan</Button>
          </form>}
        </DialogContent>
      </Dialog>
      <Dialog open={!!editPay} onOpenChange={v => { if (!v) setEditPay(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editPay?.id ? 'Edit bayar' : 'Tambah bayar'}</DialogTitle><DialogDescription>cth: BRI, Mandiri, BCA.</DialogDescription></DialogHeader>
          {editPay && <form className="dialog-form" onSubmit={e => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.currentTarget)); save('payments', { ...d, id: editPay.id, active: !!editPay.active }, () => setEditPay(null)); }}>
            <label>Nama metode<Input name="name" defaultValue={editPay.name} required maxLength={40} placeholder="cth: BRI" /></label>
            <div className="switch-row"><Switch id="pay-active" checked={!!editPay.active} onCheckedChange={active => setEditPay({ ...editPay, active: active ? 1 : 0 })} /><Label htmlFor="pay-active">Aktif</Label></div>
            <Button disabled={busy}>Simpan</Button>
          </form>}
        </DialogContent>
      </Dialog>
      <Dialog open={newUser} onOpenChange={setNewUser}>
        <DialogContent>
          <DialogHeader><DialogTitle>Akun petugas</DialogTitle><DialogDescription>Satu akun per orang / TV.</DialogDescription></DialogHeader>
          <form className="dialog-form" onSubmit={e => { e.preventDefault(); save('users', { ...Object.fromEntries(new FormData(e.currentTarget)), role }, () => setNewUser(false)); }}>
            <label>Nama<Input name="name" required maxLength={80} /></label>
            <label>Username<Input name="username" required maxLength={40} pattern="[A-Za-z0-9._\-]+" autoComplete="off" /></label>
            <label>Kata sandi<Input name="password" type="password" required minLength={10} maxLength={128} autoComplete="new-password" /></label>
            <label>Peran<SelectField value={role} onChange={setRole} label="Peran" options={[['cashier', 'Kasir'], ['kitchen', 'Dapur'], ['display', 'TV']]} /></label>
            <Button disabled={busy}>Buat</Button>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export { Sparkles as _Sparkles };
