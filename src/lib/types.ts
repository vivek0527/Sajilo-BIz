export interface User {
  id: string;
  email: string;
  shop_name?: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  color: string;
  created_by: string;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  category_id?: string;
  selling_price: number;
  cost_price?: number;
  stock_quantity: number;
  unit: string;
  barcode?: string;
  low_stock_threshold?: number;
  created_by: string;
  created_at: string;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  total_purchases: number;
  total_pending: number;
  created_by: string;
  created_at: string;
}

export interface ShopSettings {
  id: string;
  shop_name: string;
  owner_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  gstin?: string;
  default_tax_percentage: number;
  currency_symbol: string;
  receipt_footer_message?: string;
  bill_counter: number;
  created_by: string;
  created_at: string;
}

export interface Bill {
  id: string;
  bill_number: number;
  customer_id?: string;
  subtotal: number;
  tax_percentage: number;
  tax_amount: number;
  grand_total: number;
  amount_paid: number;
  pending_amount: number;
  status: 'Paid' | 'Partial' | 'Pending';
  payment_method: 'Cash' | 'Card' | 'UPI' | 'Due' | 'Mixed';
  notes?: string;
  created_by: string;
  created_at: string;
  customer?: Customer; // Joined customer details
  items?: BillItem[]; // Joined bill items
}

export interface BillItem {
  id: string;
  bill_id: string;
  product_id?: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  date: string; // YYYY-MM-DD
  category: string;
  description?: string;
  created_by: string;
  created_at: string;
}
