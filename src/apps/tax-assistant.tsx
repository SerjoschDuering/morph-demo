import React from 'react';

// --- Types ---
interface Expense { id: string; category: string; description: string; amount: number; date: string; receipt?: string }
interface YearData { year: number; income: number; expenses: Expense[]; tax_paid: number; notes: string; currency: string; receipts_folder: string; last_updated: string }
interface Customer { id: string; name: string; contact: string; email: string; address: string; vat_id: string; currency: string; default_rate: number; country: string }
interface InvoiceItem { qty: number; description: string; unit_price: number }
interface Invoice { id: string; invoice_number: string; customer_id: string; customer_name: string; date: string; due_date: string; items: InvoiceItem[]; subtotal: number; currency: string; status: string; pdf_path: string; notes: string }

type Section = 'tax' | 'customers' | 'invoices';
const YEARS = [2023, 2024, 2025, 2026];
const DATA_DIR = '~/morph-workspace/apps/personal/tax-assistant';
const RECEIPTS = '~/Downloads/Receipts';
const path = (f: string) => `${DATA_DIR}/${f}`;

// --- Helpers ---
const num = (v: unknown) => Number(v) || 0;
const arr = <T,>(v: unknown): T[] => Array.isArray(v) ? v : [];

async function readJson<T>(file: string): Promise<T | null> {
  try {
    const t = await window.Morph?.readFile(path(file));
    return t ? JSON.parse(t) as T : null;
  } catch { return null; }
}

// --- Shared styles ---
const S = {
  root: { height: '100%', background: 'var(--bg-panel)', color: 'var(--text-1)', padding: 20, overflowY: 'auto' as const, fontFamily: 'system-ui', boxSizing: 'border-box' as const },
  header: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 },
  title: { fontSize: 11, fontWeight: 700, color: 'var(--text-2)', letterSpacing: '0.08em', textTransform: 'uppercase' as const },
  sectionBar: { display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 8 },
  sectionTab: (a: boolean) => ({ padding: '6px 14px', borderRadius: '8px 8px 0 0', fontSize: 12, fontWeight: a ? 700 : 500, cursor: 'pointer', border: 'none', background: a ? 'var(--bg-card)' : 'transparent', color: a ? 'var(--text-1)' : 'var(--text-3)', borderBottom: a ? '2px solid var(--accent)' : '2px solid transparent' }),
  yearBar: { display: 'flex', gap: 6, marginBottom: 16 },
  yearTab: (a: boolean) => ({ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: a ? 700 : 500, cursor: 'pointer', border: a ? '1px solid var(--accent)' : '1px solid var(--border)', background: a ? 'var(--accent)' : 'var(--bg-card)', color: a ? '#fff' : 'var(--text-2)', boxShadow: a ? '0 0 12px rgba(99,102,241,0.3)' : 'none' }),
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 },
  card: { background: 'var(--bg-card)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border)' },
  cardLabel: { fontSize: 10, color: 'var(--text-3)', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
  cardVal: (c: string) => ({ fontSize: 18, fontWeight: 700, color: c }),
  table: { background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' },
  th: (cols: string) => ({ display: 'grid', gridTemplateColumns: cols, padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase' as const, letterSpacing: '0.05em', fontWeight: 600 }),
  tr: (cols: string) => ({ display: 'grid', gridTemplateColumns: cols, padding: '8px 14px', borderBottom: '1px solid var(--border)', fontSize: 13, alignItems: 'center' }),
  empty: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 24, textAlign: 'center' as const },
  hint: { background: 'var(--bg-active)', padding: '10px 14px', borderRadius: 7, fontSize: 12, color: 'var(--accent)', fontFamily: 'monospace', border: '1px solid var(--accent-border)', marginTop: 10, textAlign: 'left' as const, lineHeight: 1.6 },
  footer: { marginTop: 14, fontSize: 11, color: 'var(--text-3)', display: 'flex', gap: 12 },
  badge: (color: string) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: color === 'green' ? 'rgba(52,199,89,0.15)' : color === 'yellow' ? 'rgba(245,158,11,0.15)' : 'rgba(156,163,175,0.15)', color: color === 'green' ? '#34c759' : color === 'yellow' ? '#f59e0b' : 'var(--text-3)' }),
};

