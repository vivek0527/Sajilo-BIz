'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dbClient } from '@/lib/db';
import { Bill, ShopSettings } from '@/lib/types';
import {
  FileText,
  Search,
  Filter,
  Calendar,
  Eye,
  Printer,
  Trash2,
  Loader2,
  AlertTriangle,
  Edit2
} from 'lucide-react';
import Link from 'next/link';

export default function AllBillsPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [tabFilter, setTabFilter] = useState<'all' | 'paid' | 'unpaid'>('all');

  // Queries
  const { data: settings } = useQuery<ShopSettings>({
    queryKey: ['settings'],
    queryFn: dbClient.shopSettings.get,
  });

  const { data: bills = [], isLoading } = useQuery<Bill[]>({
    queryKey: ['bills'],
    queryFn: dbClient.bills.list,
  });

  // Delete Mutation
  const deleteBillMutation = useMutation({
    mutationFn: dbClient.bills.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    }
  });

  const handleDelete = (id: string, num: number) => {
    if (confirm(`Are you sure you want to delete Bill #${num}? This will RESTORE the product inventory quantities and subtract the invoice values from the customer's purchase logs.`)) {
      deleteBillMutation.mutate(id);
    }
  };

  // Filter bills
  const filteredBills = bills.filter(b => {
    const customerName = b.customer?.name || 'Walk-in Customer';
    const matchesSearch = customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(b.bill_number).includes(searchQuery);
    const matchesStatus = statusFilter === '' || b.status === statusFilter;

    let matchesDate = true;
    if (startDate || endDate) {
      const billDateStr = new Date(b.created_at).toISOString().split('T')[0];
      if (startDate && billDateStr < startDate) matchesDate = false;
      if (endDate && billDateStr > endDate) matchesDate = false;
    }

    let matchesTab = true;
    if (tabFilter === 'paid') {
      matchesTab = b.status === 'Paid';
    } else if (tabFilter === 'unpaid') {
      matchesTab = Number(b.pending_amount) > 0;
    }

    return matchesSearch && matchesStatus && matchesDate && matchesTab;
  });

  // Tab counts based on search query and date filters
  const allCount = bills.filter(b => {
    const customerName = b.customer?.name || 'Walk-in Customer';
    const matchesSearch = customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(b.bill_number).includes(searchQuery);
    const matchesStatus = statusFilter === '' || b.status === statusFilter;
    let matchesDate = true;
    if (startDate || endDate) {
      const billDateStr = new Date(b.created_at).toISOString().split('T')[0];
      if (startDate && billDateStr < startDate) matchesDate = false;
      if (endDate && billDateStr > endDate) matchesDate = false;
    }
    return matchesSearch && matchesStatus && matchesDate;
  }).length;

  const paidCount = bills.filter(b => {
    const customerName = b.customer?.name || 'Walk-in Customer';
    const matchesSearch = customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(b.bill_number).includes(searchQuery);
    const matchesStatus = statusFilter === '' || b.status === statusFilter;
    let matchesDate = true;
    if (startDate || endDate) {
      const billDateStr = new Date(b.created_at).toISOString().split('T')[0];
      if (startDate && billDateStr < startDate) matchesDate = false;
      if (endDate && billDateStr > endDate) matchesDate = false;
    }
    return matchesSearch && matchesStatus && matchesDate && b.status === 'Paid';
  }).length;

  const unpaidCount = bills.filter(b => {
    const customerName = b.customer?.name || 'Walk-in Customer';
    const matchesSearch = customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(b.bill_number).includes(searchQuery);
    const matchesStatus = statusFilter === '' || b.status === statusFilter;
    let matchesDate = true;
    if (startDate || endDate) {
      const billDateStr = new Date(b.created_at).toISOString().split('T')[0];
      if (startDate && billDateStr < startDate) matchesDate = false;
      if (endDate && billDateStr > endDate) matchesDate = false;
    }
    return matchesSearch && matchesStatus && matchesDate && Number(b.pending_amount) > 0;
  }).length;

  const getStatusBadge = (status: string) => {
    if (status === 'Paid') return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    if (status === 'Partial') return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    return 'bg-red-500/10 text-red-500 border-red-500/20';
  };

  const currencySymbol = settings?.currency_symbol || '₹';

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <FileText className="text-primary" size={24} /> Invoices Ledger
        </h2>
        <p className="text-sm text-muted-foreground hidden sm:block">
          Audit past bills, check outstanding due payment ledgers, print thermal customer receipts, or void transactions.
        </p>
      </div>

      {/* Filter Options */}
      <div className="flex flex-col gap-4 sm:flex-row">
        {/* Search */}
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
            <Search size={18} />
          </span>
          <input
            type="text"
            placeholder="Search by customer name or bill number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full rounded-xl border border-border bg-card px-10 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none"
          />
        </div>

        {/* Status */}
        <div className="relative min-w-0 sm:min-w-[150px]">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
            <Filter size={14} />
          </span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="block w-full rounded-xl border border-border bg-card pl-9 pr-3 py-2.5 text-sm focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="Paid">Paid</option>
            <option value="Partial">Partial</option>
            <option value="Pending">Pending</option>
          </select>
        </div>

        {/* Start Date */}
        <div className="relative min-w-0 sm:min-w-[150px]">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground text-[10px] uppercase font-bold">
            From
          </span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="block w-full rounded-xl border border-border bg-card pl-12 pr-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono"
          />
        </div>

        {/* End Date */}
        <div className="relative min-w-0 sm:min-w-[150px]">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground text-[10px] uppercase font-bold">
            To
          </span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="block w-full rounded-xl border border-border bg-card pl-9 pr-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono"
          />
        </div>
      </div>

      {/* Tab Switcher Sections */}
      <div className="flex border-b border-border/60 pb-1 gap-6 overflow-x-auto scrollbar-none whitespace-nowrap font-medium">
        <button
          onClick={() => setTabFilter('all')}
          className={`pb-3 text-sm font-semibold relative transition-all ${tabFilter === 'all'
            ? 'text-primary'
            : 'text-muted-foreground hover:text-foreground'
            }`}
        >
          All Invoices
          <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium font-mono text-muted-foreground">
            {allCount}
          </span>
          {tabFilter === 'all' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary animate-in fade-in" />
          )}
        </button>

        <button
          onClick={() => setTabFilter('paid')}
          className={`pb-3 text-sm font-semibold relative transition-all ${tabFilter === 'paid'
            ? 'text-emerald-500'
            : 'text-muted-foreground hover:text-foreground'
            }`}
        >
          Fully Paid
          <span className="ml-2 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 text-xs font-medium font-mono">
            {paidCount}
          </span>
          {tabFilter === 'paid' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 animate-in fade-in" />
          )}
        </button>

        <button
          onClick={() => setTabFilter('unpaid')}
          className={`pb-3 text-sm font-semibold relative transition-all ${tabFilter === 'unpaid'
            ? 'text-red-500'
            : 'text-muted-foreground hover:text-foreground'
            }`}
        >
          Unpaid / Outstanding
          <span className="ml-2 rounded-full bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-0.5 text-xs font-medium font-mono">
            {unpaidCount}
          </span>
          {tabFilter === 'unpaid' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500 animate-in fade-in" />
          )}
        </button>
      </div>

      {/* Invoices List */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="animate-spin text-primary" size={28} />
        </div>
      ) : filteredBills.length === 0 ? (
        <div className="glass-panel flex flex-col items-center justify-center rounded-2xl p-12 text-center">
          <AlertTriangle className="mb-4 text-muted-foreground" size={32} />
          <h3 className="font-semibold text-foreground">No Invoices Found</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Try adjusting your date filters, selection statuses, search inputs, or create a new bill to begin.
          </p>
          <Link
            href="/billing/new"
            className="mt-4 flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-4 py-2 text-xs font-semibold text-primary hover:bg-primary/20"
          >
            Go to Billing Console
          </Link>
        </div>
      ) : (
        <div className="glass-panel overflow-hidden rounded-2xl border border-border shadow-md">
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-secondary/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-4">Bill Number</th>
                  <th className="px-6 py-4">Customer Name</th>
                  <th className="px-6 py-4">Bill Date</th>
                  <th className="px-6 py-4">Total Amount</th>
                  <th className="px-6 py-4">Credit Due</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Contact Info</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm text-foreground">
                {filteredBills.map((b) => (
                  <tr key={b.id} className="hover:bg-secondary/25 transition-all">
                    <td className="px-6 py-4 font-mono font-semibold">Bill #{b.bill_number}</td>
                    <td className="px-6 py-4 font-medium">{b.customer?.name || 'Walk-in Customer'}</td>
                    <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
                      {new Date(b.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4 font-mono font-semibold">{currencySymbol}{Number(b.grand_total).toFixed(2)}</td>
                    <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
                      {Number(b.pending_amount) > 0 ? (
                        <span className="text-red-500 font-semibold">{currencySymbol}{Number(b.pending_amount).toFixed(2)}</span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-lg border px-2.5 py-0.5 text-xs font-medium ${getStatusBadge(b.status)}`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-foreground font-mono">
                      {b.customer?.phone || '-'}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <Link
                        href={`/billing/${b.id}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                        title="View Details"
                      >
                        <Eye size={14} />
                      </Link>
                      <Link
                        href={`/billing/${b.id}/edit`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-primary/20 text-primary hover:bg-primary/10"
                        title="Edit Invoice"
                      >
                        <Edit2 size={14} />
                      </Link>
                      <Link
                        href={`/receipts/${b.id}`}
                        target="_blank"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-foreground/80 hover:bg-secondary"
                        title="Print Receipt"
                      >
                        <Printer size={14} />
                      </Link>
                      <button
                        onClick={() => handleDelete(b.id, b.bill_number)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-destructive/20 text-destructive hover:bg-destructive/10"
                        title="Void Bill"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-border border-t border-border mt-2">
            {filteredBills.map((b) => (
              <div key={b.id} className="p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-sm text-foreground">Bill #{b.bill_number}</span>
                    <span className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[10px] font-medium ${getStatusBadge(b.status)}`}>
                      {b.status}
                    </span>
                  </div>
                  <span className="font-mono font-semibold text-sm text-foreground">{currencySymbol}{Number(b.grand_total).toFixed(2)}</span>
                </div>
                
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{b.customer?.name || 'Walk-in Customer'}</span>
                  <span className="font-mono">
                    {new Date(b.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold text-foreground font-mono">{b.customer?.phone || 'No Contact Info'}</span>
                    {Number(b.pending_amount) > 0 && (
                      <span className="text-[10px] font-semibold text-red-500 font-mono">Due: {currencySymbol}{Number(b.pending_amount).toFixed(2)}</span>
                    )}
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Link
                      href={`/billing/${b.id}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      <Eye size={14} />
                    </Link>
                    <Link
                      href={`/billing/${b.id}/edit`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-primary/20 text-primary hover:bg-primary/10"
                    >
                      <Edit2 size={14} />
                    </Link>
                    <Link
                      href={`/receipts/${b.id}`}
                      target="_blank"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-foreground/80 hover:bg-secondary"
                    >
                      <Printer size={14} />
                    </Link>
                    <button
                      onClick={() => handleDelete(b.id, b.bill_number)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-destructive/20 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
