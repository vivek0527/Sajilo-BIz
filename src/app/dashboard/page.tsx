'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dbClient } from '@/lib/db';
import { useUIStore } from '@/lib/store';
import { Bill, Product, Expense, ShopSettings } from '@/lib/types';
import {
  TrendingUp,
  Receipt,
  AlertTriangle,
  CreditCard,
  ArrowRight,
  Package,
  Plus,
  Settings,
  Users,
  Loader2,
  DollarSign,
  TrendingDown,
  Sparkles,
  Edit2,
  Clock,
  Calendar
} from 'lucide-react';
import Link from 'next/link';
// @ts-ignore
import NepaliDate from 'nepali-date-converter';
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
  Legend
} from 'recharts';

const CalendarCard = ({ date }: { date: Date }) => {
  // @ts-ignore
  const nepaliDate = new NepaliDate(date);
  const day = String(nepaliDate.getDate()).padStart(2, '0');
  const month = nepaliDate.format('MMMM').toUpperCase();

  return (
    <div className="relative h-[76px] w-[64px] rounded-xl bg-gradient-to-b from-[#242426] via-[#1c1c1e] to-[#121213] border border-neutral-800 shadow-2xl flex flex-col overflow-hidden select-none animate-calendar-float">
      {/* Red Calendar Header */}
      <div className="h-[22px] bg-gradient-to-r from-red-600 to-red-500 flex items-center justify-center border-b border-neutral-900/40 px-1">
        <span className="text-[9px] font-black text-white tracking-wider truncate">{month}</span>
      </div>

      {/* Body: Day number */}
      <div className="flex-1 flex items-center justify-center bg-transparent relative">
        <span className="text-2xl sm:text-[28px] font-black text-neutral-200 tracking-tight leading-none pt-0.5">{day}</span>
      </div>
    </div>
  );
};

const FlipCard = ({ value, label, size = 'large', shouldFlip = true }: { value: string; label?: string; size?: 'large' | 'small'; shouldFlip?: boolean }) => {
  const [prevValue, setPrevValue] = useState(value);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (value !== prevValue) {
      if (shouldFlip) {
        setAnimate(true);
        const timer = setTimeout(() => {
          setAnimate(false);
          setPrevValue(value);
        }, 500);
        return () => clearTimeout(timer);
      } else {
        setPrevValue(value);
      }
    }
  }, [value, prevValue, shouldFlip]);

  const isLarge = size === 'large';
  const cardClass = isLarge
    ? "relative h-[76px] w-[64px] rounded-xl bg-gradient-to-b from-[#242426] via-[#1c1c1e] to-[#121213] border border-neutral-800 shadow-2xl flex flex-col items-center justify-center overflow-hidden"
    : "relative h-[52px] w-[44px] rounded-lg bg-gradient-to-b from-[#242426] via-[#1c1c1e] to-[#121213] border border-neutral-800 shadow-md flex flex-col items-center justify-center overflow-hidden self-end mb-[2px]";
  const textClass = isLarge
    ? "text-2xl sm:text-[28px] font-black text-neutral-200 tracking-tight"
    : "text-lg font-black text-neutral-400 tracking-tight";

  return (
    <div className={`${cardClass} ${animate ? 'animate-flip-active' : ''}`}>
      {/* Highlights */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.04] to-transparent pointer-events-none" />

      {/* Display Value */}
      <span className={textClass}>{value}</span>

      {/* Label (like AM/PM) */}
      {label && (
        <span className="absolute bottom-1.5 left-2 text-[9px] font-bold text-neutral-500 tracking-wider uppercase">
          {label}
        </span>
      )}
    </div>
  );
};

