'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { dbClient } from '@/lib/db';
import { Bill, ShopSettings } from '@/lib/types';
import { Loader2, Printer, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ReceiptPrintPage() {
  const params = useParams();
  const id = params.id as string;
  const [printed, setPrinted] = useState(false);

  // Queries
  const { data: settings } = useQuery<ShopSettings>({
    queryKey: ['settings'],
    queryFn: dbClient.shopSettings.get,
  });

  const { data: bill, isLoading, error } = useQuery<Bill | null>({
    queryKey: ['bill', id],
    queryFn: () => dbClient.bills.get(id),
  });

  const handlePrint = useCallback(() => {
    window.print();
    setPrinted(true);
  }, []);

  // Auto-print on first load if data is ready
  useEffect(() => {
    if (bill && settings && !printed) {
      const timer = setTimeout(() => {
        handlePrint();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [bill, settings, printed, handlePrint]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white text-black">
        <Loader2 className="animate-spin" size={24} />
        <span className="ml-2 text-sm font-mono">Preparing receipt...</span>
      </div>
    );
  }

  if (error || !bill) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-white text-black gap-4">
        <p className="text-sm font-mono text-red-500">Error: Could not load receipt data.</p>
        <Link
          href="/billing/all"
          className="inline-flex items-center gap-2 text-xs text-blue-600 underline"
        >
          <ArrowLeft size={12} /> Back to Invoices
        </Link>
      </div>
    );
  }

  const currencySymbol = settings?.currency_symbol || '₹';

  return (
    <>
      {/* Print-specific styles */}
      <style jsx global>{`
        @media print {
          @page {
            size: 80mm auto;
            margin: 2mm;
          }
          html, body {
            width: 80mm;
            background: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print {
            display: none !important;
          }
          .receipt-container {
            max-width: 100% !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>

      <div className="min-h-screen bg-gray-100 text-black">
        {/* Print Controls Bar - hidden when printing */}
        <div className="no-print sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm px-4 py-3 flex items-center justify-between">
          <Link
            href={`/billing/${id}`}
            className="inline-flex items-center gap-2 text-xs text-gray-600 hover:text-black transition-colors"
          >
            <ArrowLeft size={14} /> Back to Invoice
          </Link>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-lg bg-black text-white px-5 py-2 text-sm font-semibold hover:bg-gray-800 transition-all"
          >
            <Printer size={16} />
            Print Receipt
          </button>
        </div>

        {/* Receipt Content */}
        <div className="flex justify-center py-6 no-print-wrapper">
          <div className="receipt-container mx-auto w-full max-w-[80mm] bg-white border border-gray-200 shadow-lg p-4 font-mono text-xs select-none">

            {/* SHOP HEADER */}
            <div className="text-center space-y-0.5 mb-4">
              <h1 className="text-sm font-bold uppercase tracking-wider">{settings?.shop_name || 'MY STORE'}</h1>
              {settings?.owner_name && <p className="text-[10px]">Proprietor: {settings.owner_name}</p>}
              {settings?.address && <p className="text-[10px] leading-tight">{settings.address}</p>}
              {settings?.phone && <p className="text-[10px]">Ph: {settings.phone}</p>}
              {settings?.email && <p className="text-[10px]">{settings.email}</p>}
              {settings?.gstin && (
                <p className="text-[10px] font-bold border-y border-dashed border-black py-0.5 mt-1">
                  GSTIN: {settings.gstin}
                </p>
              )}
            </div>

            {/* INVOICE INFO */}
            <div className="space-y-0.5 border-b border-dashed border-black pb-2 mb-2 leading-snug">
              <div className="flex justify-between">
                <span>Bill No: #{bill.bill_number}</span>
                <span>Date: {new Date(bill.created_at).toLocaleDateString('en-GB')}</span>
              </div>
              <div>Time: {new Date(bill.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
              {bill.customer ? (
                <div className="border-t border-dotted border-black/40 pt-1 mt-1">
                  <div>Customer: {bill.customer.name}</div>
                  {bill.customer.phone && <div>Ph: {bill.customer.phone}</div>}
                  {bill.customer.address && <div className="leading-tight">Add: {bill.customer.address}</div>}
                </div>
              ) : (
                <div className="border-t border-dotted border-black/40 pt-1 mt-1">Customer: Walk-in Client</div>
              )}
            </div>

            {/* ITEMS LIST */}
            <table className="w-full text-left border-b border-dashed border-black pb-2 mb-2">
              <thead>
                <tr className="border-b border-dotted border-black text-[10px] font-bold">
                  <th className="py-1">Description</th>
                  <th className="py-1 text-center">Qty</th>
                  <th className="py-1 text-right">Price</th>
                  <th className="py-1 text-right">Amt</th>
                </tr>
              </thead>
              <tbody>
                {bill.items?.map((item) => (
                  <tr key={item.id} className="align-top leading-snug">
                    <td className="py-1 max-w-[35mm] truncate">{item.item_name}</td>
                    <td className="py-1 text-center">{item.quantity}</td>
                    <td className="py-1 text-right">{Number(item.unit_price).toFixed(2)}</td>
                    <td className="py-1 text-right">{Number(item.quantity * item.unit_price).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* FINANCIAL SUMMARY */}
            <div className="space-y-0.5 text-[11px] leading-snug">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{currencySymbol}{Number(bill.subtotal).toFixed(2)}</span>
              </div>
              {Number(bill.tax_amount) > 0 && (
                <div className="flex justify-between">
                  <span>GST/Tax ({bill.tax_percentage}%)</span>
                  <span>{currencySymbol}{Number(bill.tax_amount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold border-t border-dotted border-black pt-1 text-xs">
                <span>Grand Total</span>
                <span>{currencySymbol}{Number(bill.grand_total).toFixed(2)}</span>
              </div>
              <div className="flex justify-between mt-1 text-[10px]">
                <span>Amount Paid ({bill.payment_method})</span>
                <span>{currencySymbol}{Number(bill.amount_paid).toFixed(2)}</span>
              </div>
              {Number(bill.pending_amount) > 0 && (
                <div className="flex justify-between font-bold text-black border-t border-dotted border-black pt-1">
                  <span>Pending Credit Due</span>
                  <span>{currencySymbol}{Number(bill.pending_amount).toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* RECEIPT FOOTER */}
            <div className="text-center border-t border-dashed border-black mt-4 pt-3 space-y-1">
              <p className="text-[10px] font-bold">{settings?.receipt_footer_message || 'Thank you for shopping with us!'}</p>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
