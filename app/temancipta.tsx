'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Coffee, Monitor, ChefHat, ReceiptText, Settings, LogOut, Search, Plus, Minus, ShoppingBag, Utensils, ArrowRight, Volume2, VolumeX, Maximize, Check, Clock, RotateCcw, Printer, X, Users, ShieldCheck, Ticket, ChevronLeft, ChevronRight, Loader2, Pencil, Archive, Wallet, TrendingUp, TrendingDown, Trash2, Sparkles, Store, CupSoda, CakeSlice, Sandwich, Cookie, Croissant, Donut, Milk, Leaf, Snowflake, GlassWater, Citrus, Soup, Salad, Popcorn, Drumstick, Timer, Ban, Target, Flame, Lightbulb, Megaphone, Trophy } from 'lucide-react';
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
type Config = { name: string; timezone: string; footer: string; target_ready_min?: number; target_food_min?: number; target_drink_min?: number; tax_pct?: number; service_pct?: number };
type Item = { id: string; name: string; price: number; quantity: number };
type Product = { id: string; name: string; category: string; price: number; active: number; img?: string };
type Payment = { id: string; name: string; active: number };
type Order = { id: string; day: string; number: number; customer: string; mode: string; items: Item[]; note: string; total: number; payment: string; status: string; created_at: number; version: number; cancel_reason?: string; prepared_at?: number | null; ready_at?: number | null; completed_at?: number | null; discount_rp?: number; service_rp?: number; tax_rp?: number };
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
function downloadCSV(name: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const blob = new Blob(['\ufeff' + rows.map(r => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
  void 0;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const isFoodCategory = (c?: string) => /makan|roti|kue|snack|food|bakery|cake|pastry|dessert/i.test(c || '');
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
  const [nowTick, setNowTick] = useState('');
  useEffect(() => {
    const f = () => { try { setNowTick(new Date().toLocaleTimeString('id-ID', { timeZone: config?.timezone || 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit' })); } catch { } };
    f();
    const t = setInterval(f, 1000);
    return () => clearInterval(t);
  }, [config?.timezone]);
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
  useEffect(() => { if (user && ['admin', 'cashier', 'kitchen'].includes(user.role)) loadProducts().catch(e => setError(e.message)); }, [user, loadProducts]);
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
    ...((isAdmin || user.role === 'cashier') ? [['pengaturan', '/pengaturan', Settings, 'Pengaturan'] as const] : []),
  ] as const;
  const head = viewTitles[actualView] || viewTitles.kasir;

  return (
    <>
      <div className="app-shell no-print">
        <header className="topbar">
          <Brand name={config.name} />
          <nav aria-label="Navigasi utama">
            {navigation.filter(([v]) => isAdmin || user.role === 'cashier' || user.role === 'kitchen' && v === 'dapur').map(([v, href, Icon, label]) => (
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
          <div className="connection"><span className={connected ? 'online' : 'offline'} />{connected ? 'Live' : 'Menyambung…'}<small>{board?.day}{nowTick ? ` · ${nowTick}` : ''}</small></div>
        </div>

        {error && <div className="banner error" role="alert">{error}<button onClick={() => setError('')} aria-label="Tutup pesan"><X size={17} /></button></div>}
        {notice && <div className="banner success" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Tutup pesan"><X size={17} /></button></div>}

        {actualView === 'kasir' && <Cashier products={products} payments={payments} board={board} config={config} connected={connected} onSave={async (b) => {
          let d;
          try { d = await perform('orders', b); } catch (e) { await loadProducts().catch(() => { }); throw e; }
          setReceipt(d.order); message(`${queueNumber(d.order.number)} tersimpan. Struk siap.`); return d;
        }} onReceipt={setReceipt} />}
        {actualView === 'dapur' && <Kitchen board={board} config={config} products={products} user={user} connected={connected} onAction={b => perform('orders/action', b)} onReceipt={setReceipt} />}
        {actualView === 'riwayat' && <History config={config} products={products} day={board?.day || ''} onReceipt={setReceipt} />}
        {actualView === 'keuangan' && isAdmin && <Finance config={config} day={board?.day || ''} onSaved={(s) => message(s)} />}
        {actualView === 'pengaturan' && (isAdmin || user.role === 'cashier') && <SettingsPanel config={config} products={products} payments={payments} limited={!isAdmin} onSave={async (path, b) => {
          const d = await perform(path, b);
          if (path === 'settings') await loadMe();
          if (path === 'products') await loadProducts();
          if (path === 'payments') await loadPayments();
          message('Tersimpan.'); return d;
        }} onLogout={logout} />}
        <footer className="app-foot"><img src="/logo-temancipta.svg" alt="Temancipta" className="foot-logo" /><span>Temancipta · untuk kafe & UMKM</span></footer>
      </div>
      <Dialog open={!!receipt} onOpenChange={open => { if (!open) setReceipt(null); }}>
        <DialogContent className="receipt-dialog no-print">
          <DialogHeader><DialogTitle>Struk {receipt && queueNumber(receipt.number)}</DialogTitle></DialogHeader>
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
            <label>Username<Input name="username" required autoComplete="off" maxLength={40} pattern="[A-Za-z0-9._\-]+" placeholder="" /></label>
            <label>Kata sandi<Input name="password" type="password" required minLength={boot === 'setup' ? 10 : 1} maxLength={128} autoComplete="off" placeholder="" /></label>
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
  const [discount, setDiscount] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setCart(items => items.map(i => { const p = products.find(p => p.id === i.id); return p ? { ...i, price: p.price, name: p.name } : i; })); }, [products]);
  const pending = useRef<{ id: string; payload: string } | null>(null);
  const active = products.filter(p => p.active);
  const categories = [...new Set(active.map(p => p.category))];
  const filtered = active.filter(p => (category === 'all' || p.category === category) && p.name.toLowerCase().includes(search.toLowerCase()));
  const add = (p: Product) => setCart(c => { const old = c.find(i => i.id === p.id); return old ? c.map(i => i.id === p.id ? { ...i, quantity: Math.min(i.quantity + 1, 99) } : i) : [...c, { ...p, quantity: 1 }]; });
  const total = cart.reduce((s, i) => s + i.quantity * i.price, 0);
  const count = cart.reduce((s, i) => s + i.quantity, 0);
  const disc = Math.min(total, Math.max(0, Math.floor(Number(discount) || 0)));
  const svcPct = config.service_pct || 0, taxPct = config.tax_pct || 0;
  const svc = Math.round((total - disc) * svcPct / 100), tax = Math.round((total - disc + svc) * taxPct / 100);
  const grand = total - disc + svc + tax;
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
                  <span className={'menu-symbol ' + cls}><Icon size={28} />{p.img ? <img src={p.img} alt="" loading="lazy" className="menu-photo" onError={e => e.currentTarget.remove()} /> : null}</span>
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
            const data = { customer: customer.trim(), mode, payment: method, note, discount: disc, expectedTotal: grand, items: cart.map(i => ({ id: i.id, quantity: i.quantity })) };
            const payload = JSON.stringify(data);
            if (!pending.current || pending.current.payload !== payload) pending.current = { id: crypto.randomUUID(), payload };
            try { await onSave({ ...data, id: pending.current.id }); setCart([]); setCustomer(''); setNote(''); setDiscount(''); pending.current = null; }
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
              <label>Diskon (Rp)<Input type="number" min={0} max={total} value={discount} onChange={e => setDiscount(e.target.value)} placeholder="0" /></label>
              {(disc > 0 || svc > 0 || tax > 0) && <div className="breakdown">
                <div><span>Subtotal</span><b>{money(total)}</b></div>
                {disc > 0 && <div><span>Diskon</span><b>-{money(disc)}</b></div>}
                {svc > 0 && <div><span>Service {svcPct}%</span><b>{money(svc)}</b></div>}
                {tax > 0 && <div><span>Pajak {taxPct}%</span><b>{money(tax)}</b></div>}
              </div>}
              {/qris/i.test(method) && (
                <div className="qris-box">
                  {!qrisMissing ? <img src="/qris.png" alt="QRIS kafe" className="qris-img" onError={() => setQrisMissing(true)} /> : <p className="muted">QR belum dipasang — simpan file public/qris.png lalu deploy ulang.</p>}
                  <p><strong>{money(grand)}</strong> · Pelanggan scan untuk bayar</p>
                  <Button type="button" variant="outline" onClick={() => setQrisOpen(true)}><Maximize size={15} /> Lihat QR besar</Button>
                </div>
              )}
              {isBank && (
                <div className="bank-box">
                  <p>Transfer ke <strong>{bankName}</strong></p>
                  <p className="mono">{bankNumber || method}</p>
                  <p><strong>{money(grand)}</strong></p>
                  <Button type="button" variant="outline" onClick={() => setBankOpen(true)}>Detail transfer</Button>
                </div>
              )}
              <div className="total"><span>Total</span><strong>{money(grand)}</strong></div>
              <Button type="submit" className="full submit-order" disabled={!cart.length || !customer.trim() || busy || !connected}>{busy ? <Loader2 className="spin" /> : <ReceiptText />}{busy ? 'Menyimpan…' : 'Simpan pesanan'}<ArrowRight /></Button>
            </fieldset>
          </form>
        </aside>
      </div>
      <Dialog open={qrisOpen} onOpenChange={setQrisOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Scan QRIS</DialogTitle><DialogDescription>{money(grand)} · pastikan nominal sesuai</DialogDescription></DialogHeader>
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

function Kitchen({ board, config, products, user, connected, onAction, onReceipt }: { board: Board | null; config: Config; products: Product[]; user: User; connected: boolean; onAction: (b: any) => Promise<any>; onReceipt: (o: Order) => void }) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState('');
  const [cancel, setCancel] = useState<Order | null>(null);
  const [reason, setReason] = useState('');
  const targetMin = config.target_ready_min || 10;
  const foodIds = new Set((products || []).filter(p => isFoodCategory(p.category)).map(p => p.id));
  const orderTarget = (o: Order) => o.items.some(i => foodIds.has(i.id)) ? (config.target_food_min || 15) : (config.target_drink_min || 5);
  const elapsed = (o: Order) => Math.max(0, Math.floor(((board?.serverTime || o.created_at) - o.created_at) / 60000));
  const overCount = board?.orders.filter(o => o.status !== 'ready' && elapsed(o) > orderTarget(o)).length || 0;
  const q = query.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const filtered = board?.orders.filter(o => (filter === 'all' || o.status === filter) && (!q || o.customer.toLowerCase().includes(query.trim().toLowerCase()) || queueNumber(o.number).toLowerCase().replace(/[^a-z0-9]/g, '').includes(q) || String(o.number).includes(q))) || [];
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
        <div className="search kit-search"><Search size={17} /><Input aria-label="Cari pesanan" placeholder="Cari nama / nomor…" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} />{query && <button className="kit-clear" aria-label="Hapus pencarian" onClick={() => setQuery('')}><X size={15} /></button>}</div>
      </div>
      {!!overCount && <p className="banner error kit-warn" role="alert"><Clock size={17} /> {overCount} pesanan lewat target (makanan {config.target_food_min || 15} mnt, minuman {config.target_drink_min || 5} mnt) — dahulukan yang bertanda merah.</p>}
      <div className="kitchen-grid">
        {filtered.slice((current - 1) * 12, current * 12).map(o => {
          const mins = elapsed(o);
          const lim = orderTarget(o);
          const over = o.status !== 'ready' && mins > lim;
          const soon = !over && o.status !== 'ready' && mins >= Math.ceil(lim * 0.7);
          return (
          <article className={'order-card ' + o.status + (over ? ' over' : soon ? ' soon' : '')} key={o.id}>
            <header><strong>{queueNumber(o.number)}</strong>{o.day !== board?.day && <span className="day-chip" title={'Antrean hari ' + o.day}>{o.day.slice(5)}</span>}<span className="kit-tags"><Status status={o.status} />{over && <span className="over-badge">LEWAT +{mins - lim} mnt</span>}{soon && <span className="soon-badge">{mins}/{lim} mnt</span>}</span></header>
            <h2>{o.customer}</h2>
            <p className="order-meta">{o.mode === 'takeaway' ? 'Bawa pulang' : 'Di sini'} · {time(o.created_at, config.timezone)} · {mins} mnt</p>
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
          );
        })}
      </div>
      {!filtered.length && <Empty title={query ? 'Tidak ketemu' : 'Antrean kosong'}>{query ? `Tidak ada "${query}" di filter ini.` : 'Pesanan baru muncul otomatis.'}</Empty>}
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
      <h2>{config.name}</h2>
      <p>{o.day} · {time(o.created_at, config.timezone)}</p>
      <div className="receipt-number"><span>ANTREAN</span><strong>{queueNumber(o.number)}</strong><h3>{o.customer}</h3><p>{o.mode === 'takeaway' ? 'BAWA PULANG' : 'DI SINI'}</p></div>
      <div className="receipt-items">{o.items.map(i => <div key={i.id}><span>{i.quantity}× {i.name}</span><b>{money(i.quantity * i.price)}</b></div>)}</div>
      {!!(o.discount_rp || o.service_rp || o.tax_rp) && <div className="receipt-items">
        {!!o.discount_rp && <div><span>Diskon</span><b>-{money(o.discount_rp)}</b></div>}
        {!!o.service_rp && <div><span>Service</span><b>{money(o.service_rp)}</b></div>}
        {!!o.tax_rp && <div><span>Pajak</span><b>{money(o.tax_rp)}</b></div>}
      </div>}
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
  const [chart, setChart] = useState('bar');
  const [ai, setAi] = useState<any>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const analyze = async () => {
    if (!from || !to || aiBusy) return;
    setAiBusy(true); setAiError('');
    try { setAi(await api(`insights?from=${from}&to=${to}`)); }
    catch (e) { setAiError((e as Error).message); } finally { setAiBusy(false); }
  };
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
  const shortRp = (n: number) => n >= 1000000 ? `Rp${(n / 1000000).toLocaleString('id-ID', { maximumFractionDigits: 1 })}jt` : n >= 1000 ? `Rp${Math.round(n / 1000)}rb` : money(n);
  const catIcon: Record<string, any> = { bahan: ShoppingBag, operasional: Store, gaji: Users, lainnya: Archive };
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
  const exportCSV = () => {
    if (!data) return;
    downloadCSV(`keuangan-${from}-${to}.csv`, [
      ['Hari', 'Masuk', 'Keluar', 'Laba'],
      ...days.map(d => [d, salesByDay[d] || 0, spentByDay[d] || 0, (salesByDay[d] || 0) - (spentByDay[d] || 0)] as (string | number)[]),
      [], ['TOTAL', totalSales, totalSpent, profit], [],
      ['Pengeluaran: Tanggal', 'Kategori', 'Keterangan', 'Jumlah'],
      ...(data.expenses || []).map((x: Expense) => [x.day, expenseNames[x.category] || x.category, x.note, x.amount] as (string | number)[]),
    ]);
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
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={loading || !data}>CSV</Button>
        </div>
      </div>
      {error && <p className="banner error">{error}</p>}
      <div className="stats-row">
        <div className="stat good"><span><TrendingUp size={19} />Masuk</span><strong>{money(totalSales)}</strong><small>Penjualan non-batal</small></div>
        <div className="stat bad"><span><TrendingDown size={19} />Keluar</span><strong>{money(totalSpent)}</strong><small>Semua pengeluaran</small></div>
        <div className={'stat ' + (profit >= 0 ? 'good' : 'bad')}><span><Wallet size={19} />Laba</span><strong>{money(profit)}</strong><small>Masuk − keluar</small></div>
      </div>
      <div className="finance-grid">
        <div className="panel fin-chart">
          <div className="section-top"><h2><TrendingUp size={17} /> Grafik</h2>
            <Tabs value={chart} onValueChange={setChart}><TabsList className="category-tabs chart-tabs"><TabsTrigger value="bar">Batang</TabsTrigger><TabsTrigger value="pie">Donat</TabsTrigger><TabsTrigger value="line">Tren</TabsTrigger></TabsList></Tabs>
          </div>
          {loading ? <div className="ai-skel" aria-label="Memuat grafik"><div /><div /><div /></div> : !days.length ? <div className="ai-empty"><span className="ai-spark big"><TrendingUp size={20} /></span><p><strong>Belum ada data.</strong></p><p className="muted">Ubah rentang tanggal atau catat penjualan & pengeluaran.</p></div> : chart === 'pie' ? (
            <div className="donut-wrap">
              <div className="pie donut" style={{ background: `conic-gradient(#12b76a 0 ${(totalSales + totalSpent ? totalSales / (totalSales + totalSpent) * 100 : 0)}%, #f43f5e 0 100%)` }}><div className="pie-hole"><strong>{money(profit)}</strong><small>laba bersih</small></div></div>
              <div className="donut-legend">
                <div className="dl-row"><i className="in" /><div><small>Masuk</small><strong>{money(totalSales)}</strong></div><b>{totalSales + totalSpent ? Math.round(totalSales / (totalSales + totalSpent) * 100) : 0}%</b></div>
                <div className="dl-row"><i className="out" /><div><small>Keluar</small><strong>{money(totalSpent)}</strong></div><b>{totalSales + totalSpent ? Math.round(totalSpent / (totalSales + totalSpent) * 100) : 0}%</b></div>
              </div>
            </div>
          ) : chart === 'line' ? (
            <div className="trend-wrap">
              {days.length < 2 ? (() => {
                const d = days[0], s = salesByDay[d] || 0, o = spentByDay[d] || 0, net = s - o;
                return <div className="trend-single">
                  <div><small>Masuk</small><strong className="pos">{money(s)}</strong></div>
                  <div><small>Keluar</small><strong>{money(o)}</strong></div>
                  <div><small>Laba {d}</small><strong className={net >= 0 ? 'pos' : 'neg'}>{money(net)}</strong></div>
                  <p className="muted">Pilih rentang ≥ 2 hari (mis. 7 hari) untuk melihat garis naik-turun.</p>
                </div>;
              })() : (() => {
                const nets = days.map(d => (salesByDay[d] || 0) - (spentByDay[d] || 0));
                const lo = Math.min(0, ...nets), hi = Math.max(0, ...nets), span = Math.max(1, hi - lo);
                const W = 340, H = 150, P = 14;
                const px = (i: number) => days.length < 2 ? W / 2 : P + (i / (days.length - 1)) * (W - P * 2);
                const py = (v: number) => 12 + (1 - (v - lo) / span) * (H - 30);
                const pts = nets.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ');
                const area = `M${px(0).toFixed(1)},${py(0).toFixed(1)} L` + nets.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' L') + ` L${px(nets.length - 1).toFixed(1)},${py(0).toFixed(1)} Z`;
                const best = nets.indexOf(Math.max(...nets)), worst = nets.indexOf(Math.min(...nets));
                return (<>
                  <svg viewBox={`0 0 ${W} ${H}`} className="trend-svg" role="img" aria-label="Tren laba harian naik turun">
                    <defs><linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9a4a1e" stopOpacity=".35" /><stop offset="1" stopColor="#9a4a1e" stopOpacity="0" /></linearGradient></defs>
                    {[0.25, 0.5, 0.75].map(f => <line key={f} x1={P} x2={W - P} y1={H * f} y2={H * f} stroke="#eadfd1" strokeWidth="1" />)}
                    <line x1={P} x2={W - P} y1={py(0)} y2={py(0)} stroke="#c9b69c" strokeWidth="1.2" strokeDasharray="5 4" />
                    <path d={area} fill="url(#trendFill)" />
                    <polyline points={pts} fill="none" stroke="#9a4a1e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    {nets.map((v, i) => <circle key={days[i]} cx={px(i)} cy={py(v)} r={i === best || i === worst ? 6 : 4.5} fill={v >= 0 ? '#12b76a' : '#d92d20'} stroke="#fff" strokeWidth="2"><title>{days[i]}: {money(v)}</title></circle>)}
                  </svg>
                  <div className="trend-days">{days.map((d, i) => <span key={d} className={nets[i] >= 0 ? 'pos' : 'neg'} title={`${d}: ${money(nets[i])}`}>{d.slice(5)}</span>)}</div>
                  <div className="trend-meta"><span className="pos">▲ {shortRp(Math.max(...nets))} · {days[best]?.slice(5)}</span><span className="neg">▼ {shortRp(Math.min(...nets))} · {days[worst]?.slice(5)}</span></div>
                </>);
              })()}
            </div>
          ) : (
            <div className="vbars-wrap">
              <div className="vbars">
                {days.map(d => {
                  const s = salesByDay[d] || 0, o = spentByDay[d] || 0, net = s - o;
                  return (
                    <div className="vbar-col" key={d} title={`${d}: masuk ${money(s)}, keluar ${money(o)}, laba ${money(net)}`}>
                      <div className="vbar-pair">
                        <div className="vbar in" style={{ height: `${Math.max(3, (s / maxBar) * 100)}%` }} />
                        <div className="vbar out" style={{ height: `${Math.max(3, (o / maxBar) * 100)}%` }} />
                      </div>
                      <span className={net >= 0 ? 'pos' : 'neg'}>{d.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
              <p className="legend"><i className="in" />Masuk<i className="out" />Keluar<i className="net" />Laba = selisih</p>
              <div className="net-strip">{days.map(d => { const net = (salesByDay[d] || 0) - (spentByDay[d] || 0); return <b key={d} className={net >= 0 ? 'pos' : 'neg'} title={`${d}: ${money(net)}`}>{shortRp(net)}</b>; })}</div>
            </div>
          )}
          <h2 className="mt">Keluar per kategori</h2>
          <div className="cat-rows fin-cats">
            {Object.entries(expenseNames).map(([k, label]) => {
              const Icon = catIcon[k] || Archive;
              const pct = totalSpent ? Math.round((spentByCat[k] / totalSpent) * 100) : 0;
              return (
                <div key={k} className="fin-cat"><span className="cat-ico"><Icon size={15} /></span><span className="cat-label">{label}<small>{pct}%</small></span><div className="bar-track"><div className="bar out" style={{ width: `${totalSpent ? Math.max(3, (spentByCat[k] / totalSpent) * 100) : 0}%` }} /></div><b>{money(spentByCat[k])}</b></div>
              );
            })}
          </div>
        </div>
        <div className="panel fin-expense">
          <h2 className="fin-title"><Wallet size={16} /> Catat pengeluaran</h2>
          <form className="expense-form" onSubmit={save}>
            <label>Tanggal<Input type="date" value={form.day} onChange={e => setForm({ ...form, day: e.target.value })} required /></label>
            <label>Kategori<SelectField label="Kategori" value={form.category} onChange={v => setForm({ ...form, category: v })} options={Object.entries(expenseNames) as [string, string][]} /></label>
            <label>Jumlah (Rp)<Input type="number" min={1} max={2000000000} required value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="cth: 150000" /></label>
            <label>Keterangan<Input maxLength={120} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="cth: Susu 5L" /></label>
            <Button disabled={busy} className="full fin-save">{busy ? <Loader2 className="spin" /> : <Plus />}Simpan</Button>
          </form>
          <h2 className="mt fin-title"><ReceiptText size={16} /> Terakhir dicatat</h2>
          <div className="expense-list">
            {(data?.expenses || []).slice(0, 30).map((x: Expense, i: number) => {
              const Icon = catIcon[x.category] || Archive;
              return (
                <div className="expense-row" key={x.id} style={{ animationDelay: `${Math.min(i, 10) * 0.04}s` }}>
                  <span className="exp-ico"><Icon size={15} /></span>
                  <div><strong>{money(x.amount)}</strong><small>{x.day} · {expenseNames[x.category]}{x.note && x.note !== x.category ? ` · ${x.note}` : ''}{x.author ? ` · ${x.author}` : ''}</small></div>
                  <Button variant="ghost" size="icon" aria-label="Hapus" onClick={() => remove(x.id)}><Trash2 size={16} /></Button>
                </div>
              );
            })}
            {!(data?.expenses || []).length && !loading && <div className="ai-empty"><p className="muted">Belum ada pengeluaran.</p></div>}
          </div>
        </div>
      </div>
      <div className="panel mt ai-panel">
        <div className="section-top ai-head"><h2><span className="ai-spark"><Sparkles size={17} /></span> Analisa AI<span className="ai-sub">tren · menu · kecepatan · saran</span></h2><Button variant="outline" size="sm" className={aiBusy ? 'ai-btn busy' : 'ai-btn'} onClick={analyze} disabled={aiBusy}>{aiBusy ? <Loader2 className="spin" size={15} /> : <Sparkles size={15} />}{aiBusy ? 'Menganalisa…' : 'Analisa periode ini'}</Button></div>
        {aiError && <p className="banner error">{aiError}</p>}
        {aiBusy && !ai && <div className="ai-skel" aria-label="Memuat analisa"><div /><div /><div /><div /><div /></div>}
        {ai ? (<>
          <div className="ai-kpis">
            <div className="ai-kpi k-andalan"><span className="k-ico"><Trophy size={16} /></span><div><small>Andalan</small><strong>{ai.topItems?.[0] ? `${ai.topItems[0].name} · ${ai.topItems[0].qty}x` : '–'}</strong></div></div>
            <div className="ai-kpi k-lambat"><span className="k-ico"><Timer size={16} /></span><div><small>Paling lambat</small><strong>{ai.slowMenu?.[0] ? `${ai.slowMenu[0].name} · ${fmtDur(ai.slowMenu[0].avgWait)}` : '–'}</strong></div></div>
            <div className="ai-kpi k-target"><span className="k-ico"><Target size={16} /></span><div><small>Makanan {ai.targetFood} · minuman {ai.targetDrink} mnt</small><strong>{ai.nReady ? `${ai.pctOnTarget}% tercapai (${ai.nOnTarget}/${ai.nReady})` : 'Belum terukur'}</strong></div></div>
            <div className="ai-kpi k-mati"><span className="k-ico"><Ban size={16} /></span><div><small>Menu mati</small><strong>{ai.deadMenu?.length || 0} item · 0 laku</strong></div></div>
          </div>
          <div className="ai-lines">{ai.narrative.split('\n').filter(Boolean).slice(0, 5).map((line: string, i: number) => {
            const meta = [
              { icon: TrendingUp, cls: 'tren', tag: 'Tren' },
              { icon: Flame, cls: 'menu', tag: 'Menu' },
              { icon: Timer, cls: 'speed', tag: 'Kecepatan' },
              { icon: Wallet, cls: 'pay', tag: 'Bayar' },
              { icon: Lightbulb, cls: 'tip', tag: 'Saran' },
            ][Math.min(i, 4)];
            const Icon = meta.icon;
            return <p key={i} className={'ai-line ' + meta.cls} style={{ animationDelay: `${i * 0.07}s` }}><span className="ai-ico"><Icon size={15} /></span><span className="ai-body"><em>{i + 1} · {meta.tag}</em><span>{line.replace(/^\d+\.\s*/, '')}</span></span></p>;
          })}</div>
          <p className="ai-src"><span className={'ai-badge ' + (ai.source === 'ai' ? 'cloud' : '')}>{ai.source === 'ai' ? 'AI' : 'Aturan'}</span> <span className="muted">{ai.from}–{ai.to}{ai.nReady ? ` · rata ${fmtDur(ai.avgReady)} · tipikal ${fmtDur(ai.medianReady)} (${ai.nOnTarget}/${ai.nReady} on target)` : ''}{ai.peakHour ? ` · tersibuk ${String(ai.peakHour.h).padStart(2, '0')}.00` : ''}</span></p>
          {!!ai.targetTrend?.some((t: any) => t.pct != null) && (
            <div className="ai-card mt"><h3><Target size={15} /> Ketercapaian target per hari</h3>
              <div className="trend-day-list">{ai.targetTrend.map((t: any) => t.pct == null ? null : (
                <div className="trow" key={t.day} style={{ animationDelay: '0s' }}><span>{t.day.slice(5)}</span><div className="bar-track"><div className={'bar ' + (t.pct >= 85 ? 'in' : 'out')} style={{ width: `${Math.max(3, t.pct)}%` }} /></div><b>{t.pct}%</b></div>
              ))}</div>
            </div>
          )}
          <div className="ai-grid">
            {!!ai.topItems?.length && <div className="ai-card"><h3><Trophy size={15} /> Menu laris</h3><div className="rank-list">{(() => { const mx = Math.max(1, ...ai.topItems.map((t: any) => t.qty)); return ai.topItems.map((t: any, i: number) => <div key={t.name} className="rank-row" style={{ animationDelay: `${i * 0.05}s` }}>
              <span className={'rank r' + Math.min(i + 1, 3)}>{i + 1}</span>
              <div className="rank-main"><strong>{t.name}</strong><div className="qty-bar"><i style={{ width: `${Math.max(4, (t.qty / mx) * 100)}%` }} /></div></div>
              <span className="rank-qty">{t.qty}x</span><b>{money(t.revenue)}</b>
            </div>); })()}</div></div>}
            {!!ai.slowMenu?.length && <div className="ai-card"><h3><Timer size={15} /> Menu paling lambat</h3><p className="muted sm">Rata-rata pesan→siap per menu. Target {ai.targetMin} mnt.</p><div className="slow-list">{(() => { const mx = Math.max(1, ...ai.slowMenu.map((s: any) => s.avgWait)); return ai.slowMenu.map((s: any, i: number) => {
              const over = ai.targetMin && s.avgWait > ai.targetMin * 60000;
              return <div className={'slow-row' + (i === 0 ? ' worst' : '')} key={s.name} style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="slow-main"><strong>{s.name}</strong><div className="slow-bar"><i style={{ width: `${Math.max(4, (s.avgWait / mx) * 100)}%` }} /></div><small>{s.n}x pesanan · terlama {fmtDur(s.maxWait)}{s.solid ? '' : ' · estimasi'}</small></div>
                <b>{fmtDur(s.avgWait)}</b>
                {i === 0 ? <span className="chip warn">paling lambat</span> : over ? <span className="chip">di atas target</span> : <span className="chip ok">aman</span>}
              </div>;
            }); })()}</div></div>}
          </div>
          {!!ai.deadMenu?.length && <div className="ai-card mt"><h3><Ban size={15} /> Menu mati (0 laku)</h3><p className="muted">Saran promo untuk yang masih layak; coret jika stok/menu sudah terlalu banyak.</p><div className="dead-chips">{ai.deadMenu.map((d: any, i: number) => {
            const name = typeof d === 'string' ? d : d.name;
            const saran = typeof d === 'string' ? 'promo' : d.saran;
            return <span key={name} className={'dead-chip ' + saran} style={{ animationDelay: `${i * 0.04}s` }}>{saran === 'promo' ? <Megaphone size={13} /> : <Trash2 size={13} />}{name}<em>{saran}</em></span>;
          })}</div></div>}
          {!!ai.paymix?.length && <div className="ai-card mt"><h3><Wallet size={15} /> Metode bayar</h3><div className="pay-rows">{(() => { const tot = Math.max(1, ai.paymix.reduce((a: number, x: any) => a + x.n, 0)); const mx = Math.max(1, ...ai.paymix.map((x: any) => x.n)); return ai.paymix.map((p: any, i: number) => <div key={p.payment} className="pay-row" style={{ animationDelay: `${i * 0.06}s` }}><span>{p.payment}</span><div className="bar-track pay"><div className={'bar pay-' + (i % 4)} style={{ width: `${Math.max(3, (p.n / mx) * 100)}%` }} /></div><b>{p.n}x · {Math.round(p.n / tot * 100)}%</b></div>); })()}</div></div>}
        </>) : !aiBusy ? (<div className="ai-empty"><span className="ai-spark big"><Sparkles size={20} /></span><p><strong>Belum ada analisa.</strong></p><p className="muted">Tren menu, kecepatan vs target {config.target_ready_min || 10} mnt, menu mati, dan 3 saran konkret untuk rentang tanggal di atas.</p></div>) : null}
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
  const keepAlive = useRef<ReturnType<typeof setInterval> | null>(null);
  latestBoard.current = board;
  const drain = useCallback(() => {
    if (speaking.current || !sound.current) return;
    if (queue.current[0] && (!latestBoard.current || latestBoard.current.serverTime < queue.current[0].created_at)) { setTimeout(() => drain(), 1000); return; }
    let ev = queue.current.shift();
    while (ev && !latestBoard.current?.orders.some(o => o.id === ev.order_id && o.status === 'ready')) ev = queue.current.shift();
    if (!ev) return;
    speaking.current = true;
    setAnnouncement(ev);
    const u = new SpeechSynthesisUtterance(`Nomor antrean, A ${Number(ev.number)}. ${ev.customer}. Silakan ambil di konter.`);
    u.lang = 'id-ID';
    u.rate = 0.82;
    u.pitch = 1.02;
    const voices = speechSynthesis.getVoices();
    const pick = (re: RegExp) => voices.filter(v => re.test(v.lang) || re.test(v.name));
    const voice = pick(/Andika|Damayanti|Gadis|Ardi|Indones/i)[0] || pick(/^id/i)[0] || pick(/ms-MY|ms_/i)[0] || pick(/id/i)[0];
    if (voice) u.voice = voice;
    const done = () => { if (watchdog.current) clearTimeout(watchdog.current); watchdog.current = null; if (keepAlive.current) clearInterval(keepAlive.current); keepAlive.current = null; speaking.current = false; utterance.current = null; setTimeout(() => drain(), 700); };
    u.onend = done;
    u.onerror = () => { if (!sound.current) { done(); return; } setAudioError('Suara gagal. Aktifkan ulang.'); sound.current = false; setEnabled(false); queue.current = []; done(); };
    utterance.current = u;
    speechSynthesis.cancel();
    setTimeout(() => { if (utterance.current === u && sound.current) speechSynthesis.speak(u); }, 120);
    if (keepAlive.current) clearInterval(keepAlive.current);
    keepAlive.current = setInterval(() => { try { if (speaking.current && utterance.current) speechSynthesis.resume(); } catch { } }, 4000);
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
      if (alive) t = setTimeout(poll, 3000);
    };
    poll();
    return () => { alive = false; clearTimeout(t); sound.current = false; queue.current = []; if (watchdog.current) clearTimeout(watchdog.current); if (keepAlive.current) clearInterval(keepAlive.current); if ('speechSynthesis' in window) speechSynthesis.cancel(); };
  }, [drain]);
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const load = () => { try { speechSynthesis.getVoices(); } catch { } };
    load();
    try { speechSynthesis.addEventListener('voiceschanged', load); } catch { }
    return () => { try { speechSynthesis.removeEventListener('voiceschanged', load); } catch { } };
  }, []);
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
    let tries = 1;
    const startTest = () => {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance('Panggilan antrean aktif.');
      u.lang = 'id-ID';
      u.rate = 0.82;
      u.pitch = 1.02;
      const voices = speechSynthesis.getVoices();
      const voice = voices.filter(v => /Andika|Damayanti|Gadis|Ardi|Indones/i.test(v.lang) || /^id/i.test(v.lang))[0] || voices.find(v => v.lang.startsWith('id'));
      if (voice) u.voice = voice;
      u.onerror = () => {
        if (tries-- > 0) { setTimeout(startTest, 500); return; }
        setAudioError('Suara gagal aktif.'); sound.current = false; setEnabled(false);
      };
      setTimeout(() => speechSynthesis.speak(u), 150);
    };
    startTest();
    sound.current = true;
    setEnabled(true);
  };
  const ready = board?.orders.filter(o => o.status === 'ready') || [];
  const waiting = board?.orders.filter(o => o.status !== 'ready') || [];
  const called = ready.find(o => o.id === announcement?.order_id) || ready.at(-1);
  const others = ready.filter(o => o.id !== called?.id).sort((a, b) => a.number - b.number);
  const pages = Math.max(1, Math.ceil(waiting.length / 4));
  const rp = Math.max(1, Math.ceil(others.length / 8));
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
          <div key={called?.id} className="call-number"><strong>{called ? queueNumber(called.number) : '—'}</strong><h1>{called?.customer || 'Selamat datang'}</h1>{called && called.day !== board?.day && <p className="call-day">Antrean {called.day}</p>}</div>
          <p className="pickup-instruction">{called ? 'Ambil di konter.' : 'Nomor siap tampil di sini.'}</p>
          <div className="ready-strip">{others.slice((rotation % rp) * 8, (rotation % rp) * 8 + 8).map(o => <div key={o.id} className="strip-card"><strong>{queueNumber(o.number)}</strong><span>{o.customer}{o.day !== board?.day ? ` · ${o.day.slice(5)}` : ''}</span></div>)}</div>
          {!!others.length && <p className="strip-title">Menunggu diambil ({others.length})</p>}
        </section>
        <section className="preparing-display">
          <div className="display-section-title"><h2><ChefHat size={24} /> Disiapkan</h2><span>{waiting.length}</span></div>
          <div className="display-queue">{waiting.slice((rotation % pages) * 4, (rotation % pages) * 4 + 4).map(o => <div key={o.id} className={'dq-' + o.status}><strong>{queueNumber(o.number)}</strong><span>{o.customer}</span><small>{statusNames[o.status]}{o.day !== board?.day ? ` · ${o.day.slice(5)}` : ''}</small></div>)}</div>
          {!waiting.length && <div className="display-empty"><Coffee size={44} /><p>Kosong.</p></div>}
        </section>
      </div>
      <footer className="display-footer">
        <div className="marquee"><div className="marquee-inner"><span>{config.footer}</span><span>{config.footer}</span></div></div>
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

function History({ config, products, day, onReceipt }: { config: Config; products: Product[]; day: string; onReceipt: (o: Order) => void }) {
  const [date, setDate] = useState(day);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [dlBusy, setDlBusy] = useState(false);
  const exportCSV = async () => {
    if (!date || dlBusy) return;
    setDlBusy(true);
    try {
      const first = await api(`history?day=${date}&page=1&search=${encodeURIComponent(search)}`);
      const pages = Math.max(1, Math.ceil((first.count || 0) / 30));
      let all: Order[] = first.orders;
      for (let p = 2; p <= Math.min(pages, 10); p++) { const d = await api(`history?day=${date}&page=${p}&search=${encodeURIComponent(search)}`); all = all.concat(d.orders); }
      downloadCSV(`riwayat-${date}.csv`, [['Tanggal', 'Antrean', 'Pelanggan', 'Jenis', 'Item', 'Total', 'Diskon', 'Bayar', 'Status', 'Menit siap'], ...all.map(o => [o.day, queueNumber(o.number), o.customer, o.mode, o.items.map(i => `${i.quantity}x ${i.name}`).join('; '), o.total, o.discount_rp || 0, o.payment, statusNames[o.status] || o.status, o.ready_at ? Math.round((o.ready_at - o.created_at) / 60000) : ''])]);
    } catch (e) { setError((e as Error).message); } finally { setDlBusy(false); }
  };
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
  const targetMin = data?.summary.targetMin || config.target_ready_min || 10;
  const foodIdsH = new Set((products || []).filter(p => isFoodCategory(p.category)).map(p => p.id));
  const histTarget = (o: Order) => o.items.some(i => foodIdsH.has(i.id)) ? (data?.summary.targetFood || config.target_food_min || 15) : (data?.summary.targetDrink || config.target_drink_min || 5);
  const nReady = data?.summary.nReady || 0;
  const pctOn = nReady ? Math.round((data.summary.nOnTarget || 0) / nReady * 100) : 0;
  const maxWait = Math.max(1, ...(data?.summary.slowest || []).map((s: any) => s.wait || 0), ...(data?.summary.perCustomer || []).map((c: any) => c.avgwait || 0));
  return (
    <section className="history">
      <div className="history-toolbar">
        <label>Tanggal<Input aria-label="Tanggal" type="date" value={date} onChange={e => { setDate(e.target.value); setPage(1); }} /></label>
        <div className="search"><Search size={17} /><Input aria-label="Cari" placeholder="Nama / nomor" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></div>
        <Button variant="outline" size="sm" onClick={exportCSV} disabled={dlBusy || loading || !data?.count}>{dlBusy ? <Loader2 className="spin" size={15} /> : <ArrowRight size={15} />}CSV</Button>
        {!!nReady && <div className="hist-target"><Target size={15} /><span>Makanan ≤ {data.summary.targetFood || 15} · minuman ≤ {data.summary.targetDrink || 5} mnt · <b>{pctOn}%</b> tercapai ({data.summary.nOnTarget}/{nReady})</span></div>}
      </div>
      {error && <p className="banner error">{error}</p>}
      <div className="stats-row hist-stats">
        <div className="stat"><span><Ticket size={16} />Pesanan</span><strong>{data?.summary.orders || 0}</strong><small>{data?.count || 0} di halaman ini</small></div>
        <div className="stat good"><span><Wallet size={16} />Penjualan</span><strong>{money(data?.summary.sales || 0)}</strong><small>non-batal</small></div>
        <div className="stat bad"><span><X size={16} />Batal</span><strong>{data?.summary.cancelled || 0}</strong></div>
        <div className="stat good"><span><Clock size={16} />Rata siap</span><strong>{fmtDur(data?.summary.avgReady)}</strong><small>tipikal {fmtDur(data?.summary.medianReady)}</small></div>
        <div className="stat good"><span><Check size={16} />Rata ambil</span><strong>{fmtDur(data?.summary.avgTake)}</strong><small>siap → diambil</small></div>
      </div>
      {(!!data?.summary.perCustomer?.length || !!data?.summary.slowest?.length) && (
        <div className="hist-split">
          {!!data?.summary.slowest?.length && (
            <div className="ai-card hist-card">
              <h3><Timer size={15} /> 10 terlambat</h3>
              <p className="muted sm">Lewat target {targetMin} menit, urut paling lama.</p>
              <div className="slow-list">{data.summary.slowest.map((s: any, i: number) => {
                const over = s.wait - targetMin * 60000;
                return <div className={'late-row' + (over > 0 ? ' worst' : '')} key={s.number} style={{ animationDelay: `${i * 0.04}s` }}>
                  <div className="late-top"><span className="hist-num">{queueNumber(s.number)}</span><strong>{s.customer}</strong><span className="late-wait">{fmtDur(s.wait)}</span>{over > 0 ? <span className="chip warn">+{fmtDur(over)}</span> : <span className="chip ok">on target</span>}</div>
                  <div className="slow-bar"><i style={{ width: `${Math.max(6, (s.wait / maxWait) * 100)}%` }} /></div>
                </div>;
              })}</div>
            </div>
          )}
          {!!data?.summary.perStaff?.length && (
            <div className="ai-card hist-card">
              <h3><ShieldCheck size={15} /> Kecepatan per petugas</h3>
              <p className="muted sm">Rata pesan→siap dari pesanan yang dibuat tiap akun.</p>
              <div className="rank-list cust-list">{data.summary.perStaff.map((c: any, i: number) => (
                <div className="rank-row cust-row" key={c.id} style={{ animationDelay: `${i * 0.04}s` }}>
                  <span className={'rank r' + Math.min(i + 1, 3)}>{i + 1}</span>
                  <div className="rank-main"><strong>{c.name}</strong><small>{c.n}x pesanan · omzet {money(c.sales)}</small><div className="qty-bar"><i style={{ width: `${Math.max(6, (c.avgwait / maxWait) * 100)}%` }} /></div></div>
                  <div className="cust-avg"><b>{fmtDur(c.avgwait)}</b><small>rata siap</small></div>
                  <div className="cust-spent"><b>{c.n}x</b><small>pesanan</small></div>
                </div>
              ))}</div>
            </div>
          )}
          {!!data?.summary.perCustomer?.length && (
            <div className="ai-card hist-card">
              <h3><Users size={15} /> Tunggu per pelanggan</h3>
              <p className="muted sm">Rata-rata pesan→siap, 8 terlama hari ini.</p>
              <div className="rank-list cust-list">{data.summary.perCustomer.map((c: any, i: number) => (
                <div className="rank-row cust-row" key={c.customer} style={{ animationDelay: `${i * 0.04}s` }}>
                  <span className={'rank r' + Math.min(i + 1, 3)}>{i + 1}</span>
                  <div className="rank-main"><strong>{c.customer}</strong><small>{c.n}x pesanan · terlama {fmtDur(c.maxwait)}</small><div className="qty-bar"><i style={{ width: `${Math.max(6, (c.avgwait / maxWait) * 100)}%` }} /></div></div>
                  <div className="cust-avg"><b>{fmtDur(c.avgwait)}</b><small>rata tunggu</small></div>
                  <div className="cust-spent"><b>{money(c.spent)}</b><small>total belanja</small></div>
                </div>
              ))}</div>
            </div>
          )}
        </div>
      )}
      {!!data?.summary.perHour?.length && (
        <div className="ai-card hist-card hour-card">
          <h3><Clock size={15} /> Jam ramai hari ini</h3>
          <p className="muted sm">Rata pesan→siap per jam (waktu kafe). Merah = lewat target {targetMin} mnt.</p>
          <div className="hour-grid">{(() => { const mx = Math.max(1, ...data.summary.perHour.map((r: any) => r.n)); return data.summary.perHour.map((r: any) => {
            const over = r.avgwait != null && r.avgwait > targetMin * 60000;
            return <div key={r.h} className={'hour-cell' + (over ? ' over' : '') + (r.n === mx && mx > 1 ? ' busy' : '')} title={`${r.n} pesanan, rata ${fmtDur(r.avgwait)}`}>
              <b>{String(r.h).padStart(2, '0')}</b>
              {r.n === mx && mx > 1 && <em className="busy-chip">tersibuk</em>}
              <div className="hour-bar"><i style={{ height: `${Math.max(6, (r.n / mx) * 100)}%` }} /></div>
              <span>{r.n}x</span><small>{fmtDur(r.avgwait)}</small>
            </div>;
          }); })()}</div>
        </div>
      )}
      <div className="hist-list">
        <div className="section-top"><h2>Pesanan hari ini</h2><span className="muted">{data?.count || 0} catatan</span></div>
        {loading ? <p className="loading-text">Memuat…</p> : !data?.orders.length ? <Empty title="Kosong">Ganti tanggal / kata kunci.</Empty> : data.orders.map((o: Order, i: number) => {
          const wait = o.ready_at ? o.ready_at - o.created_at : null;
          const lim = histTarget(o);
          const over = wait != null && wait > lim * 60000;
          return (
            <article className={'hist-row st-' + o.status + (over ? ' over' : '')} key={o.id} style={{ animationDelay: `${Math.min(i, 12) * 0.03}s` }}>
              <div className="hist-q"><strong>{queueNumber(o.number)}</strong><small>{time(o.created_at, config.timezone)}</small></div>
              <div className="hist-who"><strong>{o.customer}</strong><small>{o.mode === 'takeaway' ? 'Bawa pulang' : 'Di sini'}{o.payment ? ` · ${o.payment}` : ''}</small></div>
              <div className="hist-wait"><span>{fmtDur(wait)}</span><small>{over ? 'lewat target' : wait ? 'siap' : 'belum siap'}</small></div>
              <div className="hist-tot"><b>{money(o.total)}</b><Status status={o.status} /></div>
              <Button variant="ghost" size="icon" aria-label={'Struk ' + queueNumber(o.number)} onClick={() => onReceipt(o)}><Printer size={16} /></Button>
            </article>
          );
        })}
      </div>
      <Pager page={page} pages={Math.max(1, Math.ceil((data?.count || 0) / 30))} onChange={setPage} />
    </section>
  );
}

function SettingsPanel({ config, products, payments, limited, onSave, onLogout }: { config: Config; products: Product[]; payments: Payment[]; limited?: boolean; onSave: (path: string, b: any) => Promise<any>; onLogout: () => void }) {
  const [tab, setTab] = useState(limited ? 'menu' : 'cafe');
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
  const sideInfo: Record<string, { title: string; body: string }> = {
    cafe: { title: 'Kafe & struk', body: 'Nama tampil di kasir, TV, dan struk. Zona waktu terkunci setelah setup agar nomor harian konsisten.' },
    menu: { title: 'Menu', body: 'Menu nonaktif hilang dari kasir tapi struk lama tidak berubah. Harga baru berlaku untuk pesanan baru.' },
    pay: { title: 'Bayar', body: 'Bank & kartu dipilih lewat menu Kartu di kasir. Tulis nomor setelah " - ", misal BRI - 1234567890.' },
    users: { title: 'Petugas', body: 'Satu akun per orang. Akun hilang? Nonaktifkan lalu buat baru. Kasir hanya bisa ubah menu.' },
    audit: { title: 'Aktivitas', body: 'Jejak 100 aksi terakhir — andalan saat ada selisih kas atau pesanan bermasalah.' },
    password: { title: 'Sandi', body: 'Minimal 10 karakter. Setelah ganti, semua sesi keluar dan harus masuk ulang.' },
  };
  return (
    <section>
      <div className="settings-grid">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="category-tabs">
          {!limited && <TabsTrigger value="cafe"><Store size={16} />Kafe</TabsTrigger>}
          <TabsTrigger value="menu"><Coffee size={16} />Menu</TabsTrigger>
          {!limited && <TabsTrigger value="pay"><Wallet size={16} />Bayar</TabsTrigger>}
          {!limited && <TabsTrigger value="users"><Users size={16} />Petugas</TabsTrigger>}
          {!limited && <TabsTrigger value="audit"><Archive size={16} />Aktivitas</TabsTrigger>}
          {!limited && <TabsTrigger value="password"><ShieldCheck size={16} />Sandi</TabsTrigger>}
        </TabsList>
        {error && <p className="banner error">{error}</p>}
        <TabsContent value="cafe">
          <form className="settings-form" onSubmit={e => { e.preventDefault(); save('settings', Object.fromEntries(new FormData(e.currentTarget))); }}>
            <h2>Kafe & struk</h2>
            <label>Nama kafe<Input name="name" defaultValue={config.name} maxLength={80} required /></label>
            <label>Teks struk & TV<Textarea name="footer" defaultValue={config.footer} maxLength={200} /></label>
            <label>Target pesan → siap (menit)<Input name="target" type="number" min={1} max={180} defaultValue={config.target_ready_min ?? 10} required /></label>
            <div className="set-2col">
              <label>Target makanan (mnt)<Input name="targetFood" type="number" min={1} max={180} defaultValue={config.target_food_min ?? 15} /></label>
              <label>Target minuman (mnt)<Input name="targetDrink" type="number" min={1} max={180} defaultValue={config.target_drink_min ?? 5} /></label>
              <label>Service (%)<Input name="servicePct" type="number" min={0} max={50} defaultValue={config.service_pct ?? 0} /></label>
              <label>Pajak (%)<Input name="taxPct" type="number" min={0} max={50} defaultValue={config.tax_pct ?? 0} /></label>
            </div>
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
      <aside key={tab} className="settings-side">
        <h3>{sideInfo[tab]?.title}</h3>
        <p>{sideInfo[tab]?.body}</p>
        <div className="side-stats">
          {tab === 'cafe' && <span>{config.timezone}</span>}
          {tab === 'menu' && <><span>{products.filter(p => p.active).length} aktif</span><span>{new Set(products.map(p => p.category)).size} kategori</span></>}
          {tab === 'pay' && <span>{payments.filter(p => p.active).length} aktif</span>}
          {tab === 'users' && (['admin', 'cashier', 'kitchen', 'display'] as const).map(r => <span key={r}>{roleNames[r]}: {users.filter(u => u.role === r).length}</span>)}
          {tab === 'audit' && <span>{audit.length} baris</span>}
        </div>
      </aside>
      </div>
      <Dialog open={!!edit} onOpenChange={v => { if (!v) setEdit(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.id ? 'Edit menu' : 'Tambah menu'}</DialogTitle><DialogDescription>Struk lama tidak berubah.</DialogDescription></DialogHeader>
          {edit && <form className="dialog-form" onSubmit={e => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.currentTarget)); save('products', { ...d, id: edit.id, price: Number(d.price), active: !!edit.active }, () => setEdit(null)); }}>
            <label>Nama<Input name="name" defaultValue={edit.name} required maxLength={80} /></label>
            <label>Kategori<Input name="category" defaultValue={edit.category} required maxLength={40} /></label>
            <label>Harga (Rp)<Input type="number" name="price" defaultValue={edit.price} min={0} max={100000000} step={1} required /></label>
            <label>Foto (URL https, opsional)<Input name="img" defaultValue={(edit as Product).img || ''} maxLength={500} placeholder="https://…" /></label>
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
