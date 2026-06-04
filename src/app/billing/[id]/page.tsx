'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { dbClient } from '@/lib/db';
import { Bill, ShopSettings } from '@/lib/types';
import {
  Receipt,
  ArrowLeft,
  Printer,
  Calendar,
  User,
  CreditCard,
  Plus,
  Loader2,
  CheckCircle,
  FileText,
  AlertCircle,
  TrendingUp,
  Edit2
} from 'lucide-react';
import Link from 'next/link';

export default function BillDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const id = params.id as string;

  // Record payment input state
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [markAsFullyPaid, setMarkAsFullyPaid] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Queries
  const { data: settings } = useQuery<ShopSettings>({
    queryKey: ['settings'],
    queryFn: dbClient.shopSettings.get,
  });

  const { data: bill, isLoading, error } = useQuery<Bill | null>({
    queryKey: ['bill', id],
    queryFn: () => dbClient.bills.get(id),
  });

  // Mutation to record payment
  const recordPaymentMutation = useMutation({
    mutationFn: (params: { amount: number; markFullyPaid: boolean }) =>
      dbClient.bills.updatePayment(id, params.amount, params.markFullyPaid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bill', id] });
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setRecordPaymentOpen(false);
      setPaymentAmount(0);
      setMarkAsFullyPaid(false);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to record payment.');
    }
  });

  // Auto-print check
  React.useEffect(() => {
    if (bill && searchParams.get('print') === 'true') {
      // Open print layout in a new window
      window.open(`/receipts/${id}`, '_blank');
      // Remove print parameter from URL without page reload
      const newUrl = window.location.pathname;
      window.history.replaceState({ path: newUrl }, '', newUrl);
    }
  }, [bill, id, searchParams]);

  const handleRecordPayment = () => {
    if (paymentAmount <= 0) return;
    if (bill && paymentAmount > Number(bill.pending_amount)) {
      alert(`Payment amount cannot exceed the pending balance of ${currencySymbol}${bill.pending_amount}`);
      return;
    }
    recordPaymentMutation.mutate({ amount: paymentAmount, markFullyPaid: markAsFullyPaid });
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  if (error || !bill) {
    return (
      <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive flex items-center gap-2">
        <AlertCircle size={18} />
        <span>Failed to load invoice details. The invoice might have been deleted.</span>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    if (status === 'Paid') return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    if (status === 'Partial') return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    return 'bg-red-500/10 text-red-500 border-red-500/20';
  };

  const currencySymbol = settings?.currency_symbol || '₹';

  // Parse change info from notes
  let cashReceivedVal: string | null = null;
  let changeGivenVal: string | null = null;
  let hasChangeInfo = false;
  let displayNotes = bill?.notes || '';

  if (bill?.notes) {
    const match = bill.notes.match(/Cash Received:\s*([^|]+)\|\s*Change Given:\s*(.*)/);
    if (match) {
      cashReceivedVal = match[1].trim();
      changeGivenVal = match[2].trim();
      hasChangeInfo = true;
      displayNotes = ''; // Hide from standard notes card
    }
  }

  return (
    <div className="space-y-6">
      {/* Back button & title */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/billing/all"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              Invoice Details: Bill #{bill.bill_number}
            </h2>
            <p className="text-xs text-muted-foreground">
              Generated on {new Date(bill.created_at).toLocaleString('en-GB')}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Link
            href={`/billing/${bill.id}/edit`}
            className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/20 transition-all"
          >
            <Edit2 size={14} /> Edit Invoice
          </Link>
          <Link
            href={`/receipts/${bill.id}`}
            target="_blank"
            className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary transition-all"
          >
            <Printer size={16} /> Print Receipt
          </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* LEFT COLUMN: BILL ITEMS TABLE (Col Span 2) */}
        <div className="space-y-6 md:col-span-2">
          <div className="glass-panel rounded-2xl overflow-hidden border border-border shadow-md">
            <div className="bg-secondary/40 px-6 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Invoiced Items ledger</h3>
            </div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-3">Item Name</th>
                  <th className="px-6 py-3 text-center">Quantity</th>
                  <th className="px-6 py-3">Unit Price</th>
                  <th className="px-6 py-3 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {bill.items?.map((item) => (
                  <tr key={item.id} className="hover:bg-secondary/5 transition-all">
                    <td className="px-6 py-4 font-semibold">{item.item_name}</td>
                    <td className="px-6 py-4 text-center font-mono font-semibold">{item.quantity}</td>
                    <td className="px-6 py-4 font-mono">{currencySymbol}{Number(item.unit_price).toFixed(2)}</td>
                    <td className="px-6 py-4 font-mono font-semibold text-right">
                      {currencySymbol}{Number(item.total).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Notes Card */}
          {displayNotes && (
            <div className="glass-panel rounded-2xl p-6 space-y-2">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Invoice Notes</h4>
              <p className="text-sm text-muted-foreground">{displayNotes}</p>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: FINANCIAL LEDGER & SETTLEMENT */}
        <div className="space-y-6">
          {/* Customer profile card */}
          <div className="glass-panel rounded-2xl p-6 space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <User size={14} className="text-primary" /> Customer Profile
            </h3>
            {bill.customer ? (
              <div className="space-y-2 pt-1">
                <div className="font-bold text-foreground">{bill.customer.name}</div>
                <div className="text-xs text-muted-foreground space-y-1 font-mono">
                  {bill.customer.phone && <div>Phone: {bill.customer.phone}</div>}
                  {bill.customer.email && <div>Email: {bill.customer.email}</div>}
                  {bill.customer.address && <div className="not-italic">Address: {bill.customer.address}</div>}
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground pt-1">
                Walk-in Customer (Guest)
              </div>
            )}
          </div>

          {/* Ledger calculations card */}
          <div className="glass-panel rounded-2xl p-6 space-y-6 shadow-md bg-gradient-to-br from-card to-secondary/10">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <CreditCard size={14} className="text-primary" /> Ledger Breakdown
            </h3>

            <div className="space-y-3 border-b border-border/80 pb-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-mono">{currencySymbol}{Number(bill.subtotal).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">GST/Tax ({bill.tax_percentage}%)</span>
                <span className="font-mono">{currencySymbol}{Number(bill.tax_amount).toFixed(2)}</span>
              </div>
              {bill.status === 'Paid' && Number(bill.amount_paid) < Number(bill.grand_total) && (
                <div className="flex justify-between text-sm text-emerald-500 font-semibold pt-1">
                  <span>Remainder Discount (Settled)</span>
                  <span className="font-mono">-{currencySymbol}{(Number(bill.grand_total) - Number(bill.amount_paid)).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-dashed border-border pt-3 text-sm font-bold text-foreground">
                <span>Grand Total</span>
                <span className="font-mono text-base font-bold text-primary">
                  {currencySymbol}
                  {bill.status === 'Paid' && Number(bill.amount_paid) < Number(bill.grand_total)
                    ? Number(bill.amount_paid).toFixed(2)
                    : Number(bill.grand_total).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Settlement Status:</span>
                <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${getStatusBadge(bill.status)}`}>
                  {bill.status}
                </span>
              </div>
              <div className="flex justify-between text-sm items-center">
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Contact Info</span>
                <span className="font-bold bg-secondary/50 px-2 py-0.5 rounded-md border border-border/50 text-xs">{bill.customer?.phone || 'No Contact Info'}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-border pt-3">
                <span className="text-muted-foreground">Amount Paid:</span>
                <span className="font-mono font-bold text-emerald-500">{currencySymbol}{Number(bill.amount_paid).toFixed(2)}</span>
              </div>
              {hasChangeInfo && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Cash Received:</span>
                    <span className="font-mono text-foreground">{cashReceivedVal}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Change Returned:</span>
                    <span className="font-mono text-emerald-500 font-medium">{changeGivenVal}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Credit Balance Due:</span>
                <span className={`font-mono font-bold ${Number(bill.pending_amount) > 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                  {currencySymbol}{Number(bill.pending_amount).toFixed(2)}
                </span>
              </div>
            </div>

            {/* RECORD DUE SETTLEMENT INPUT */}
            {Number(bill.pending_amount) > 0 && (
              <div className="border-t border-border pt-4 space-y-4">
                {!recordPaymentOpen ? (
                  <button
                    onClick={() => {
                      setRecordPaymentOpen(true);
                      setPaymentAmount(Number(bill.pending_amount));
                      setMarkAsFullyPaid(false);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 py-2.5 text-xs font-semibold text-emerald-500 hover:bg-emerald-500/20 transition-all"
                  >
                    <Plus size={14} /> Record Payment / Settlement
                  </button>
                ) : (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-muted-foreground">Additional Cash Paid</label>
                      <input
                        type="number"
                        step="0.01"
                        value={paymentAmount}
                        onChange={(e) => {
                          e.target.value = e.target.value.replace(/^0+(?=\d)/, '');
                          setPaymentAmount(Number(e.target.value) || 0);
                        }}
                        className="block w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-mono focus:outline-none"
                      />
                    </div>
                    {bill && paymentAmount < Number(bill.pending_amount) && (
                      <div className="flex items-center gap-2 px-1">
                        <input
                          type="checkbox"
                          id="settle-fully-paid"
                          checked={markAsFullyPaid}
                          onChange={(e) => setMarkAsFullyPaid(e.target.checked)}
                          className="h-4 w-4 rounded border-border bg-background text-emerald-500 focus:ring-emerald-500"
                        />
                        <label htmlFor="settle-fully-paid" className="text-xs font-semibold text-foreground cursor-pointer select-none">
                          Mark as Fully Paid (Settle remaining {currencySymbol}{(Number(bill.pending_amount) - paymentAmount).toFixed(2)})
                        </label>
                      </div>
                    )}
                    {errorMsg && <p className="text-xs text-destructive">{errorMsg}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setRecordPaymentOpen(false)}
                        className="flex-1 rounded-xl border border-border py-2 text-xs font-semibold hover:bg-secondary"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleRecordPayment}
                        disabled={recordPaymentMutation.isPending || paymentAmount <= 0}
                        className="flex-1 rounded-xl bg-emerald-500 text-white py-2 text-xs font-semibold hover:bg-emerald-600 disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        {recordPaymentMutation.isPending && <Loader2 className="animate-spin" size={12} />}
                        Confirm Cash
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
