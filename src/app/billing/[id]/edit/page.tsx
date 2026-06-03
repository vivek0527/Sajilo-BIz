'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dbClient } from '@/lib/db';
import { Product, Customer, ShopSettings, Bill, BillItem } from '@/lib/types';
import {
  Receipt,
  Search,
  Plus,
  Minus,
  Trash2,
  User,
  CreditCard,
  Printer,
  ChevronRight,
  Loader2,
  ArrowLeft,
  AlertCircle,
  Save,
  Phone,
  MapPin
} from 'lucide-react';
import Link from 'next/link';

interface LocalLineItem {
  id: string; // unique local ID (product_id or custom ID)
  product_id?: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  max_stock?: number;
}

export default function EditBillPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const queryClient = useQueryClient();

  // Selected customer details
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerAddress, setCustomerAddress] = useState<string>('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Close suggestions on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.customer-details-container')) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const handleNameChange = (val: string) => {
    setCustomerName(val);
    setSelectedCustomerId('');
    setShowSuggestions(true);
  };

  // Line items state
  const [lineItems, setLineItems] = useState<LocalLineItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState(0);

  // Bill level fields
  const [taxPercentage, setTaxPercentage] = useState<number>(0);
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'UPI' | 'Due' | 'Mixed'>('Cash');
  const [notes, setNotes] = useState('');

  // Notifications
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Queries
  const { data: settings } = useQuery<ShopSettings>({
    queryKey: ['settings'],
    queryFn: dbClient.shopSettings.get,
  });

  const { data: bill, isLoading: billLoading } = useQuery<Bill | null>({
    queryKey: ['bill', id],
    queryFn: () => dbClient.bills.get(id),
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: dbClient.customers.list,
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: dbClient.products.list,
  });

  const matchedCustomers = customerName.trim() === ''
    ? []
    : customers.filter(c => 
        c.name.toLowerCase().includes(customerName.toLowerCase()) ||
        (c.phone && c.phone.includes(customerName))
      ).slice(0, 5);

  // Prepopulate state when bill loads
  useEffect(() => {
    if (bill) {
      setSelectedCustomerId(bill.customer_id || '');
      if (bill.customer) {
        setCustomerName(bill.customer.name);
        setCustomerPhone(bill.customer.phone || '');
        setCustomerAddress(bill.customer.address || '');
      } else {
        setCustomerName('');
        setCustomerPhone('');
        setCustomerAddress('');
      }
      setTaxPercentage(Number(bill.tax_percentage));
      setAmountPaid(Number(bill.amount_paid));
      setPaymentMethod(bill.payment_method);
      setNotes(bill.notes || '');

      if (bill.items) {
        const loadedItems = bill.items.map(item => {
          const matchingProduct = products.find(p => p.id === item.product_id);
          // When editing, maximum stock available is the current product stock PLUS the quantity already in the bill
          const currentStock = matchingProduct ? Number(matchingProduct.stock_quantity) : 0;
          return {
            id: item.product_id || ('custom_' + Math.random()),
            product_id: item.product_id,
            item_name: item.item_name,
            quantity: Number(item.quantity),
            unit_price: Number(item.unit_price),
            max_stock: item.product_id ? (currentStock + Number(item.quantity)) : undefined
          };
        });
        setLineItems(loadedItems);
      }
    }
  }, [bill, products]);

  // Mutations
  const updateBillMutation = useMutation({
    mutationFn: (data: { bill: any; items: any[] }) => dbClient.bills.update(id, data.bill, data.items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      queryClient.invalidateQueries({ queryKey: ['bill', id] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      router.push(`/billing/${id}`);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to update invoice.');
    }
  });

  // Calculations
  const subtotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const taxAmount = subtotal * (taxPercentage / 100);
  const grandTotal = subtotal + taxAmount;
  const pendingAmount = Math.max(0, grandTotal - amountPaid);

  // Handlers
  const handleAddProduct = (prod: Product) => {
    const existing = lineItems.find(item => item.product_id === prod.id);
    if (existing) {
      const allowedStock = existing.max_stock !== undefined ? existing.max_stock : Number(prod.stock_quantity);
      if (existing.quantity >= allowedStock) {
        alert(`Insufficient stock. Only ${allowedStock} total available items.`);
        return;
      }
      setLineItems(lineItems.map(item =>
        item.product_id === prod.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      if (Number(prod.stock_quantity) <= 0) {
        alert('Product is out of stock.');
        return;
      }
      setLineItems([...lineItems, {
        id: prod.id,
        product_id: prod.id,
        item_name: prod.name,
        quantity: 1,
        unit_price: Number(prod.selling_price),
        max_stock: Number(prod.stock_quantity)
      }]);
    }
    setProductSearch('');
  };

  const handleAddCustomItem = () => {
    if (!customItemName.trim() || customItemPrice <= 0) return;
    const localId = 'custom_' + Date.now();
    setLineItems([...lineItems, {
      id: localId,
      item_name: customItemName,
      quantity: 1,
      unit_price: customItemPrice,
    }]);
    setCustomItemName('');
    setCustomItemPrice(0);
  };

  const handleUpdateQuantity = (lineItemId: string, qty: number) => {
    if (qty <= 0) return;
    const item = lineItems.find(i => i.id === lineItemId);
    if (item?.max_stock !== undefined && qty > item.max_stock) {
      alert(`Insufficient stock. Only ${item.max_stock} total available items.`);
      return;
    }
    setLineItems(lineItems.map(i =>
      i.id === lineItemId ? { ...i, quantity: qty } : i
    ));
  };

  const handleDeleteItem = (lineItemId: string) => {
    setLineItems(lineItems.filter(i => i.id !== lineItemId));
  };

  const handleSave = async () => {
    if (lineItems.length === 0) {
      alert('Cannot save an empty invoice.');
      return;
    }

    try {
      setErrorMsg(null);
      let finalCustomerId = selectedCustomerId;

      if (!finalCustomerId && customerName.trim()) {
        const existing = customers.find(c => 
          c.name.toLowerCase() === customerName.trim().toLowerCase() ||
          (c.phone && customerPhone && c.phone === customerPhone.trim())
        );
        if (existing) {
          finalCustomerId = existing.id;
        } else {
          const newCust = await dbClient.customers.create({
            name: customerName.trim(),
            phone: customerPhone.trim() || undefined,
            address: customerAddress.trim() || undefined
          });
          finalCustomerId = newCust.id;
        }
      }

      const billData = {
        customer_id: finalCustomerId || undefined,
        subtotal: Number(subtotal.toFixed(2)),
        tax_percentage: Number(taxPercentage),
        tax_amount: Number(taxAmount.toFixed(2)),
        grand_total: Number(grandTotal.toFixed(2)),
        amount_paid: Number(amountPaid),
        pending_amount: Number(pendingAmount.toFixed(2)),
        status: (amountPaid >= grandTotal ? 'Paid' : amountPaid > 0 ? 'Partial' : 'Pending') as any,
        payment_method: paymentMethod,
        notes: notes || undefined,
      };

      const itemsData = lineItems.map(item => ({
        product_id: item.product_id,
        item_name: item.item_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: Number((item.quantity * item.unit_price).toFixed(2))
      }));

      updateBillMutation.mutate({ bill: billData, items: itemsData });
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update customer details.');
    }
  };

  // Filter products by search text
  const filteredProducts = productSearch.trim() === ''
    ? []
    : products.filter(p =>
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        (p.barcode && p.barcode.includes(productSearch))
      ).slice(0, 5);

  const currencySymbol = settings?.currency_symbol || '₹';

  if (billLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive flex items-center gap-2">
        <AlertCircle size={18} />
        <span>Bill not found.</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/billing/${id}`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Edit Invoice: Bill #{bill.bill_number}
          </h2>
          <p className="text-xs text-muted-foreground">
            Modify quantities, edit billing rates, register returns, and save changes.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* LEFT COLUMN: ITEM LIST & CUSTOMER DETAILS (Col Span 2) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Customer Details Card */}
          <div className="glass-panel rounded-2xl p-6 space-y-4 customer-details-container relative">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <User size={16} className="text-primary" /> Customer Details
            </h3>
            
            <div className="space-y-3 pt-1">
              {/* Name */}
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                  <User size={18} />
                </span>
                <input
                  type="text"
                  placeholder="Customer name (or leave blank for Guest)"
                  value={customerName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  onFocus={() => setShowSuggestions(true)}
                  className="block w-full rounded-xl border border-border bg-background/50 pl-10 pr-3 py-2.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />

                {/* Suggestions Dropdown */}
                {showSuggestions && matchedCustomers.length > 0 && (
                  <div className="absolute left-0 right-0 mt-1.5 z-50 rounded-xl border border-border bg-card shadow-xl overflow-hidden divide-y divide-border">
                    {matchedCustomers.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedCustomerId(c.id);
                          setCustomerName(c.name);
                          setCustomerPhone(c.phone || '');
                          setCustomerAddress(c.address || '');
                          setShowSuggestions(false);
                        }}
                        className="flex w-full items-center justify-between px-4 py-2.5 hover:bg-secondary text-left text-sm"
                      >
                        <div>
                          <div className="font-semibold text-foreground">{c.name}</div>
                          {c.phone && <span className="text-xs text-muted-foreground font-mono">{c.phone}</span>}
                        </div>
                        {Number(c.total_pending) > 0 && (
                          <span className="text-xs font-semibold text-red-500 font-mono">
                            Due: {currencySymbol}{Number(c.total_pending).toFixed(2)}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Phone */}
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                  <Phone size={18} />
                </span>
                <input
                  type="text"
                  placeholder="Phone number (Used to find/create customer)"
                  value={customerPhone}
                  onChange={(e) => {
                    setCustomerPhone(e.target.value);
                    setSelectedCustomerId('');
                  }}
                  className="block w-full rounded-xl border border-border bg-background/50 pl-10 pr-3 py-2.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                />
              </div>

              {/* Address */}
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                  <MapPin size={18} />
                </span>
                <input
                  type="text"
                  placeholder="Address"
                  value={customerAddress}
                  onChange={(e) => {
                    setCustomerAddress(e.target.value);
                    setSelectedCustomerId('');
                  }}
                  className="block w-full rounded-xl border border-border bg-background/50 pl-10 pr-3 py-2.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {selectedCustomerId && (
                <div className="flex items-center justify-between rounded-xl bg-primary/10 border border-primary/20 px-4 py-2 text-xs text-primary font-medium animate-in fade-in">
                  <span>Linked to Existing Customer Profile</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCustomerId('');
                      setCustomerName('');
                      setCustomerPhone('');
                      setCustomerAddress('');
                    }}
                    className="hover:underline text-[10px] font-bold"
                  >
                    Clear Profile
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Product Lookup Card */}
          <div className="glass-panel rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Add Products to Invoice</h3>

            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                <Search size={18} />
              </span>
              <input
                type="text"
                placeholder="Scan barcode or type product name..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="block w-full rounded-xl border border-border bg-background px-10 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none"
              />

              {/* Search Suggestions */}
              {filteredProducts.length > 0 && (
                <div className="absolute left-0 right-0 mt-2 z-50 rounded-xl border border-border bg-card shadow-xl overflow-hidden divide-y divide-border">
                  {filteredProducts.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleAddProduct(p)}
                      className="flex w-full items-center justify-between px-4 py-3 hover:bg-secondary text-left text-sm"
                    >
                      <div>
                        <div className="font-semibold">{p.name}</div>
                        <span className="text-xs text-muted-foreground font-mono">Stock: {p.stock_quantity} {p.unit}</span>
                      </div>
                      <div className="font-semibold font-mono text-primary">
                        {currencySymbol}{Number(p.selling_price).toFixed(2)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Custom Item Box */}
            <div className="border-t border-border pt-4">
              <span className="text-xs text-muted-foreground font-medium">Or Add a Custom Item</span>
              <div className="grid gap-3 sm:grid-cols-3 mt-2">
                <input
                  type="text"
                  placeholder="Item Name (e.g. Wrapping paper)"
                  value={customItemName}
                  onChange={(e) => setCustomItemName(e.target.value)}
                  className="rounded-xl border border-border bg-background px-3 py-2 text-xs focus:outline-none"
                />
                <input
                  type="number"
                  placeholder="Unit Price"
                  value={customItemPrice || ''}
                  onChange={(e) => setCustomItemPrice(Number(e.target.value))}
                  className="rounded-xl border border-border bg-background px-3 py-2 text-xs focus:outline-none font-mono"
                />
                <button
                  onClick={handleAddCustomItem}
                  className="rounded-xl border border-primary/20 bg-primary/10 text-primary px-3 py-2 text-xs font-semibold hover:bg-primary/25"
                >
                  Add Custom Item
                </button>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="glass-panel rounded-2xl overflow-hidden border border-border shadow-md">
            <div className="bg-secondary/50 px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Invoiced Items</h3>
              <span className="text-xs text-muted-foreground font-semibold">{lineItems.length} items listed</span>
            </div>

            {lineItems.length === 0 ? (
              <div className="p-12 text-center text-sm text-muted-foreground">
                No items added to invoice.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <th className="px-6 py-3">Item Name</th>
                      <th className="px-6 py-3 text-center">Quantity</th>
                      <th className="px-6 py-3">Unit Price</th>
                      <th className="px-6 py-3">Total</th>
                      <th className="px-6 py-3 text-right">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-sm">
                    {lineItems.map((item) => (
                      <tr key={item.id} className="hover:bg-secondary/10 transition-all">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-semibold">{item.item_name}</span>
                            {item.max_stock !== undefined && (
                              <span className="text-[10px] text-muted-foreground mt-0.5">Max Available: {item.max_stock}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                              className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary"
                            >
                              <Minus size={10} />
                            </button>
                            <span className="font-semibold font-mono w-6 text-center">{item.quantity}</span>
                            <button
                              onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                              className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary"
                            >
                              <Plus size={10} />
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="number"
                            value={item.unit_price}
                            onChange={(e) => {
                              const newPrice = Number(e.target.value);
                              setLineItems(lineItems.map(i =>
                                i.id === item.id ? { ...i, unit_price: newPrice } : i
                              ));
                            }}
                            className="w-20 rounded border border-border bg-background/50 px-2 py-0.5 text-sm font-mono text-foreground focus:outline-none"
                          />
                        </td>
                        <td className="px-6 py-4 font-mono font-semibold">
                          {currencySymbol}{(item.quantity * item.unit_price).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-destructive/20 text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Notes Card */}
          <div className="glass-panel rounded-2xl p-6 space-y-2">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wider">Invoice Notes</label>
            <textarea
              placeholder="Terms, return window info, warranty details..."
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="block w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm focus:outline-none"
            />
          </div>
        </div>

        {/* RIGHT COLUMN: LIVE RE-CALCULATION SETTLEMENT PREVIEW (Col Span 1) */}
        <div className="space-y-6">
          <div className="glass-panel rounded-2xl border border-border bg-gradient-to-br from-card to-secondary/20 p-6 space-y-6 shadow-lg relative overflow-hidden">
            <div className="border-b border-border pb-4 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Receipt size={14} className="text-primary" /> Invoice Recalculation
              </span>
              <span className="text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20 rounded px-1.5 py-0.5">
                Editing
              </span>
            </div>

            {/* Calculations Breakdown */}
            <div className="space-y-3 border-b border-border/80 pb-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Items Subtotal</span>
                <span className="font-mono font-medium">{currencySymbol}{subtotal.toFixed(2)}</span>
              </div>

              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-muted-foreground">Tax Percentage</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    value={taxPercentage}
                    onChange={(e) => setTaxPercentage(Number(e.target.value))}
                    className="w-12 rounded border border-border bg-background/80 px-1 py-0.5 text-center text-xs font-mono"
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">GST/Tax Outflow</span>
                <span className="font-mono">{currencySymbol}{taxAmount.toFixed(2)}</span>
              </div>

              <div className="flex justify-between border-t border-dashed border-border pt-3 text-base font-bold text-foreground">
                <span>Grand Total</span>
                <span className="font-mono text-primary text-lg">{currencySymbol}{grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment input */}
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Payment Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Cash', 'UPI', 'Card', 'Due'] as const).map(method => (
                    <button
                      key={method}
                      onClick={() => setPaymentMethod(method)}
                      className={`py-2 text-xs font-semibold rounded-xl border transition-all ${
                        paymentMethod === method
                          ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm'
                          : 'border-border bg-background text-muted-foreground hover:text-foreground hover:bg-secondary'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount Paid ({currencySymbol})</label>
                <input
                  type="number"
                  step="0.01"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(Number(e.target.value))}
                  className="block w-full rounded-xl border border-border bg-background px-3 py-2.5 font-mono text-lg font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {pendingAmount > 0 && (
                <div className="flex items-center justify-between rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-xs text-red-500 font-medium">
                  <span className="flex items-center gap-1"><AlertCircle size={14} /> Outstanding Balance:</span>
                  <span className="font-mono font-bold text-sm">{currencySymbol}{pendingAmount.toFixed(2)}</span>
                </div>
              )}
            </div>

            {errorMsg && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4 text-xs text-destructive flex items-start gap-2">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Checkout Action Button */}
            <div className="flex gap-3">
              <Link
                href={`/billing/${id}`}
                className="flex-1 flex items-center justify-center rounded-xl border border-border bg-card py-3 text-xs font-semibold hover:bg-secondary text-foreground transition-all"
              >
                Cancel
              </Link>
              <button
                onClick={handleSave}
                disabled={updateBillMutation.isPending || lineItems.length === 0}
                className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/95 disabled:opacity-50 disabled:pointer-events-none transition-all"
              >
                {updateBillMutation.isPending ? (
                  <Loader2 className="animate-spin" size={14} />
                ) : (
                  <Save size={14} />
                )}
                Save Revisions
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
