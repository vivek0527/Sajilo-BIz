'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { dbClient } from '@/lib/db';
import { Expense, ShopSettings } from '@/lib/types';
import {
  TrendingDown,
  Plus,
  Calendar,
  Search,
  Filter,
  Edit2,
  Trash2,
  Loader2,
  AlertTriangle,
  CreditCard,
  DollarSign,
  X
} from 'lucide-react';

const expenseSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters'),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Please enter a valid date (YYYY-MM-DD)'),
  category: z.string().min(1, 'Category is required'),
  description: z.string().optional(),
});
type ExpenseFormInput = z.infer<typeof expenseSchema>;

const EXPENSE_CATEGORIES = [
  'Inventory',
  'Utilities',
  'Rent',
  'Salaries',
  'Stock Purchases',
  'Marketing',
  'Maintenance',
  'Taxes',
  'Others'
];

export default function ExpensesPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedDate, setSelectedDate] = useState('');

  // Modals state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Queries
  const { data: settings } = useQuery<ShopSettings>({
    queryKey: ['settings'],
    queryFn: dbClient.shopSettings.get,
  });

  const { data: expenses = [], isLoading: expensesLoading } = useQuery<Expense[]>({
    queryKey: ['expenses'],
    queryFn: dbClient.expenses.list,
  });

  // Mutators
  const createExpenseMutation = useMutation({
    mutationFn: (data: ExpenseFormInput) => dbClient.expenses.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setModalOpen(false);
    }
  });

  const updateExpenseMutation = useMutation({
    mutationFn: (data: { id: string; input: ExpenseFormInput }) =>
      dbClient.expenses.update(data.id, data.input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setModalOpen(false);
      setEditingExpense(null);
    }
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: dbClient.expenses.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    }
  });

  // Form setup
  const form = useForm<ExpenseFormInput>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      title: '',
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      category: 'Utilities',
      description: ''
    }
  });

  const openAddExpense = () => {
    setEditingExpense(null);
    form.reset({
      title: '',
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      category: 'Utilities',
      description: ''
    });
    setModalOpen(true);
  };

  const openEditExpense = (exp: Expense) => {
    setEditingExpense(exp);
    form.reset({
      title: exp.title,
      amount: Number(exp.amount),
      date: exp.date,
      category: exp.category,
      description: exp.description || '',
    });
    setModalOpen(true);
  };

  const handleSubmit = (data: ExpenseFormInput) => {
    if (editingExpense) {
      updateExpenseMutation.mutate({ id: editingExpense.id, input: data });
    } else {
      createExpenseMutation.mutate(data);
    }
  };

  const handleDelete = (id: string, title: string) => {
    if (confirm(`Are you sure you want to delete the expense "${title}"?`)) {
      deleteExpenseMutation.mutate(id);
    }
  };

  // Filter logic
  const filteredExpenses = expenses.filter(e => {
    const matchesSearch = e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.description && e.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === '' || e.category === selectedCategory;
    const matchesDate = selectedDate === '' || e.date === selectedDate;
    return matchesSearch && matchesCategory && matchesDate;
  });

  // Total calculation
  const totalOutflow = filteredExpenses.reduce((sum, item) => sum + Number(item.amount), 0);

  const currencySymbol = settings?.currency_symbol || '₹';

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <TrendingDown className="text-primary" size={24} /> Expense Tracker
          </h2>
          <p className="text-sm text-muted-foreground hidden sm:block">
            Log, categorize, and audit store operations expenses and stock purchases.
          </p>
        </div>

        <div>
          <button
            onClick={openAddExpense}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/95 transition-all"
          >
            <Plus size={16} /> Log Expense
          </button>
        </div>
      </div>

      {/* Aggregate card */}
      <div className="glass-panel rounded-2xl p-4 sm:p-6 border border-border/80 bg-gradient-to-tr from-card to-secondary/10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive border border-destructive/20">
            <CreditCard size={22} />
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Filtered Outflow</span>
            <div className="text-xl sm:text-2xl font-bold text-foreground font-mono mt-1">
              {currencySymbol}{totalOutflow.toFixed(2)}
            </div>
          </div>
        </div>
        <div className="text-xs text-muted-foreground text-right hidden sm:block">
          Showing {filteredExpenses.length} expense record(s)
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col gap-4 sm:flex-row">
        {/* Search */}
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
            <Search size={18} />
          </span>
          <input
            type="text"
            placeholder="Search expenses by title or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full rounded-xl border border-border bg-card px-10 py-2.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>

        {/* Category Dropdown */}
        <div className="relative min-w-0 sm:min-w-[180px]">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
            <Filter size={14} />
          </span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="block w-full rounded-xl border border-border bg-card pl-9 pr-3 py-2.5 text-sm focus:border-primary focus:outline-none"
          >
            <option value="">All Categories</option>
            {EXPENSE_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Date Filter */}
        <div className="relative min-w-0 sm:min-w-[180px]">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
            <Calendar size={14} />
          </span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="block w-full rounded-xl border border-border bg-card pl-9 pr-3 py-2 text-sm focus:border-primary focus:outline-none font-mono"
          />
        </div>
      </div>

      {/* Expense Listing */}
      {expensesLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="animate-spin text-primary" size={28} />
        </div>
      ) : filteredExpenses.length === 0 ? (
        <div className="glass-panel flex flex-col items-center justify-center rounded-2xl p-12 text-center">
          <AlertTriangle className="mb-4 text-muted-foreground" size={32} />
          <h3 className="font-semibold text-foreground">No Expenses Logged</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Log shop expenses such as utility bills, warehouse rent, helper salary, or stock purchase costs to track cash margins.
          </p>
          <button
            onClick={openAddExpense}
            className="mt-4 flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-4 py-2 text-xs font-semibold text-primary hover:bg-primary/20"
          >
            <Plus size={12} /> Log Expense
          </button>
        </div>
      ) : (
        <div className="glass-panel overflow-hidden rounded-2xl border border-border shadow-md">
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-secondary/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-4">Expense Details</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Transaction Date</th>
                  <th className="px-6 py-4">Amount Outflow</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm text-foreground">
                {filteredExpenses.map((e) => (
                  <tr key={e.id} className="hover:bg-secondary/25 transition-all">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold">{e.title}</span>
                        {e.description && (
                          <span className="text-xs text-muted-foreground mt-1">{e.description}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-block rounded-full bg-secondary border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                        {e.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
                      {new Date(e.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-destructive">
                      {currencySymbol}{Number(e.amount).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => openEditExpense(e)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(e.id, e.title)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-destructive/20 text-destructive hover:bg-destructive/10"
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
            {filteredExpenses.map((e) => (
              <div key={e.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm">{e.title}</div>
                    {e.description && (
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">{e.description}</div>
                    )}
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => openEditExpense(e)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={() => handleDelete(e.id, e.title)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-destructive/20 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="inline-block rounded-full bg-secondary border border-border px-2 py-0.5 font-medium text-muted-foreground">
                      {e.category}
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {new Date(e.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-destructive">
                    {currencySymbol}{Number(e.amount).toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EXPENSE DIALOG MODAL */}
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
              {editingExpense ? 'Edit Expense Record' : 'Log New Expense'}
            </h3>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 mt-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Expense Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Electric power bill May"
                  {...form.register('title')}
                  className="block w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
                {form.formState.errors.title && (
                  <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Outflow Amount ({currencySymbol}) *</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    {...form.register('amount', {
                      valueAsNumber: true,
                      onChange: (e) => {
                        e.target.value = e.target.value.replace(/^0+(?=\d)/, '');
                      }
                    })}
                    className="block w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm focus:border-primary focus:outline-none font-mono"
                  />
                  {form.formState.errors.amount && (
                    <p className="text-xs text-destructive">{form.formState.errors.amount.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Transaction Date *</label>
                  <input
                    type="date"
                    {...form.register('date')}
                    className="block w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm focus:border-primary focus:outline-none font-mono"
                  />
                  {form.formState.errors.date && (
                    <p className="text-xs text-destructive">{form.formState.errors.date.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Category *</label>
                <select
                  {...form.register('category')}
                  className="block w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                >
                  {EXPENSE_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                {form.formState.errors.category && (
                  <p className="text-xs text-destructive">{form.formState.errors.category.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Description</label>
                <textarea
                  placeholder="Payment details, transaction ID, supplier name..."
                  rows={2}
                  {...form.register('description')}
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
                  disabled={createExpenseMutation.isPending || updateExpenseMutation.isPending}
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5"
                >
                  {(createExpenseMutation.isPending || updateExpenseMutation.isPending) && (
                    <Loader2 className="animate-spin" size={12} />
                  )}
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