export default function App() {
  const [section, setSection] = React.useState<Section>('tax');
  const [activeYear, setActiveYear] = React.useState(2025);
  const [taxData, setTaxData] = React.useState<YearData | null>(null);
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [loading, setLoading] = React.useState(false);

  // Refs to always have latest data for context sync
  const customersRef = React.useRef<Customer[]>([]);
  const invoicesRef = React.useRef<Invoice[]>([]);
  const taxRef = React.useRef<YearData | null>(null);
  const yearRef = React.useRef(activeYear);
  const sectionRef = React.useRef<Section>(section);
  yearRef.current = activeYear;
  sectionRef.current = section;

  const syncContext = React.useCallback(() => {
    const c = customersRef.current, inv = invoicesRef.current, d = taxRef.current;
    const exps = arr<Expense>(d?.expenses);
    const inc = num(d?.income), tp = num(d?.tax_paid);
    const totExp = exps.reduce((s, e) => s + num(e.amount), 0);
    const sec = sectionRef.current, yr = yearRef.current;

    // Build a 5-word summary based on active section
    const summary = sec === 'tax'
      ? `${yr} · ${exps.length} expenses · €${Math.round(totExp)}`
      : sec === 'customers'
      ? `${c.length} customers`
      : `${inv.length} invoices · ${inv.filter(i => i.status === 'paid').length} paid`;

    window.Morph?.updateContext({
      _summary: summary,
      activeSection: sec,
      activeYear: yr,
      // Minimal counts — read the files for full details
      customerCount: c.length,
      customerNames: c.map(x => x.name),
      invoiceCount: inv.length,
      totalBilled: inv.reduce((s, i) => s + num(i.subtotal), 0),
      income: inc, totalExpenses: Math.round(totExp * 100) / 100, taxPaid: tp,
      expenseCount: exps.length,
      // File pointers — Claude reads these when it needs details
      files: {
        tax: path(`${yr}.json`),
        customers: path('customers.json'),
        invoices: path('invoices.json'),
      },
    });
  }, []);

  const loadTax = React.useCallback(async (year: number, silent = false) => {
    if (!silent) setLoading(true);
    const d = await readJson<YearData>(`${year}.json`);
    setTaxData(d); taxRef.current = d;
    syncContext();
    if (!silent) setLoading(false);
  }, [syncContext]);

  const loadCustomers = React.useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const c = await readJson<Customer[]>('customers.json');
    const list = arr<Customer>(c);
    setCustomers(list); customersRef.current = list;
    syncContext();
    if (!silent) setLoading(false);
  }, [syncContext]);

  const loadInvoices = React.useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const inv = await readJson<Invoice[]>('invoices.json');
    const list = arr<Invoice>(inv);
    setInvoices(list); invoicesRef.current = list;
    syncContext();
    if (!silent) setLoading(false);
  }, [syncContext]);

  React.useEffect(() => {
    window.Morph?.register({
      description: 'Multi-year tax dashboard with customers & invoices. State shows summary counts only — read the JSON files for full details. To modify: read file → update → write back. App auto-reloads every 3s.',
      contextHint: '_summary, activeSection, activeYear, customerNames, invoiceCount, totalBilled, income, files{tax,customers,invoices}',
      commands: ['reload', 'reload-customers', 'reload-invoices'],
      capabilities: ['readFile', 'listDir'],
    });
    loadTax(activeYear);
    loadCustomers();
    loadInvoices();
    window.Morph?.onCommand((cmd: any) => {
      const c = typeof cmd === 'string' ? cmd : cmd.command;
      if (c === 'reload') loadTax(activeYear);
      if (c === 'reload-customers') loadCustomers();
      if (c === 'reload-invoices') loadInvoices();
    });
  }, []);

  React.useEffect(() => { if (section === 'tax') loadTax(activeYear); }, [activeYear]);
  React.useEffect(() => {
    if (section === 'tax') loadTax(activeYear);
    else if (section === 'customers') loadCustomers();
    else loadInvoices();
    syncContext();
  }, [section]);

  // Auto-poll for file changes (silent, no loading spinner)
  React.useEffect(() => {
    const id = setInterval(() => {
      loadTax(yearRef.current, true);
      loadCustomers(true);
      loadInvoices(true);
    }, 3000);
    return () => clearInterval(id);
  }, [loadTax, loadCustomers, loadInvoices]);

  // --- Formatters ---
  const cur = (c?: string) => c === 'CHF' ? 'CHF ' : '€';
  const fmt = (n: unknown, c?: string) => `${cur(c)}${num(n).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const fmtDate = (d: string) => { try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return d; } };
  const statusColor = (s: string) => s === 'paid' ? 'green' : s === 'sent' ? 'yellow' : 'gray';

  // --- Tax Section ---
  const exps = arr<Expense>(taxData?.expenses);
  const income = num(taxData?.income), tp = num(taxData?.tax_paid);
  const totExp = exps.reduce((s, e) => s + num(e.amount), 0);
  const rate = income > 0 ? (tp / income) * 100 : 0;
  const expCols = '100px 1fr 90px 90px 110px';

  const TaxView = () => (
    <>
      <div style={S.yearBar}>
        {YEARS.map(y => <div key={y} style={S.yearTab(y === activeYear)} onClick={() => setActiveYear(y)}>{y}{y === activeYear ? ' ★' : ''}</div>)}
      </div>
      {!taxData ? (
        <div style={S.empty}>
          <div style={{ fontSize: 14, color: 'var(--text-1)', fontWeight: 600, marginBottom: 6 }}>No data for {activeYear} yet.</div>
          <div style={S.hint}>"Read my receipts in {RECEIPTS} for {activeYear} and populate {path(`${activeYear}.json`)}"</div>
        </div>
      ) : (
        <>
          <div style={S.grid4}>
            {[{ l: 'Income', v: fmt(income), c: '#34c759' }, { l: 'Expenses', v: fmt(totExp), c: '#ef4444' }, { l: 'Tax Paid', v: fmt(tp), c: '#f59e0b' }, { l: 'Eff. Rate', v: `${rate.toFixed(1)}%`, c: 'var(--text-1)' }].map(x => (
              <div key={x.l} style={S.card}><div style={S.cardLabel}>{x.l}</div><div style={S.cardVal(x.c)}>{x.v}</div></div>
            ))}
          </div>
          {exps.length > 0 ? (
            <div style={S.table}>
              <div style={S.th(expCols)}><span>Category</span><span>Description</span><span>Amount</span><span>Date</span><span>Receipt</span></div>
              {exps.map((e, i) => (
                <div key={e.id || i} style={S.tr(expCols)}>
                  <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>{e.category || '—'}</span>
                  <span>{e.description || '—'}</span>
                  <span style={{ color: '#ef4444', fontWeight: 600 }}>{fmt(e.amount)}</span>
                  <span style={{ color: 'var(--text-3)' }}>{fmtDate(e.date || '')}</span>
                  <span style={{ color: 'var(--accent)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.receipt || '—'}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={S.empty}>
              <div style={{ fontSize: 13, color: 'var(--text-2)' }}>No expenses for {activeYear}.</div>
              <div style={S.hint}>"I have an Amazon receipt for €250 office supplies, January {activeYear}"</div>
            </div>
          )}
          <div style={S.footer}><span>Receipts: {taxData.receipts_folder || RECEIPTS}</span><span>·</span><span>Updated: {taxData.last_updated || '—'}</span></div>
        </>
      )}
    </>
  );

  // --- Customers Section ---
  const custCols = '1fr 120px 160px 60px 80px';
  const CustomersView = () => (
    customers.length === 0 ? (
      <div style={S.empty}>
        <div style={{ fontSize: 14, color: 'var(--text-1)', fontWeight: 600, marginBottom: 6 }}>No customers yet.</div>
        <div style={S.hint}>"Add a customer: Nebula Studios GmbH, Munich, €140/hr, contact zara@nebulastudios.io"</div>
      </div>
    ) : (
      <>
        <div style={{ ...S.grid4, gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 16 }}>
          <div style={S.card}><div style={S.cardLabel}>Customers</div><div style={S.cardVal('var(--text-1)')}>{customers.length}</div></div>
          <div style={S.card}><div style={S.cardLabel}>Countries</div><div style={S.cardVal('var(--text-1)')}>{new Set(customers.map(c => c.country)).size}</div></div>
          <div style={S.card}><div style={S.cardLabel}>Avg Rate</div><div style={S.cardVal('#34c759')}>€{Math.round(customers.reduce((s, c) => s + num(c.default_rate), 0) / customers.length)}/hr</div></div>
        </div>
        <div style={S.table}>
          <div style={S.th(custCols)}><span>Company</span><span>Contact</span><span>Email</span><span>Country</span><span>Rate</span></div>
          {customers.map(c => (
            <div key={c.id} style={S.tr(custCols)}>
              <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>{c.name}</span>
              <span style={{ color: 'var(--text-2)' }}>{c.contact}</span>
              <span style={{ color: 'var(--accent)', fontSize: 12 }}>{c.email}</span>
              <span style={{ color: 'var(--text-3)' }}>{c.country}</span>
              <span style={{ fontWeight: 600, color: '#34c759' }}>{cur(c.currency)}{c.default_rate}</span>
            </div>
          ))}
        </div>
      </>
    )
  );

  // --- Invoices Section ---
  const invCols = '110px 1fr 90px 90px 70px';
  const totalBilled = invoices.reduce((s, i) => s + num(i.subtotal), 0);
  const paidCount = invoices.filter(i => i.status === 'paid').length;

  const InvoicesView = () => (
    invoices.length === 0 ? (
      <div style={S.empty}>
        <div style={{ fontSize: 14, color: 'var(--text-1)', fontWeight: 600, marginBottom: 6 }}>No invoices yet.</div>
        <div style={S.hint}>"Create an invoice for Nebula Studios: 20 hours consulting in March 2026"</div>
      </div>
    ) : (
      <>
        <div style={S.grid4}>
          <div style={S.card}><div style={S.cardLabel}>Invoices</div><div style={S.cardVal('var(--text-1)')}>{invoices.length}</div></div>
          <div style={S.card}><div style={S.cardLabel}>Total Billed</div><div style={S.cardVal('#34c759')}>{fmt(totalBilled)}</div></div>
          <div style={S.card}><div style={S.cardLabel}>Paid</div><div style={S.cardVal('#34c759')}>{paidCount}/{invoices.length}</div></div>
          <div style={S.card}><div style={S.cardLabel}>Outstanding</div><div style={S.cardVal('#f59e0b')}>{fmt(invoices.filter(i => i.status !== 'paid').reduce((s, i) => s + num(i.subtotal), 0))}</div></div>
        </div>
        <div style={S.table}>
          <div style={S.th(invCols)}><span>Invoice #</span><span>Customer</span><span>Amount</span><span>Date</span><span>Status</span></div>
          {invoices.map(inv => (
            <div key={inv.id} style={S.tr(invCols)}>
              <span style={{ fontWeight: 600, color: 'var(--accent)', fontSize: 12 }}>{inv.invoice_number}</span>
              <span style={{ color: 'var(--text-1)' }}>{inv.customer_name}</span>
              <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>{fmt(inv.subtotal, inv.currency)}</span>
              <span style={{ color: 'var(--text-3)' }}>{fmtDate(inv.date)}</span>
              <span><span style={S.badge(statusColor(inv.status))}>{inv.status}</span></span>
            </div>
          ))}
        </div>
      </>
    )
  );

  return (
    <div style={S.root}>
      <div style={S.header}><span style={S.title}>Tax Assistant</span></div>
      <div style={S.sectionBar}>
        {(['tax', 'customers', 'invoices'] as Section[]).map(s => (
          <div key={s} style={S.sectionTab(s === section)} onClick={() => setSection(s)}>
            {s === 'tax' ? '📊 Tax' : s === 'customers' ? '👥 Customers' : '📄 Invoices'}
          </div>
        ))}
      </div>
      {loading && <div style={{ color: 'var(--text-3)', fontSize: 12 }}>Loading…</div>}
      {!loading && section === 'tax' && <TaxView />}
      {!loading && section === 'customers' && <CustomersView />}
      {!loading && section === 'invoices' && <InvoicesView />}
    </div>
  );
}
