'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dbClient } from '@/lib/db';
import { Bill, Product, Expense, ShopSettings } from '@/lib/types';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Users,
  Wallet,
  PiggyBank,
  Target,
  Layers,
  Activity,
  Zap,
  ShoppingBag,
  CircleDollarSign,
  BadgePercent,
  Banknote,
  CalendarRange,
  ChevronRight,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

type TimePeriod = 'today' | 'week' | 'month' | 'year' | 'all';

/* ────────────────────────────────────────────────────────────────
 * Custom Tooltip – glass-style, works on every chart
 * ────────────────────────────────────────────────────────────── */
const glassTooltipStyle = {
  backgroundColor: 'rgba(15, 23, 42, 0.92)',
  borderColor: 'rgba(255,255,255,0.06)',
  borderRadius: '12px',
  color: '#f8fafc',
  fontSize: '11px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
  padding: '8px 12px',
};

export default function AccountsPage() {
  const [period, setPeriod] = useState<TimePeriod>('month');

  /* ── Queries ─────────────────────────────────────────────────── */
  const { data: settings } = useQuery<ShopSettings>({
    queryKey: ['settings'],
    queryFn: dbClient.shopSettings.get,
  });
  const { data: bills = [], isLoading: billsLoading } = useQuery<Bill[]>({
    queryKey: ['bills'],
    queryFn: dbClient.bills.list,
  });
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: dbClient.products.list,
  });
  const { data: expenses = [], isLoading: expensesLoading } = useQuery<Expense[]>({
    queryKey: ['expenses'],
    queryFn: dbClient.expenses.list,
  });
  const { data: customers = [] } = useQuery<any[]>({
    queryKey: ['customers'],
    queryFn: dbClient.customers.list,
  });

  const isLoading = billsLoading || expensesLoading;
  const cur = settings?.currency_symbol || '₹';

  /* ── Helpers ─────────────────────────────────────────────────── */
  const now = new Date();

  const getStartDate = (p: TimePeriod): Date | null => {
    const d = new Date();
    switch (p) {
      case 'today':  d.setHours(0,0,0,0); return d;
      case 'week':   d.setDate(d.getDate()-7); d.setHours(0,0,0,0); return d;
      case 'month':  d.setDate(1); d.setHours(0,0,0,0); return d;
      case 'year':   d.setMonth(0,1); d.setHours(0,0,0,0); return d;
      case 'all':    return null;
    }
  };

  const tag = (p: TimePeriod) =>
    ({ today:'Today', week:'This Week', month:'This Month', year:'This Year', all:'All Time' }[p]);

  const fmt = (n: number) => {
    if (Math.abs(n) >= 100000) return `${(n/100000).toFixed(2)}L`;
    if (Math.abs(n) >= 1000) return `${(n/1000).toFixed(1)}K`;
    return n.toFixed(2);
  };

  /* ── Filtered data ───────────────────────────────────────────── */
  const filteredBills = useMemo(() => {
    const s = getStartDate(period);
    return s ? bills.filter(b => new Date(b.created_at) >= s) : bills;
  }, [bills, period]);

  const filteredExpenses = useMemo(() => {
    const s = getStartDate(period);
    if (!s) return expenses;
    const ss = s.toISOString().split('T')[0];
    return expenses.filter(e => e.date >= ss);
  }, [expenses, period]);

  /* ── KPIs ────────────────────────────────────────────────────── */
  const totalRevenue   = useMemo(() => filteredBills.reduce((s,b) => s + Number(b.grand_total), 0), [filteredBills]);
  const totalPaid      = useMemo(() => filteredBills.reduce((s,b) => s + Number(b.amount_paid), 0), [filteredBills]);
  const totalPending   = useMemo(() => filteredBills.reduce((s,b) => s + Number(b.pending_amount), 0), [filteredBills]);
  const totalExp       = useMemo(() => filteredExpenses.reduce((s,e) => s + Number(e.amount), 0), [filteredExpenses]);

  const avgCostRatio = useMemo(() => {
    if (!products.length) return 0.6;
    let ts = 0, tc = 0;
    products.forEach(p => { const sp=Number(p.selling_price), cp=Number(p.cost_price||0); if(sp>0&&cp>0){ts+=sp;tc+=cp;} });
    return ts > 0 ? tc/ts : 0.6;
  }, [products]);

  const cogs        = useMemo(() => filteredBills.reduce((s,b) => s + Number(b.subtotal)*avgCostRatio, 0), [filteredBills, avgCostRatio]);
  const grossProfit = totalRevenue - cogs;
  const netProfit   = grossProfit - totalExp;
  const margin      = totalRevenue > 0 ? (netProfit/totalRevenue)*100 : 0;
  const invoiceCount= filteredBills.length;

  /* ── Previous period comparison ──────────────────────────────── */
  const prevRev = useMemo(() => {
    const s = getStartDate(period);
    if (!s || period==='all') return 0;
    const len = now.getTime() - s.getTime();
    const ps = new Date(s.getTime() - len);
    return bills.filter(b => { const d=new Date(b.created_at); return d>=ps && d<s; }).reduce((a,b)=>a+Number(b.grand_total),0);
  }, [bills, period]);
  const growth = prevRev > 0 ? ((totalRevenue-prevRev)/prevRev)*100 : 0;

  /* ── Chart: 12‑month revenue vs expenses ─────────────────────── */
  const monthlyData = useMemo(() => {
    const m: Record<string, { r:number; e:number }> = {};
    for (let i=11; i>=0; i--) { const d=new Date(); d.setMonth(d.getMonth()-i); m[`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`]={r:0,e:0}; }
    bills.forEach(b => { const d=new Date(b.created_at), k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; if(m[k]!==undefined) m[k].r+=Number(b.grand_total); });
    expenses.forEach(e => { const d=new Date(e.date), k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; if(m[k]!==undefined) m[k].e+=Number(e.amount); });
    return Object.keys(m).sort().map(k => {
      const d = new Date(k+'-01');
      return { name: d.toLocaleDateString('en-GB',{month:'short'}), Revenue: +m[k].r.toFixed(2), Expenses: +m[k].e.toFixed(2), Profit: +(m[k].r*(1-avgCostRatio)-m[k].e).toFixed(2) };
    });
  }, [bills, expenses, avgCostRatio]);

  /* ── Chart: expense categories ───────────────────────────────── */
  const expCatData = useMemo(() => {
    const map: Record<string,number> = {};
    filteredExpenses.forEach(e => { map[e.category]=(map[e.category]||0)+Number(e.amount); });
    return Object.entries(map).map(([n,v])=>({name:n,value:+v.toFixed(2)})).sort((a,b)=>b.value-a.value);
  }, [filteredExpenses]);

  /* ── Chart: payment status ───────────────────────────────────── */
  const statusData = useMemo(() => {
    let pd=0, pt=0, pn=0;
    filteredBills.forEach(b => { if(b.status==='Paid') pd++; else if(b.status==='Partial') pt++; else pn++; });
    return [{name:'Paid',value:pd,color:'#10b981'},{name:'Partial',value:pt,color:'#f59e0b'},{name:'Pending',value:pn,color:'#ef4444'}].filter(d=>d.value>0);
  }, [filteredBills]);

  /* ── Top customers ───────────────────────────────────────────── */
  const topCust = useMemo(() => [...customers].sort((a,b)=>Number(b.total_purchases)-Number(a.total_purchases)).slice(0,5), [customers]);

  /* ── Loading ─────────────────────────────────────────────────── */
  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="relative h-10 w-10">
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
            <Loader2 className="animate-spin text-primary relative h-10 w-10" />
          </div>
          <span className="text-xs text-muted-foreground animate-pulse">Loading analytics…</span>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
   *  R E N D E R
   * ═══════════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-5 sm:space-y-6 lg:space-y-8 pb-6">

      {/* ─── HERO BANNER ──────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-border/40 bg-gradient-to-br from-primary/[0.06] via-card to-violet-500/[0.04] px-5 py-5 sm:px-8 sm:py-7">
        {/* decorative blurs */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/[0.06] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-52 w-52 rounded-full bg-violet-500/[0.05] blur-3xl" />
        <div className="pointer-events-none absolute top-4 right-4 opacity-[0.025] hidden sm:block"><BarChart3 size={100} /></div>

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* left */}
          <div className="space-y-1.5 sm:space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/15 px-2.5 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-primary">
              <Activity size={10} /> Financial Analytics
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-foreground leading-tight">
              Accounts Overview
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-md leading-relaxed hidden sm:block">
              Revenue, profit margins, expenses & performance — at a glance.
            </p>
          </div>

          {/* period pills */}
          <div className="flex items-center gap-0.5 rounded-xl sm:rounded-2xl bg-secondary/50 backdrop-blur-sm border border-border/40 p-1 sm:p-1.5 self-start sm:self-auto overflow-x-auto scrollbar-none">
            {(['today','week','month','year','all'] as TimePeriod[]).map(p => (
              <button key={p} onClick={()=>setPeriod(p)}
                className={`whitespace-nowrap rounded-lg sm:rounded-xl px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold capitalize transition-all duration-200 ${
                  period===p
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                }`}
              >{p==='all'?'All':p}</button>
            ))}
          </div>
        </div>
      </section>

      {/* ─── KPI CARDS ────────────────────────────────────────── */}
      <section className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        {/* Revenue */}
        <KpiCard
          icon={DollarSign} label="Revenue" value={`${cur}${fmt(totalRevenue)}`}
          sub={`${invoiceCount} invoice${invoiceCount!==1?'s':''} · ${tag(period)}`}
          accent="emerald"
          badge={growth!==0 && period!=='all' ? (
            <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${growth>=0?'bg-emerald-500/10 text-emerald-500':'bg-red-500/10 text-red-500'}`}>
              {growth>=0?<ArrowUpRight size={9}/>:<ArrowDownRight size={9}/>}{Math.abs(growth).toFixed(1)}%
            </span>
          ) : null}
        />
        {/* Net Profit */}
        <KpiCard
          icon={PiggyBank} label="Net Profit"
          value={`${netProfit<0?'-':''}${cur}${fmt(Math.abs(netProfit))}`}
          sub="After COGS & expenses"
          accent={netProfit>=0 ? 'violet' : 'red'}
          badge={<span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${margin>=0?'bg-violet-500/10 text-violet-400':'bg-red-500/10 text-red-400'}`}>{margin.toFixed(1)}%</span>}
          valueClass={netProfit>=0?'text-violet-500':'text-red-500'}
        />
        {/* Expenses */}
        <KpiCard
          icon={TrendingDown} label="Expenses" value={`${cur}${fmt(totalExp)}`}
          sub={`${filteredExpenses.length} record${filteredExpenses.length!==1?'s':''} logged`}
          accent="rose" valueClass="text-rose-500"
        />
        {/* Receivable */}
        <KpiCard
          icon={Wallet} label="Receivable" value={`${cur}${fmt(totalPending)}`}
          sub={totalPending>0?'Outstanding dues':'All clear — no dues!'}
          accent={totalPending>0?'amber':'emerald'}
          valueClass={totalPending>0?'text-amber-500':'text-emerald-500'}
          badge={totalPending>0 ? <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"/><span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"/></span> : null}
        />
      </section>

      {/* ─── QUICK STATS RIBBON ───────────────────────────────── */}
      <section className="grid gap-2.5 sm:gap-3 grid-cols-2 sm:grid-cols-4">
        {[
          {label:'Collected', val:`${cur}${fmt(totalPaid)}`, Icon:Banknote, cls:'text-emerald-500'},
          {label:'Gross Profit', val:`${cur}${fmt(grossProfit)}`, Icon:CircleDollarSign, cls:grossProfit>=0?'text-emerald-500':'text-red-500'},
          {label:'Avg. Invoice', val:`${cur}${invoiceCount>0?fmt(totalRevenue/invoiceCount):'0.00'}`, Icon:ShoppingBag, cls:'text-primary'},
          {label:'Cost of Goods', val:`${cur}${fmt(cogs)}`, Icon:Layers, cls:'text-muted-foreground'},
        ].map((s,i)=>(
          <div key={i} className="flex items-center gap-2.5 sm:gap-3 rounded-xl border border-border/30 bg-card/60 backdrop-blur-sm px-3 sm:px-4 py-2.5 sm:py-3 transition-all hover:bg-card hover:border-border/60 hover:shadow-sm">
            <div className={`flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg bg-secondary/60 ${s.cls}`}>
              <s.Icon size={13} />
            </div>
            <div className="min-w-0 overflow-hidden">
              <div className="text-[8px] sm:text-[9px] text-muted-foreground font-bold uppercase tracking-widest truncate">{s.label}</div>
              <div className={`text-xs sm:text-sm font-bold font-mono ${s.cls} truncate`}>{s.val}</div>
            </div>
          </div>
        ))}
      </section>

      {/* ─── CHARTS ROW ───────────────────────────────────────── */}
      <section className="grid gap-4 sm:gap-5 lg:gap-6 grid-cols-1 lg:grid-cols-5">
        {/* Revenue & Expenses area chart */}
        <ChartCard className="lg:col-span-3" icon={CalendarRange} title="12-Month Trend" subtitle="Revenue vs Expenses"
          legend={<><Dot color="#10b981"/>Revenue<Dot color="#f43f5e"/>Expenses</>}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthlyData} margin={{top:5,right:5,left:-25,bottom:0}}>
              <defs>
                <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.22}/><stop offset="100%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f43f5e" stopOpacity={0.18}/><stop offset="100%" stopColor="#f43f5e" stopOpacity={0}/></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,128,0.06)"/>
              <XAxis dataKey="name" stroke="#888" fontSize={10} tickLine={false} axisLine={false}/>
              <YAxis stroke="#888" fontSize={10} tickLine={false} axisLine={false}/>
              <Tooltip contentStyle={glassTooltipStyle} itemStyle={{color:'#f8fafc'}}/>
              <Area type="monotone" dataKey="Revenue" stroke="#10b981" strokeWidth={2.5} fill="url(#gRev)" dot={false} activeDot={{r:4,strokeWidth:2}}/>
              <Area type="monotone" dataKey="Expenses" stroke="#f43f5e" strokeWidth={2} fill="url(#gExp)" dot={false} activeDot={{r:4,strokeWidth:2}}/>
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Payment status donut */}
        <ChartCard className="lg:col-span-2" icon={BadgePercent} title="Payment Status" subtitle="Invoice collection breakdown">
          {statusData.length===0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/50 bg-secondary/10">
              <Zap className="text-muted-foreground/30" size={24}/>
              <span className="text-[10px] text-muted-foreground">No invoices in this period</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius="42%" outerRadius="68%" paddingAngle={4} dataKey="value" strokeWidth={0}
                  label={({name,value})=>`${name}: ${value}`} labelLine={false}
                >
                  {statusData.map((e,i)=>(<Cell key={i} fill={e.color}/>))}
                </Pie>
                <Tooltip contentStyle={glassTooltipStyle}/>
                <Legend wrapperStyle={{fontSize:'10px'}} iconType="circle" iconSize={7}/>
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </section>

      {/* ─── EXPENSE CATEGORY BAR CHART ───────────────────────── */}
      {expCatData.length>0 && (
        <ChartCard icon={TrendingDown} iconColor="text-rose-500" bgColor="bg-rose-500/10" title="Expense Breakdown" subtitle="Cost distribution by category"
          extra={<span className="text-[10px] text-muted-foreground font-mono">{filteredExpenses.length} entries</span>}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={expCatData} margin={{top:5,right:5,left:-25,bottom:0}}>
              <defs>
                <linearGradient id="bGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity={0.85}/><stop offset="100%" stopColor="var(--primary)" stopOpacity={0.35}/></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,128,0.06)"/>
              <XAxis dataKey="name" stroke="#888" fontSize={9} tickLine={false} axisLine={false}/>
              <YAxis stroke="#888" fontSize={10} tickLine={false} axisLine={false}/>
              <Tooltip contentStyle={glassTooltipStyle}/>
              <Bar dataKey="value" name="Amount" fill="url(#bGrad)" radius={[6,6,0,0]} barSize={24}/>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* ─── BOTTOM: CUSTOMERS + SNAPSHOT ─────────────────────── */}
      <section className="grid gap-4 sm:gap-5 lg:gap-6 grid-cols-1 lg:grid-cols-3">

        {/* Top Customers */}
        <div className="lg:col-span-2 rounded-2xl border border-border/40 bg-card overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-border/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500/10 text-blue-500"><Users size={12}/></div>
              <div>
                <h3 className="font-bold text-foreground text-xs sm:text-sm">Top Customers</h3>
                <p className="text-[9px] sm:text-[10px] text-muted-foreground">By total purchase value</p>
              </div>
            </div>
            <span className="rounded-full bg-secondary/60 border border-border/40 px-2 py-0.5 text-[9px] font-bold text-muted-foreground">{customers.length}</span>
          </div>

          {topCust.length===0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center gap-2">
              <Users className="text-muted-foreground/25" size={28}/>
              <span className="text-xs text-muted-foreground">No customer data yet</span>
            </div>
          ) : (
            <>
              {/* Desktop / Tablet table */}
              <div className="overflow-x-auto hidden sm:block">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border/30 bg-secondary/20 text-[8px] sm:text-[9px] font-bold uppercase text-muted-foreground tracking-widest">
                      <th className="px-4 sm:px-6 py-2.5 w-10">#</th>
                      <th className="px-4 sm:px-6 py-2.5">Customer</th>
                      <th className="px-4 sm:px-6 py-2.5">Spent</th>
                      <th className="px-4 sm:px-6 py-2.5">Pending</th>
                      <th className="px-4 sm:px-6 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topCust.map((c,i)=>(
                      <tr key={c.id} className="border-b border-border/20 hover:bg-secondary/10 transition-colors group">
                        <td className="px-4 sm:px-6 py-3">
                          <RankBadge rank={i}/>
                        </td>
                        <td className="px-4 sm:px-6 py-3">
                          <span className="font-semibold text-foreground group-hover:text-primary transition-colors text-xs sm:text-sm">{c.name}</span>
                          {c.phone && <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{c.phone}</div>}
                        </td>
                        <td className="px-4 sm:px-6 py-3 font-mono font-bold text-emerald-500 text-xs sm:text-sm">{cur}{Number(c.total_purchases).toFixed(2)}</td>
                        <td className="px-4 sm:px-6 py-3 font-mono font-semibold text-xs sm:text-sm">
                          <span className={Number(c.total_pending)>0?'text-amber-500':'text-muted-foreground/40'}>{cur}{Number(c.total_pending).toFixed(2)}</span>
                        </td>
                        <td className="px-4 sm:px-6 py-3">
                          <StatusPill clear={Number(c.total_pending)===0}/>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="sm:hidden divide-y divide-border/20">
                {topCust.map((c,i)=>(
                  <div key={c.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/10 transition-all">
                    <RankBadge rank={i}/>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm truncate">{c.name}</div>
                      {Number(c.total_pending)>0 && <div className="text-[10px] text-amber-500 font-mono">Due: {cur}{Number(c.total_pending).toFixed(2)}</div>}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono font-bold text-xs text-emerald-500">{cur}{Number(c.total_purchases).toFixed(2)}</div>
                      <StatusPill clear={Number(c.total_pending)===0} small/>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Financial Snapshot */}
        <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-border/40">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary"><Target size={12}/></div>
              <div>
                <h3 className="font-bold text-foreground text-xs sm:text-sm">Snapshot</h3>
                <p className="text-[9px] sm:text-[10px] text-muted-foreground">All-time business metrics</p>
              </div>
            </div>
          </div>
          <div className="divide-y divide-border/20">
            {[
              {l:'Total Products',   v:String(products.length)},
              {l:'Total Customers',  v:String(customers.length)},
              {l:'All-Time Invoices',v:String(bills.length)},
              {l:'All-Time Revenue', v:`${cur}${bills.reduce((s,b)=>s+Number(b.grand_total),0).toFixed(2)}`, c:'text-emerald-500'},
              {l:'All-Time Expenses',v:`${cur}${expenses.reduce((s,e)=>s+Number(e.amount),0).toFixed(2)}`, c:'text-rose-500'},
              {l:'Avg. Cost Ratio',  v:`${(avgCostRatio*100).toFixed(1)}%`},
            ].map((r,i)=>(
              <div key={i} className="px-4 sm:px-5 py-3 sm:py-3.5 flex justify-between items-center hover:bg-secondary/5 transition-colors">
                <span className="text-[10px] sm:text-xs text-muted-foreground">{r.l}</span>
                <span className={`font-mono font-bold text-xs sm:text-sm ${r.c||''}`}>{r.v}</span>
              </div>
            ))}
            {/* Highlighted margin row */}
            <div className="px-4 sm:px-5 py-3.5 sm:py-4 flex justify-between items-center bg-gradient-to-r from-primary/[0.06] to-transparent">
              <div className="flex items-center gap-1.5">
                <Zap size={11} className="text-primary"/>
                <span className="text-[10px] sm:text-xs text-primary font-bold">Profit Margin</span>
              </div>
              <span className={`font-mono font-extrabold text-sm sm:text-base ${margin>=0?'text-emerald-500':'text-red-500'}`}>{margin.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * SUB-COMPONENTS  — kept in the same file for colocation
 * ═══════════════════════════════════════════════════════════════ */

/* ── KPI Card ──────────────────────────────────────────────────── */
function KpiCard({ icon:Icon, label, value, sub, accent, badge, valueClass }: {
  icon: any; label: string; value: string; sub: string; accent: string;
  badge?: React.ReactNode; valueClass?: string;
}) {
  const ring: Record<string,string> = {
    emerald: 'from-emerald-500/20 to-emerald-600/10 text-emerald-500 ring-emerald-500/15',
    violet:  'from-violet-500/20 to-purple-600/10 text-violet-500 ring-violet-500/15',
    rose:    'from-rose-500/20 to-red-600/10 text-rose-500 ring-rose-500/15',
    amber:   'from-amber-500/20 to-orange-600/10 text-amber-500 ring-amber-500/15',
    red:     'from-red-500/20 to-red-600/10 text-red-500 ring-red-500/15',
  };
  const glow: Record<string,string> = {
    emerald:'hover:shadow-emerald-500/5 hover:border-emerald-500/15',
    violet:'hover:shadow-violet-500/5 hover:border-violet-500/15',
    rose:'hover:shadow-rose-500/5 hover:border-rose-500/15',
    amber:'hover:shadow-amber-500/5 hover:border-amber-500/15',
    red:'hover:shadow-red-500/5 hover:border-red-500/15',
  };
  const blur: Record<string,string> = {
    emerald:'bg-emerald-500/[0.04] group-hover:bg-emerald-500/[0.08]',
    violet:'bg-violet-500/[0.04] group-hover:bg-violet-500/[0.08]',
    rose:'bg-rose-500/[0.04] group-hover:bg-rose-500/[0.08]',
    amber:'bg-amber-500/[0.04] group-hover:bg-amber-500/[0.08]',
    red:'bg-red-500/[0.04] group-hover:bg-red-500/[0.08]',
  };

  return (
    <div className={`group relative overflow-hidden rounded-2xl border border-border/40 bg-card p-4 sm:p-5 lg:p-6 transition-all duration-300 hover:shadow-lg ${glow[accent]||''}`}>
      <div className={`pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full blur-2xl transition-all duration-500 ${blur[accent]||''}`}/>
      <div className="relative space-y-2.5 sm:space-y-3">
        <div className="flex items-center justify-between">
          <div className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-gradient-to-br ring-1 ${ring[accent]||''}`}>
            <Icon size={16} className="sm:hidden"/><Icon size={18} className="hidden sm:block"/>
          </div>
          {badge}
        </div>
        <div>
          <div className="text-[9px] sm:text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{label}</div>
          <div className={`text-lg sm:text-xl lg:text-2xl font-extrabold font-mono tracking-tight mt-0.5 ${valueClass||'text-foreground'}`}>{value}</div>
        </div>
        <div className="text-[9px] sm:text-[10px] text-muted-foreground leading-tight">{sub}</div>
      </div>
    </div>
  );
}

/* ── Chart Card wrapper ────────────────────────────────────────── */
function ChartCard({ children, className='', icon:Icon, iconColor='text-primary', bgColor='bg-primary/10', title, subtitle, legend, extra }: {
  children: React.ReactNode; className?: string;
  icon: any; iconColor?: string; bgColor?: string; title: string; subtitle: string;
  legend?: React.ReactNode; extra?: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border border-border/40 bg-card overflow-hidden ${className}`}>
      <div className="px-4 sm:px-6 py-4 border-b border-border/40 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${bgColor} ${iconColor}`}><Icon size={12}/></div>
          <div className="min-w-0">
            <h3 className="font-bold text-foreground text-xs sm:text-sm truncate">{title}</h3>
            <p className="text-[9px] sm:text-[10px] text-muted-foreground truncate">{subtitle}</p>
          </div>
        </div>
        {legend && <div className="hidden sm:flex items-center gap-3 text-[9px] sm:text-[10px] text-muted-foreground shrink-0">{legend}</div>}
        {extra}
      </div>
      <div className="p-3 sm:p-5">
        <div className="h-48 sm:h-56 lg:h-64 w-full">{children}</div>
      </div>
    </div>
  );
}

/* ── Tiny helpers ──────────────────────────────────────────────── */
function Dot({ color }: { color: string }) {
  return <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{background:color}}/></span>;
}

function RankBadge({ rank }: { rank: number }) {
  const cls = rank===0 ? 'bg-amber-500/10 text-amber-500 ring-amber-500/15'
    : rank===1 ? 'bg-slate-400/10 text-slate-400 ring-slate-400/15'
    : rank===2 ? 'bg-orange-600/10 text-orange-600 ring-orange-600/15'
    : 'bg-secondary text-muted-foreground ring-border/30';
  return <span className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold ring-1 ${cls}`}>{rank+1}</span>;
}

function StatusPill({ clear, small }: { clear: boolean; small?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-bold ring-1 ${
      small ? 'px-1.5 py-0.5 text-[8px] mt-0.5' : 'px-2 py-0.5 text-[9px] sm:text-[10px]'
    } ${clear ? 'bg-emerald-500/10 text-emerald-500 ring-emerald-500/15' : 'bg-amber-500/10 text-amber-500 ring-amber-500/15'}`}>
      <span className={`h-1 w-1 sm:h-1.5 sm:w-1.5 rounded-full ${clear?'bg-emerald-500':'bg-amber-500'}`}/>
      {clear?'Clear':'Due'}
    </span>
  );
}
