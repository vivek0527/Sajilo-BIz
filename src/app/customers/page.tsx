'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { dbClient } from '@/lib/db';
import { Customer, Bill, ShopSettings } from '@/lib/types';
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  Loader2,
  History,
  Phone,
  Mail,
  MapPin,
  X,
  ArrowRight,
  TrendingUp,
  CreditCard
} from 'lucide-react';

const customerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional(),
  email: z.string().email('Please enter a valid email').or(z.literal('')),
  address: z.string().optional(),
});
type CustomerFormInput = z.infer<typeof customerSchema>;

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [activeCustomerForHistory, setActiveCustomerForHistory] = useState<Customer | null>(null);

  // Queries
  const { data: settings } = useQuery<ShopSettings>({
    queryKey: ['settings'],
    queryFn: dbClient.shopSettings.get,
  });

  const { data: customers = [], isLoading: custsLoading } = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: dbClient.customers.list,
  });

  const { data: bills = [] } = useQuery<Bill[]>({
    queryKey: ['bills'],
    queryFn: dbClient.bills.list,
    enabled: historyOpen, // only load bills when customer history ledger is open
  });

  // Mutators
  const createCustomerMutation = useMutation({
    mutationFn: (data: CustomerFormInput) => dbClient.customers.create({
      ...data,
      email: data.email || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setModalOpen(false);
    }
  });

  const updateCustomerMutation = useMutation({
    mutationFn: (data: { id: string; input: CustomerFormInput }) =>
      dbClient.customers.update(data.id, {
        ...data.input,
        email: data.input.email || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setModalOpen(false);
      setEditingCustomer(null);
    }
  });

  const deleteCustomerMutation = useMutation({
    mutationFn: dbClient.customers.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    }
  });

  // Form setup
  const form = useForm<CustomerFormInput>({
    resolver: zodResolver(customerSchema),
    defaultValues: { name: '', phone: '', email: '', address: '' }
  });

  const openAddCustomer = () => {
    setEditingCustomer(null);
    form.reset({ name: '', phone: '', email: '', address: '' });
    setModalOpen(true);
  };

  const openEditCustomer = (cust: Customer) => {
    setEditingCustomer(cust);
    form.reset({
      name: cust.name,
      phone: cust.phone || '',
      email: cust.email || '',
      address: cust.address || '',
    });
    setModalOpen(true);
  };

  const openHistory = (cust: Customer) => {
    setActiveCustomerForHistory(cust);
    setHistoryOpen(true);
  };

  const handleSubmit = (data: CustomerFormInput) => {
    if (editingCustomer) {
      updateCustomerMutation.mutate({ id: editingCustomer.id, input: data });
    } else {
      createCustomerMutation.mutate(data);
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete the customer "${name}"? Historical bills will not be deleted, but they will become unaffiliated.`)) {
      deleteCustomerMutation.mutate(id);
    }
  };

  // Filter logic
  const filteredCustomers = customers.filter(c => {
    const query = searchQuery.toLowerCase();
    return c.name.toLowerCase().includes(query) || (c.phone && c.phone.includes(query));
  });

  // Get bills for selected customer in history ledger
  const customerBills = bills.filter(b => b.customer_id === activeCustomerForHistory?.id);

  const currencySymbol = settings?.currency_symbol || '₹';

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Users className="text-primary" size={24} /> Customer Relations
          </h2>
          <p className="text-sm text-muted-foreground hidden sm:block">
            View transaction logs, pending balances, and manage profile contacts.
          </p>
        </div>

        <div>
          <button
            onClick={openAddCustomer}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/95 transition-all"
          >
            <Plus size={16} /> Add Customer
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
          <Search size={18} />
        </span>
        <input
          type="text"
          placeholder="Search customers by name or phone number..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="block w-full rounded-xl border border-border bg-card px-10 py-2.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
      </div>

      {/* Customer Listing */}
      {custsLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="animate-spin text-primary" size={28} />
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="glass-panel flex flex-col items-center justify-center rounded-2xl p-12 text-center">
          <Users className="mb-4 text-muted-foreground" size={32} />
          <h3 className="font-semibold text-foreground">No Customers Registered</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Add customers to link them with invoices, offer credit, and track purchase ledgers.
          </p>
          <button
            onClick={openAddCustomer}
            className="mt-4 flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-4 py-2 text-xs font-semibold text-primary hover:bg-primary/20"
          >
            <Plus size={12} /> Add Customer
          </button>
        </div>
      ) : (
        <div className="glass-panel overflow-hidden rounded-2xl border border-border shadow-md">
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-secondary/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-4">Customer Details</th>
                  <th className="px-6 py-4">Contact Info</th>
                  <th className="px-6 py-4">Total Purchases</th>
                  <th className="px-6 py-4">Outstanding Credit</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm text-foreground">
                {filteredCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-secondary/25 transition-all">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold">{c.name}</span>
                        {c.address && (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <MapPin size={10} /> {c.address}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                        {c.phone && (
                          <span className="inline-flex items-center gap-1.5 font-mono">
                            <Phone size={12} className="text-primary" /> {c.phone}
                          </span>
                        )}
                        {c.email && (
                          <span className="inline-flex items-center gap-1.5">
                            <Mail size={12} className="text-primary" /> {c.email}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 font-mono font-semibold text-emerald-500">
                        <TrendingUp size={14} />
                        {currencySymbol}{Number(c.total_purchases).toFixed(2)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-xs font-medium font-mono ${
                          Number(c.total_pending) > 0
                            ? 'bg-red-500/10 text-red-500 border-red-500/20'
                            : 'bg-secondary text-muted-foreground border-border'
                        }`}
                      >
                        <CreditCard size={12} />
                        {currencySymbol}{Number(c.total_pending).toFixed(2)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => openHistory(c)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-primary hover:bg-primary/10"
                        title="View Ledger Ledger"
                      >
                        <History size={14} />
                      </button>
                      <button
                        onClick={() => openEditCustomer(c)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                        title="Edit Customer"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(c.id, c.name)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-destructive/20 text-destructive hover:bg-destructive/10"
                        title="Delete Customer"
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
          <div className="md:hidden divide-y divide-border">
            {filteredCustomers.map((c) => (
              <div key={c.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm">{c.name}</div>
                    <div className="flex flex-col gap-0.5 text-xs text-muted-foreground mt-0.5">
                      {c.phone && (
                        <span className="inline-flex items-center gap-1 font-mono">
                          <Phone size={10} className="text-primary" /> {c.phone}
                        </span>
                      )}
                      {c.address && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={10} /> {c.address}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => openHistory(c)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border text-primary hover:bg-primary/10"
                    >
                      <History size={12} />
                    </button>
                    <button
                      onClick={() => openEditCustomer(c)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={() => handleDelete(c.id, c.name)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-destructive/20 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1 font-mono font-semibold text-emerald-500">
                    <TrendingUp size={12} />
                    {currencySymbol}{Number(c.total_purchases).toFixed(2)}
                  </div>
                  {Number(c.total_pending) > 0 && (
                    <div className="inline-flex items-center gap-1 rounded-lg border bg-red-500/10 text-red-500 border-red-500/20 px-1.5 py-0.5 font-mono font-medium">
                      <CreditCard size={10} />
                      Due: {currencySymbol}{Number(c.total_pending).toFixed(2)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CUSTOMER FORM MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            >
              <X size={18} />
            </button>
            <h3 className="text-lg font-bold text-foreground">
              {editingCustomer ? 'Edit Customer Profile' : 'Add New Customer'}
            </h3>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 mt-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Customer Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Sharma"
                  {...form.register('name')}
                  className="block w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Phone Number</label>
                <input
                  type="text"
                  placeholder="e.g. 9876543210"
                  {...form.register('phone')}
                  className="block w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm focus:border-primary focus:outline-none font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. ramesh@example.com"
                  {...form.register('email')}
                  className="block w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
                {form.formState.errors.email && (
                  <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Billing Address</label>
                <textarea
                  placeholder="Street, City, Zip Code"
                  rows={2}
                  {...form.register('address')}
                  className="block w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-border mt-6">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createCustomerMutation.isPending || updateCustomerMutation.isPending}
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5"
                >
                  {(createCustomerMutation.isPending || updateCustomerMutation.isPending) && (
                    <Loader2 className="animate-spin" size={12} />
                  )}
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TRANSACTION HISTORY LEDGER SLIDE-OUT PANEL */}
      {historyOpen && activeCustomerForHistory && (
        <div className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-lg h-full p-6 shadow-2xl relative flex flex-col justify-between animate-in slide-in-from-right duration-300">
            <div>
              <button
                onClick={() => setHistoryOpen(false)}
                className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
              >
                <X size={20} />
              </button>
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2 border-b border-border pb-4">
                <History size={20} className="text-primary" /> Purchase Ledger: {activeCustomerForHistory.name}
              </h3>

              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="bg-secondary/40 rounded-xl p-3 border border-border/50">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground">Total Paid Ledger</span>
                  <div className="text-lg font-bold text-emerald-500 font-mono mt-1">
                    {currencySymbol}{Number(activeCustomerForHistory.total_purchases).toFixed(2)}
                  </div>
                </div>
                <div className="bg-secondary/40 rounded-xl p-3 border border-border/50">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground">Outstanding Pending Credit</span>
                  <div className="text-lg font-bold text-red-500 font-mono mt-1">
                    {currencySymbol}{Number(activeCustomerForHistory.total_pending).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Bills List */}
              <div className="mt-8 space-y-4 overflow-y-auto max-h-[60vh] pr-1">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Invoices Ledger</h4>
                {customerBills.length === 0 ? (
                  <div className="text-center py-12 text-sm text-muted-foreground border-2 border-dashed border-border rounded-2xl">
                    No transactions found for this customer.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {customerBills.map((b) => (
                      <div
                        key={b.id}
                        className="flex items-center justify-between p-4 rounded-xl border border-border bg-card/50 hover:bg-secondary/20 transition-all"
                      >
                        <div>
                          <div className="font-semibold text-sm">Bill #{b.bill_number}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {new Date(b.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="font-semibold font-mono text-sm">
                              {currencySymbol}{Number(b.grand_total).toFixed(2)}
                            </div>
                            <span
                              className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium mt-1 ${
                                b.status === 'Paid'
                                  ? 'bg-emerald-500/10 text-emerald-500'
                                  : b.status === 'Partial'
                                  ? 'bg-amber-500/10 text-amber-500'
                                  : 'bg-red-500/10 text-red-500'
                              }`}
                            >
                              {b.status}
                            </span>
                          </div>

                          <a
                            href={`/billing/${b.id}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                          >
                            <ArrowRight size={14} />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-border pt-4 flex justify-end">
              <button
                onClick={() => setHistoryOpen(false)}
                className="rounded-xl border border-border px-5 py-2 text-xs font-semibold hover:bg-secondary"
              >
                Close Ledger
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
