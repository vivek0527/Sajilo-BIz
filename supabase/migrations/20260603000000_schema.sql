-- Enable uuid-ossp extension
create extension if not exists "uuid-ossp";

-- 1. CATEGORIES TABLE
create table if not exists categories (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  color text default '#6366f1',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

-- Indexes for categories
create index if not exists idx_categories_created_by on categories(created_by);
create unique index if not exists idx_categories_name_tenant on categories(created_by, name);

-- RLS for categories
alter table categories enable row level security;
create policy "Manage own categories" on categories
  for all using (created_by = auth.uid()) with check (created_by = auth.uid());


-- 2. PRODUCTS TABLE
create table if not exists products (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  category_id uuid references categories(id) on delete set null,
  selling_price numeric not null check (selling_price >= 0),
  cost_price numeric check (cost_price >= 0),
  stock_quantity numeric not null default 0,
  unit text not null default 'Piece',
  barcode text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

-- Indexes for products
create index if not exists idx_products_created_by on products(created_by);
create index if not exists idx_products_category on products(category_id);
create index if not exists idx_products_barcode_tenant on products(created_by, barcode);

-- RLS for products
alter table products enable row level security;
create policy "Manage own products" on products
  for all using (created_by = auth.uid()) with check (created_by = auth.uid());


-- 3. CUSTOMERS TABLE
create table if not exists customers (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  phone text,
  email text,
  address text,
  total_purchases numeric not null default 0 check (total_purchases >= 0),
  total_pending numeric not null default 0,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

-- Indexes for customers
create index if not exists idx_customers_created_by on customers(created_by);
create index if not exists idx_customers_phone_tenant on customers(created_by, phone);

-- RLS for customers
alter table customers enable row level security;
create policy "Manage own customers" on customers
  for all using (created_by = auth.uid()) with check (created_by = auth.uid());


-- 4. SHOP_SETTINGS TABLE
create table if not exists shop_settings (
  id uuid default uuid_generate_v4() primary key,
  shop_name text not null default 'My Shop',
  owner_name text,
  phone text,
  email text,
  address text,
  gstin text,
  default_tax_percentage numeric not null default 0 check (default_tax_percentage >= 0),
  currency_symbol text not null default '₹',
  receipt_footer_message text default 'Thank you for your business!',
  bill_counter integer not null default 0,
  created_by uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

-- Indexes for shop_settings
create index if not exists idx_shop_settings_created_by on shop_settings(created_by);

-- RLS for shop_settings
alter table shop_settings enable row level security;
create policy "Manage own shop_settings" on shop_settings
  for all using (created_by = auth.uid()) with check (created_by = auth.uid());


-- 5. BILLS TABLE
create table if not exists bills (
  id uuid default uuid_generate_v4() primary key,
  bill_number integer not null,
  customer_id uuid references customers(id) on delete set null,
  subtotal numeric not null check (subtotal >= 0),
  tax_percentage numeric not null default 0 check (tax_percentage >= 0),
  tax_amount numeric not null default 0 check (tax_amount >= 0),
  grand_total numeric not null check (grand_total >= 0),
  amount_paid numeric not null default 0 check (amount_paid >= 0),
  pending_amount numeric not null default 0,
  status text not null check (status in ('Paid', 'Partial', 'Pending')),
  payment_method text not null check (payment_method in ('Cash', 'Card', 'UPI', 'Due', 'Mixed')),
  notes text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

-- Indexes for bills
create index if not exists idx_bills_created_by on bills(created_by);
create index if not exists idx_bills_customer on bills(customer_id);
create unique index if not exists idx_bills_number_tenant on bills(created_by, bill_number);

-- RLS for bills
alter table bills enable row level security;
create policy "Manage own bills" on bills
  for all using (created_by = auth.uid()) with check (created_by = auth.uid());


-- 6. BILL_ITEMS TABLE
create table if not exists bill_items (
  id uuid default uuid_generate_v4() primary key,
  bill_id uuid not null references bills(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  item_name text not null,
  quantity numeric not null check (quantity > 0),
  unit_price numeric not null check (unit_price >= 0),
  total numeric not null check (total >= 0)
);

-- Indexes for bill_items
create index if not exists idx_bill_items_bill on bill_items(bill_id);
create index if not exists idx_bill_items_product on bill_items(product_id);


-- 7. EXPENSES TABLE
create table if not exists expenses (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  amount numeric not null check (amount > 0),
  date date not null default current_date,
  category text not null,
  description text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

-- Indexes for expenses
create index if not exists idx_expenses_created_by on expenses(created_by);
create index if not exists idx_expenses_date_tenant on expenses(created_by, date);

-- RLS for expenses
alter table expenses enable row level security;
create policy "Manage own expenses" on expenses
  for all using (created_by = auth.uid()) with check (created_by = auth.uid());
