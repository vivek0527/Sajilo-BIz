'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { dbClient } from '@/lib/db';
import { ShopSettings } from '@/lib/types';
import { Save, Loader2, Settings, Store, AlertCircle, CheckCircle } from 'lucide-react';

const settingsSchema = z.object({
  shop_name: z.string().min(2, 'Shop name must be at least 2 characters'),
  owner_name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Please enter a valid email').or(z.literal('')),
  address: z.string().optional(),
  gstin: z.string().optional(),
  default_tax_percentage: z.number().min(0, 'Tax percentage cannot be negative').max(100, 'Tax percentage cannot exceed 100'),
  currency_symbol: z.string().min(1, 'Currency symbol is required'),
  receipt_footer_message: z.string().optional(),
});

type SettingsFormInput = z.infer<typeof settingsSchema>;

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Fetch shop settings
  const { data: settings, isLoading, error } = useQuery<ShopSettings>({
    queryKey: ['settings'],
    queryFn: dbClient.shopSettings.get,
  });

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<SettingsFormInput>({
    resolver: zodResolver(settingsSchema),
    values: settings ? {
      shop_name: settings.shop_name,
      owner_name: settings.owner_name || '',
      phone: settings.phone || '',
      email: settings.email || '',
      address: settings.address || '',
      gstin: settings.gstin || '',
      default_tax_percentage: Number(settings.default_tax_percentage),
      currency_symbol: settings.currency_symbol,
      receipt_footer_message: settings.receipt_footer_message || '',
    } : undefined,
  });

  // Mutation to update settings
  const updateSettingsMutation = useMutation({
    mutationFn: (data: SettingsFormInput) => dbClient.shopSettings.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
    onError: (err: any) => {
      setSaveError(err.message || 'Failed to save settings.');
      setTimeout(() => setSaveError(null), 5000);
    }
  });

  const onSubmit = (data: SettingsFormInput) => {
    updateSettingsMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive flex items-center gap-2">
        <AlertCircle size={18} />
        <span>Failed to load settings. Please try again.</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Settings className="text-primary" size={24} /> Shop Settings
        </h2>
        <p className="text-sm text-muted-foreground hidden sm:block">
          Configure currency, taxes, store information, and receipt layout.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Helper sidebar card */}
        <div className="glass-panel rounded-2xl p-6 h-fit space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Store size={22} />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">SaaS Tenant Profile</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Your configurations are private and affect calculations in the billing, inventory, and receipt modules.
            </p>
          </div>
          <div className="border-t border-border pt-4 text-xs text-muted-foreground space-y-2">
            <div>
              <strong>Sequential Billing</strong>: Starts from 1. Tracks every transaction automatically.
            </div>
            <div>
              <strong>Mode</strong>: {dbClient.isMockMode() ? 'Offline (Local Storage Mock)' : 'Cloud Database (Supabase)'}
            </div>
          </div>
        </div>

        {/* Settings Form */}
        <div className="glass-panel rounded-2xl p-6 shadow-md md:col-span-2 sm:p-8">
          {saveSuccess && (
            <div className="mb-6 flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-sm text-emerald-500">
              <CheckCircle size={18} />
              <span>Shop settings updated successfully!</span>
            </div>
          )}

          {saveError && (
            <div className="mb-6 flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
              <AlertCircle size={18} />
              <span>{saveError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Shop Name *</label>
                <input
                  type="text"
                  {...register('shop_name')}
                  className="block w-full rounded-xl border border-border bg-background/50 px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {errors.shop_name && <p className="text-xs text-destructive">{errors.shop_name.message}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Owner Name</label>
                <input
                  type="text"
                  {...register('owner_name')}
                  className="block w-full rounded-xl border border-border bg-background/50 px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Phone Number</label>
                <input
                  type="text"
                  {...register('phone')}
                  className="block w-full rounded-xl border border-border bg-background/50 px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Contact Email</label>
                <input
                  type="email"
                  {...register('email')}
                  className="block w-full rounded-xl border border-border bg-background/50 px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>

              <div className="space-y-2 sm:col-span-2">
                <label className="text-sm font-medium text-foreground">Shop Address</label>
                <textarea
                  rows={2}
                  {...register('address')}
                  className="block w-full rounded-xl border border-border bg-background/50 px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">GSTIN / TAX Identification Number</label>
                <input
                  type="text"
                  placeholder="e.g. 27AAAAA1111A1Z1"
                  {...register('gstin')}
                  className="block w-full rounded-xl border border-border bg-background/50 px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Currency Symbol</label>
                  <select
                    {...register('currency_symbol')}
                    className="block w-full rounded-xl border border-border bg-background/50 px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="₹">₹ (INR)</option>
                    <option value="$">$ (USD)</option>
                    <option value="£">£ (GBP)</option>
                    <option value="€">€ (EUR)</option>
                    <option value="रू">रू (NPR)</option>
                  </select>
                  {errors.currency_symbol && <p className="text-xs text-destructive">{errors.currency_symbol.message}</p>}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Default Tax (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    {...register('default_tax_percentage', { valueAsNumber: true })}
                    className="block w-full rounded-xl border border-border bg-background/50 px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  {errors.default_tax_percentage && <p className="text-xs text-destructive">{errors.default_tax_percentage.message}</p>}
                </div>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <label className="text-sm font-medium text-foreground">Receipt Footer Greeting</label>
                <input
                  type="text"
                  placeholder="Thank you for shopping with us!"
                  {...register('receipt_footer_message')}
                  className="block w-full rounded-xl border border-border bg-background/50 px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-border">
              <button
                type="submit"
                disabled={updateSettingsMutation.isPending}
                className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/95 focus:outline-none focus:ring-2 focus:ring-primary disabled:pointer-events-none disabled:opacity-50 transition-all"
              >
                {updateSettingsMutation.isPending ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Save size={16} />
                )}
                Save Settings
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
