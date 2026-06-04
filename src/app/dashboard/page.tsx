'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { dbClient } from '@/lib/db';
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
  Edit2
} from 'lucide-react';
import Link from 'next/link';
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

export default function DashboardPage() {
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
              Let's set up your Sajilo Biz shop-management console. Perform these three simple steps to start billing.
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
      )}

      {/* STATS METRIC GRID */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {/* Today's revenue */}
        <div className="glass-panel rounded-2xl p-4 sm:p-6 flex justify-between items-start border border-border/60">
          <div className="space-y-2">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Today's Revenue</span>
            <div className="text-lg sm:text-2xl font-bold font-mono text-foreground">
              {currencySymbol}{todayRevenue.toFixed(2)}
            </div>
            <p className="text-[10px] text-muted-foreground hidden sm:block">Sum of invoice totals today</p>
          </div>
          <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <TrendingUp size={20} />
          </div>
        </div>

        {/* Transactions */}
        <div className="glass-panel rounded-2xl p-4 sm:p-6 flex justify-between items-start border border-border/60">
          <div className="space-y-2">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Transactions</span>
            <div className="text-lg sm:text-2xl font-bold font-mono text-foreground">
              {todayTransactions}
            </div>
            <p className="text-[10px] text-muted-foreground hidden sm:block">Invoices generated today</p>
          </div>
          <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Receipt size={20} />
          </div>
        </div>

        {/* Monthly Outflow */}
        <div className="glass-panel rounded-2xl p-4 sm:p-6 flex justify-between items-start border border-border/60">
          <div className="space-y-2">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Monthly Outflow</span>
            <div className="text-lg sm:text-2xl font-bold font-mono text-foreground">
              {currencySymbol}{monthlyExpenses.toFixed(2)}
            </div>
            <p className="text-[10px] text-muted-foreground hidden sm:block">Operational expenses logged this month</p>
          </div>
          <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive border border-destructive/20">
            <TrendingDown size={20} />
          </div>
        </div>

        {/* Low stock Alert */}
        <div className="glass-panel rounded-2xl p-4 sm:p-6 flex justify-between items-start border border-border/60">
          <div className="space-y-2">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Low Stock Alerts</span>
            <div className={`text-lg sm:text-2xl font-bold font-mono ${lowStockCount > 0 ? 'text-amber-500' : 'text-foreground'}`}>
              {lowStockCount}
            </div>
            <p className="text-[10px] text-muted-foreground hidden sm:block">Products below alert thresholds</p>
          </div>
          <div className={`hidden sm:flex h-10 w-10 items-center justify-center rounded-xl border ${lowStockCount > 0
              ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse'
              : 'bg-secondary text-muted-foreground border-border'
            }`}>
            <AlertTriangle size={20} />
          </div>
        </div>
      </div>

      {/* CHARTS CONTAINER (Glow Grid) */}
      {!isShopNew && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Chart 1: Sales Trend */}
          <div className="glass-panel rounded-2xl p-6 space-y-4">
            <div>
              <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider">7-Day Sales Trend</h3>
              <p className="text-xs text-muted-foreground">Gross invoice values generated per day</p>
            </div>
            <div className="h-48 sm:h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.05)" />
                  <XAxis dataKey="name" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(30, 41, 59, 0.9)',
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '0.75rem',
                      color: '#ffffff'
                    }}
                  />
                  <Area type="monotone" dataKey="Revenue" stroke="var(--primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Expenses by Category */}
          <div className="glass-panel rounded-2xl p-6 space-y-4">
            <div>
              <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider">Category Expenses</h3>
              <p className="text-xs text-muted-foreground">Distribution of outgoing cash flow</p>
            </div>
            <div className="h-48 sm:h-64 w-full">
              {expenseCategoryData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                  Log operational expenses to populate metrics.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={expenseCategoryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.05)" />
                    <XAxis dataKey="name" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(30, 41, 59, 0.9)',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '0.75rem',
                        color: '#ffffff'
                      }}
                    />
                    <Bar dataKey="Amount" fill="var(--primary)" radius={[4, 4, 0, 0]} barSize={32} />
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
          <div className="glass-panel rounded-2xl border border-border overflow-hidden lg:col-span-2 shadow-md">
            <div className="bg-secondary/40 px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider flex items-center gap-1.5">
                <Receipt size={16} className="text-primary" /> Recent Transactions
              </h3>
              <Link href="/billing/all" className="text-xs text-primary font-semibold hover:underline flex items-center gap-0.5">
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
                      <tr className="border-b border-border bg-secondary/10 text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">
                        <th className="px-6 py-3">Bill No.</th>
                        <th className="px-6 py-3">Customer</th>
                        <th className="px-6 py-3">Grand Total</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3 text-right">View</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bills.slice(0, 5).map((b) => (
                        <tr key={b.id} className="hover:bg-secondary/20 border-b border-border/50 transition-all">
                          <td className="px-6 py-4 font-mono font-semibold">Bill #{b.bill_number}</td>
                          <td className="px-6 py-4">{b.customer?.name || 'Guest Client'}</td>
                          <td className="px-6 py-4 font-mono font-semibold">{currencySymbol}{Number(b.grand_total).toFixed(2)}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${b.status === 'Paid'
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
                              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                              title="View Details"
                            >
                              <ArrowRight size={12} />
                            </Link>
                            <Link
                              href={`/billing/${b.id}/edit`}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-primary/20 text-primary hover:bg-primary/10"
                              title="Edit Invoice"
                            >
                              <Edit2 size={12} />
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
          <div className="glass-panel rounded-2xl border border-border overflow-hidden shadow-md">
            <div className="bg-secondary/40 px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle size={16} className="text-amber-500" /> Low Stock Warning
              </h3>
              <Link href="/inventory" className="text-xs text-primary font-semibold hover:underline">
                Reorder
              </Link>
            </div>
            {lowStockProducts.length === 0 ? (
              <div className="p-12 text-center text-sm text-muted-foreground flex flex-col items-center justify-center h-[200px]">
                <Package className="text-emerald-500 mb-2" size={24} />
                <span>All products are sufficiently stocked!</span>
              </div>
            ) : (
              <div className="divide-y divide-border/50 max-h-[300px] overflow-y-auto">
                {lowStockProducts.slice(0, 8).map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-6 py-3.5 hover:bg-secondary/15 transition-all">
                    <div>
                      <div className="font-semibold text-sm">{p.name}</div>
                      <span className="text-[10px] text-muted-foreground font-mono">Unit: {p.unit}</span>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block font-mono font-bold text-xs px-2 py-0.5 rounded ${Number(p.stock_quantity) === 0
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