export default function DashboardPage() {
  const [currentTime, setCurrentTime] = useState(new Date());

  const hours = currentTime.getHours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = String(hours % 12 || 12).padStart(2, '0');
  const displayMinutes = String(currentTime.getMinutes()).padStart(2, '0');
  const displaySeconds = String(currentTime.getSeconds()).padStart(2, '0');

  // @ts-ignore
  const nepaliDate = new NepaliDate(currentTime);
  const bsYear = nepaliDate.format('YYYY');
  const bsWeekday = nepaliDate.format('dddd');

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const { user } = useUIStore();
  const getOwnerName = () => {
    if (user?.shop_name) return user.shop_name;
    if (user?.email) return user.email.split('@')[0];
    return 'Partner';
  };

  // Queries
  const { data: settings } = useQuery<ShopSettings>({
    queryKey: ['settings'],
    queryFn: dbClient.shopSettings.get,
  });

  const { data: bills = [], isLoading: billsLoading } = useQuery<Bill[]>({
    queryKey: ['bills'],
    queryFn: dbClient.bills.list,
  });

  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
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

  const isLoading = billsLoading || productsLoading || expensesLoading;

  const currencySymbol = settings?.currency_symbol || '₹';

  // 1. Calculations for Today's Stats
  const today = new Date().toISOString().split('T')[0];

  const todayBills = bills.filter(b => b.created_at.startsWith(today));
  const todayRevenue = todayBills.reduce((sum, b) => sum + Number(b.grand_total), 0);
  const todayTransactions = todayBills.length;

  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartStr = monthStart.toISOString().split('T')[0];

  const monthlyExpenses = expenses
    .filter(e => e.date >= monthStartStr)
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const lowStockProducts = products.filter(p => Number(p.stock_quantity) <= (p.low_stock_threshold !== undefined ? Number(p.low_stock_threshold) : 5));
  const lowStockCount = lowStockProducts.length;

  // 2. Chart 1: 7-Day Revenue Trend
  const getSevenDayData = () => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayBills = bills.filter(b => b.created_at.startsWith(dateStr));
      const revenue = dayBills.reduce((sum, b) => sum + Number(b.grand_total), 0);

      data.push({
        name: date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }),
        Revenue: Number(revenue.toFixed(2)),
      });
    }
    return data;
  };

  // 3. Chart 2: Expenses by Category
  const getExpenseCategoryData = () => {
    const categoriesMap: { [key: string]: number } = {};
    expenses.forEach(e => {
      categoriesMap[e.category] = (categoriesMap[e.category] || 0) + Number(e.amount);
    });

    return Object.keys(categoriesMap).map(cat => ({
      name: cat,
      Amount: Number(categoriesMap[cat].toFixed(2)),
    }));
  };

  const salesTrendData = getSevenDayData();
  const expenseCategoryData = getExpenseCategoryData();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  // Check if shop is brand new/empty
  const isShopNew = products.length === 0 && bills.length === 0;

  return (
    <div className="space-y-4 sm:space-y-6 md:space-y-8">
      {/* Onboarding Welcome Banner */}
      {isShopNew && (
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 to-violet-500/10 p-6 md:p-8 shadow-md">
          <div className="absolute top-0 right-0 h-40 w-40 rounded-full bg-primary/5 blur-2xl" />
          <div className="space-y-4">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/25 border border-primary/30 px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles size={12} /> Onboarding checklist
            </div>
            <h2 className="text-xl font-bold text-foreground sm:text-2xl">Welcome to your new workspace!</h2>
            <p className="text-sm text-muted-foreground max-w-xl">
              Let's set up your Saral Biz shop-management console. Perform these three simple steps to start billing.
            </p>
            <div className="grid gap-4 sm:grid-cols-3 pt-2">
              <Link
                href="/settings"
                className="flex items-center gap-3 rounded-xl bg-card border border-border/80 p-4 hover:shadow-md transition-all group"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                  <Settings size={18} />
                </div>
                <div>
                  <div className="font-semibold text-sm">1. Configure Profile</div>
                  <div className="text-[10px] text-muted-foreground">Currency & default taxes</div>
                </div>
              </Link>
              <Link
                href="/inventory"
                className="flex items-center gap-3 rounded-xl bg-card border border-border/80 p-4 hover:shadow-md transition-all group"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                  <Package size={18} />
                </div>
                <div>
                  <div className="font-semibold text-sm">2. Create Products</div>
                  <div className="text-[10px] text-muted-foreground">Add stock & retail prices</div>
                </div>
              </Link>
              <Link
                href="/billing/new"
                className="flex items-center gap-3 rounded-xl bg-card border border-border/80 p-4 hover:shadow-md transition-all group"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                  <Receipt size={18} />
                </div>
                <div>
                  <div className="font-semibold text-sm">3. Checkout first Bill</div>
                  <div className="text-[10px] text-muted-foreground">Generate printable invoice</div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      )}      {/* Regular Welcome Back Banner */}
      {!isShopNew && (
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/30 backdrop-blur-xl p-6 md:p-8 shadow-sm flex flex-col md:flex-row gap-6 md:items-center justify-between glass-panel mb-6">
          <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-primary/5 blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-3">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
              Welcome back, {getOwnerName()}!
            </h2>
            <div className="flex flex-wrap items-center gap-4 mt-2">
              <style>{`
                @keyframes calendar-float {
                  0%, 100% { transform: translateY(0) rotate(0deg); }
                  50% { transform: translateY(-2.5px) rotate(3deg); }
                }
                .animate-calendar-float {
                  animation: calendar-float 3s ease-in-out infinite;
                }
                @keyframes flip-card-effect {
                  0% { transform: scaleY(1); filter: brightness(1); }
                  50% { transform: scaleY(0); filter: brightness(0.4); }
                  100% { transform: scaleY(1); filter: brightness(1); }
                }
                .animate-flip-active {
                  animation: flip-card-effect 0.4s ease-in-out;
                }
              `}</style>

              {/* Desk Calendar Widget */}
              <div className="flex items-center gap-2.5">
                <CalendarCard date={currentTime} />
                <div className="flex flex-col justify-center text-left leading-none gap-1.5">
                  <span className="text-sm font-black text-foreground uppercase tracking-wider">
                    {bsWeekday}
                  </span>
                  <span className="text-xs font-bold text-muted-foreground tracking-widest">
                    {bsYear} BS
                  </span>
                </div>
              </div>

              {/* Vertical divider on larger screens */}
              <div className="hidden sm:block h-12 w-[1px] bg-border/40 mx-2" />

              {/* Retro Flip Clock Widget */}
              <div className="flex items-center gap-1.5 font-mono select-none">
                <FlipCard value={displayHours} label={ampm} />
                <span className="text-neutral-500/80 text-2xl font-bold px-0.5 animate-pulse">:</span>
                <FlipCard value={displayMinutes} />
                <span className="text-neutral-500/80 text-2xl font-bold px-0.5 animate-pulse">:</span>
                <FlipCard value={displaySeconds} size="small" shouldFlip={false} />
              </div>
            </div>
          </div>

          <div className="relative z-10 flex flex-wrap gap-4 mt-2 md:mt-0">
            <Link
              href="/billing/new"
              className="group relative inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-violet-600 px-6 text-sm font-bold text-white transition-all hover:scale-105 hover:shadow-[0_0_20px_rgba(139,92,246,0.4)] focus:outline-none border border-white/10"
            >
              <Plus size={16} className="transition-transform group-hover:rotate-90" /> New Invoice
            </Link>
            <Link
              href="/inventory"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-secondary/80 px-6 text-sm font-bold text-foreground border border-border/80 transition-all hover:bg-secondary hover:scale-105 backdrop-blur-md shadow-sm"
            >
              <Package size={16} /> Add Product
            </Link>
          </div>
        </div>
      )}

      {/* STATS METRIC GRID */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {/* Today's revenue */}
        <div className="relative overflow-hidden glass-panel rounded-2xl p-4 sm:p-6 flex justify-between items-start border border-border/60 transition-all hover:shadow-lg hover:-translate-y-1">
          <div className="absolute top-0 right-0 h-32 w-32 rounded-full bg-emerald-500/5 blur-2xl pointer-events-none" />
          <div className="relative z-10 space-y-1.5">
            <span className="text-[10px] sm:text-xs text-muted-foreground font-bold uppercase tracking-widest">Today's Revenue</span>
            <div className="text-xl sm:text-3xl font-extrabold font-mono text-foreground tracking-tight drop-shadow-sm">
              {currencySymbol}{todayRevenue.toFixed(2)}
            </div>
            <p className="text-[10px] text-emerald-500 font-medium hidden sm:block">Sum of invoice totals today</p>
          </div>
          <div className="relative z-10 hidden sm:flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-inner">
            <TrendingUp size={24} />
          </div>
        </div>

        {/* Transactions */}
        <div className="relative overflow-hidden glass-panel rounded-2xl p-4 sm:p-6 flex justify-between items-start border border-border/60 transition-all hover:shadow-lg hover:-translate-y-1">
          <div className="absolute top-0 right-0 h-32 w-32 rounded-full bg-primary/5 blur-2xl pointer-events-none" />
          <div className="relative z-10 space-y-1.5">
            <span className="text-[10px] sm:text-xs text-muted-foreground font-bold uppercase tracking-widest">Transactions</span>
            <div className="text-xl sm:text-3xl font-extrabold font-mono text-foreground tracking-tight drop-shadow-sm">
              {todayTransactions}
            </div>
            <p className="text-[10px] text-primary font-medium hidden sm:block">Invoices generated today</p>
          </div>
          <div className="relative z-10 hidden sm:flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-inner">
            <Receipt size={24} />
          </div>
        </div>

        {/* Monthly Outflow */}
        <div className="relative overflow-hidden glass-panel rounded-2xl p-4 sm:p-6 flex justify-between items-start border border-border/60 transition-all hover:shadow-lg hover:-translate-y-1">
          <div className="absolute top-0 right-0 h-32 w-32 rounded-full bg-destructive/5 blur-2xl pointer-events-none" />
          <div className="relative z-10 space-y-1.5">
            <span className="text-[10px] sm:text-xs text-muted-foreground font-bold uppercase tracking-widest">Monthly Outflow</span>
            <div className="text-xl sm:text-3xl font-extrabold font-mono text-foreground tracking-tight drop-shadow-sm">
              {currencySymbol}{monthlyExpenses.toFixed(2)}
            </div>
            <p className="text-[10px] text-destructive font-medium hidden sm:block">Logged this month</p>
          </div>
          <div className="relative z-10 hidden sm:flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive border border-destructive/20 shadow-inner">
            <TrendingDown size={24} />
          </div>
        </div>

        {/* Low stock Alert */}
        <div className="relative overflow-hidden glass-panel rounded-2xl p-4 sm:p-6 flex justify-between items-start border border-border/60 transition-all hover:shadow-lg hover:-translate-y-1">
          <div className="absolute top-0 right-0 h-32 w-32 rounded-full bg-amber-500/5 blur-2xl pointer-events-none" />
          <div className="relative z-10 space-y-1.5">
            <span className="text-[10px] sm:text-xs text-muted-foreground font-bold uppercase tracking-widest">Low Stock Alerts</span>
            <div className={`text-xl sm:text-3xl font-extrabold font-mono tracking-tight drop-shadow-sm ${lowStockCount > 0 ? 'text-amber-500' : 'text-foreground'}`}>
              {lowStockCount}
            </div>
            <p className={`text-[10px] font-medium hidden sm:block ${lowStockCount > 0 ? 'text-amber-500 animate-pulse' : 'text-muted-foreground'}`}>
              Products below thresholds
            </p>
          </div>
          <div className={`relative z-10 hidden sm:flex h-12 w-12 items-center justify-center rounded-2xl border shadow-inner ${lowStockCount > 0
            ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
            : 'bg-secondary text-muted-foreground border-border'
            }`}>
            <AlertTriangle size={24} />
          </div>
        </div>
      </div>

      {/* CHARTS CONTAINER (Glow Grid) */}
      {!isShopNew && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Chart 1: Sales Trend */}
          <div className="relative overflow-hidden glass-panel rounded-2xl p-6 space-y-4 border border-border/60">
            <div className="absolute top-0 right-0 h-full w-1/2 bg-gradient-to-l from-emerald-500/5 to-transparent pointer-events-none" />
            <div className="relative z-10">
              <h3 className="font-bold text-foreground text-sm uppercase tracking-wider flex items-center gap-2">
                <TrendingUp size={16} className="text-emerald-500" /> 7-Day Sales Trend
              </h3>
              <p className="text-[11px] text-muted-foreground mt-1">Gross invoice values generated per day</p>
            </div>
            <div className="relative z-10 h-48 sm:h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="rgba(255, 255, 255, 0.08)" />
                  <XAxis dataKey="name" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} dx={-10} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.9)',
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      color: '#ffffff',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
                    }}
                    itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="Revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Expenses by Category */}
          <div className="relative overflow-hidden glass-panel rounded-2xl p-6 space-y-4 border border-border/60">
            <div className="absolute top-0 right-0 h-full w-1/2 bg-gradient-to-l from-destructive/5 to-transparent pointer-events-none" />
            <div className="relative z-10">
              <h3 className="font-bold text-foreground text-sm uppercase tracking-wider flex items-center gap-2">
                <TrendingDown size={16} className="text-destructive" /> Category Expenses
              </h3>
              <p className="text-[11px] text-muted-foreground mt-1">Distribution of outgoing cash flow</p>
            </div>
            <div className="relative z-10 h-48 sm:h-64 w-full">
              {expenseCategoryData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground border border-dashed border-border/50 rounded-xl bg-secondary/20">
                  Log operational expenses to populate metrics.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={expenseCategoryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0.2} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="rgba(255, 255, 255, 0.08)" />
                    <XAxis dataKey="name" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                    <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} dx={-10} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '12px',
                        color: '#ffffff',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
                      }}
                      itemStyle={{ color: '#ef4444', fontWeight: 'bold' }}
                      cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                    />
                    <Bar dataKey="Amount" fill="url(#colorExpense)" radius={[6, 6, 0, 0]} barSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {/* RECENT INVOICES & LOW STOCK GRID */}
      {!isShopNew && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Recent Bills (Col Span 2) */}
          <div className="glass-panel rounded-2xl border border-border/60 overflow-hidden lg:col-span-2 shadow-sm transition-all hover:shadow-md">
            <div className="bg-secondary/20 px-6 py-5 border-b border-border/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                  <Receipt size={16} />
                </div>
                <h3 className="font-bold text-foreground text-sm uppercase tracking-wider">
                  Recent Transactions
                </h3>
              </div>
              <Link href="/billing/all" className="inline-flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-full transition-colors">
                View Ledger <ArrowRight size={12} />
              </Link>
            </div>
            {bills.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No invoices logged. Open the billing console to checkout.
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="overflow-x-auto hidden sm:block">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border/50 bg-secondary/5 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
                        <th className="px-6 py-4">Bill No.</th>
                        <th className="px-6 py-4">Customer</th>
                        <th className="px-6 py-4">Grand Total</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">View</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bills.slice(0, 5).map((b) => (
                        <tr key={b.id} className="hover:bg-secondary/30 border-b border-border/30 transition-all group">
                          <td className="px-6 py-4 font-mono font-bold text-foreground/90 group-hover:text-primary transition-colors">Bill #{b.bill_number}</td>
                          <td className="px-6 py-4 font-medium">{b.customer?.name || 'Guest Client'}</td>
                          <td className="px-6 py-4 font-mono font-bold text-emerald-500">{currencySymbol}{Number(b.grand_total).toFixed(2)}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${b.status === 'Paid'
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : b.status === 'Partial'
                                ? 'bg-amber-500/10 text-amber-500'
                                : 'bg-red-500/10 text-red-500'
                              }`}>
                              {b.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right space-x-2">
                            <Link
                              href={`/billing/${b.id}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/50 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                              title="View Details"
                            >
                              <ArrowRight size={14} />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="sm:hidden divide-y divide-border/50">
                  {bills.slice(0, 5).map((b) => (
                    <div key={b.id} className="px-4 py-3 flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-sm">#{b.bill_number}</span>
                          <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${b.status === 'Paid'
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : b.status === 'Partial'
                              ? 'bg-amber-500/10 text-amber-500'
                              : 'bg-red-500/10 text-red-500'
                            }`}>
                            {b.status}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{b.customer?.name || 'Guest Client'}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-sm">{currencySymbol}{Number(b.grand_total).toFixed(2)}</span>
                        <Link
                          href={`/billing/${b.id}`}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                        >
                          <ArrowRight size={12} />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Low Stock Panel */}
          <div className="glass-panel rounded-2xl border border-border/60 overflow-hidden shadow-sm transition-all hover:shadow-md">
            <div className="bg-secondary/20 px-6 py-5 border-b border-border/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  <AlertTriangle size={16} />
                </div>
                <h3 className="font-bold text-foreground text-sm uppercase tracking-wider">
                  Low Stock Warning
                </h3>
              </div>
              <Link href="/inventory" className="inline-flex items-center gap-1 text-xs font-semibold text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 rounded-full transition-colors">
                Reorder <ArrowRight size={12} />
              </Link>
            </div>
            {lowStockProducts.length === 0 ? (
              <div className="p-12 text-center text-sm text-muted-foreground flex flex-col items-center justify-center h-[200px]">
                <Package className="text-emerald-500 mb-3" size={28} />
                <span className="font-medium">All products are sufficiently stocked!</span>
              </div>
            ) : (
              <div className="divide-y divide-border/50 max-h-[300px] overflow-y-auto">
                {lowStockProducts.slice(0, 8).map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-6 py-4 hover:bg-secondary/30 transition-all group">
                    <div>
                      <div className="font-bold text-sm text-foreground/90 group-hover:text-primary transition-colors">{p.name}</div>
                      <span className="text-[10px] text-muted-foreground font-mono">Unit: {p.unit}</span>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center font-mono font-bold text-xs px-2.5 py-1 rounded-md ${Number(p.stock_quantity) === 0
                        ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                        : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                        }`}>
                        Qty: {p.stock_quantity}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
