import { createClient } from '@supabase/supabase-js';
import { Category, Product, Customer, ShopSettings, Bill, BillItem, Expense, User } from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

const isMock = !supabase;

// Helper to generate UUID
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// LocalStorage Keys
const KEYS = {
  SESSION: 'sb_session',
  USERS: 'sb_users',
  CATEGORIES: 'sb_categories',
  PRODUCTS: 'sb_products',
  CUSTOMERS: 'sb_customers',
  SETTINGS: 'sb_settings',
  BILLS: 'sb_bills',
  BILL_ITEMS: 'sb_bill_items',
  EXPENSES: 'sb_expenses',
};

// Safe LocalStorage Helpers
const getStorageItem = <T>(key: string, defaultValue: T): T => {
  if (typeof window === 'undefined') return defaultValue;
  const item = localStorage.getItem(key);
  return item ? JSON.parse(item) : defaultValue;
};

const setStorageItem = <T>(key: string, value: T): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
};

// Mock Auth Client
const mockAuth = {
  signUp: async (email: string, password: string, shopName: string) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const users = getStorageItem<any[]>(KEYS.USERS, []);
    
    if (users.find(u => u.email === email)) {
      throw new Error('User already exists');
    }

    const newUser: User = {
      id: generateUUID(),
      email,
      shop_name: shopName,
    };

    users.push({ ...newUser, password });
    setStorageItem(KEYS.USERS, users);

    // Create default settings for the new tenant
    const settingsList = getStorageItem<ShopSettings[]>(KEYS.SETTINGS, []);
    const newSettings: ShopSettings = {
      id: generateUUID(),
      shop_name: shopName,
      owner_name: email.split('@')[0],
      phone: '',
      email: email,
      address: '',
      gstin: '',
      default_tax_percentage: 0,
      currency_symbol: '₹',
      receipt_footer_message: 'Thank you for shopping with us!',
      bill_counter: 0,
      created_by: newUser.id,
      created_at: new Date().toISOString(),
    };
    settingsList.push(newSettings);
    setStorageItem(KEYS.SETTINGS, settingsList);

    // Log the user in
    setStorageItem(KEYS.SESSION, newUser);
    return { user: newUser, error: null };
  },

  signIn: async (email: string, password: string) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const users = getStorageItem<any[]>(KEYS.USERS, []);
    const user = users.find(u => u.email === email && u.password === password);

    if (!user) {
      throw new Error('Invalid email or password');
    }

    const sessionUser: User = {
      id: user.id,
      email: user.email,
      shop_name: user.shop_name,
    };

    setStorageItem(KEYS.SESSION, sessionUser);
    return { user: sessionUser, error: null };
  },

  signOut: async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(KEYS.SESSION);
    }
    return { error: null };
  },

  getUser: (): User | null => {
    return getStorageItem<User | null>(KEYS.SESSION, null);
  }
};

// Database CRUD interface
export const dbClient = {
  isMockMode: () => isMock,

  auth: {
    signUp: async (email: string, password: string, shopName: string) => {
      if (!isMock && supabase) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user) {
          // Create settings row
          const { error: settingsError } = await supabase.from('shop_settings').insert({
            created_by: data.user.id,
            shop_name: shopName,
            email: email,
          });
          if (settingsError) console.error('Error creating shop settings:', settingsError);
        }
        return { 
          user: data.user ? { id: data.user.id, email: data.user.email || '', shop_name: shopName } : null, 
          error: null 
        };
      }
      return mockAuth.signUp(email, password, shopName);
    },

    signIn: async (email: string, password: string) => {
      if (!isMock && supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return { 
          user: data.user ? { id: data.user.id, email: data.user.email || '' } : null, 
          error: null 
        };
      }
      return mockAuth.signIn(email, password);
    },

    signOut: async () => {
      if (!isMock && supabase) {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        return { error: null };
      }
      return mockAuth.signOut();
    },

    getUser: async (): Promise<User | null> => {
      if (!isMock && supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        return user ? { id: user.id, email: user.email || '' } : null;
      }
      return mockAuth.getUser();
    }
  },

  categories: {
    list: async (): Promise<Category[]> => {
      const user = await dbClient.auth.getUser();
      if (!user) throw new Error('Unauthorized');

      if (!isMock && supabase) {
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .order('name', { ascending: true });
        if (error) throw error;
        return data as Category[];
      }

      const categories = getStorageItem<Category[]>(KEYS.CATEGORIES, []);
      return categories
        .filter(c => c.created_by === user.id)
        .sort((a, b) => a.name.localeCompare(b.name));
    },

    create: async (name: string, description = '', color = '#6366f1'): Promise<Category> => {
      const user = await dbClient.auth.getUser();
      if (!user) throw new Error('Unauthorized');

      if (!isMock && supabase) {
        const { data, error } = await supabase
          .from('categories')
          .insert({ name, description, color, created_by: user.id })
          .select()
          .single();
        if (error) throw error;
        return data as Category;
      }

      const categories = getStorageItem<Category[]>(KEYS.CATEGORIES, []);
      const newCategory: Category = {
        id: generateUUID(),
        name,
        description,
        color,
        created_by: user.id,
        created_at: new Date().toISOString(),
      };
      categories.push(newCategory);
      setStorageItem(KEYS.CATEGORIES, categories);
      return newCategory;
    },

    update: async (id: string, name: string, description = '', color = '#6366f1'): Promise<Category> => {
      const user = await dbClient.auth.getUser();
      if (!user) throw new Error('Unauthorized');

      if (!isMock && supabase) {
        const { data, error } = await supabase
          .from('categories')
          .update({ name, description, color })
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return data as Category;
      }

      const categories = getStorageItem<Category[]>(KEYS.CATEGORIES, []);
      const index = categories.findIndex(c => c.id === id && c.created_by === user.id);
      if (index === -1) throw new Error('Category not found');

      categories[index] = {
        ...categories[index],
        name,
        description,
        color,
      };
      setStorageItem(KEYS.CATEGORIES, categories);
      return categories[index];
    },

    delete: async (id: string): Promise<void> => {
      const user = await dbClient.auth.getUser();
      if (!user) throw new Error('Unauthorized');

      if (!isMock && supabase) {
        const { error } = await supabase.from('categories').delete().eq('id', id);
        if (error) throw error;
        return;
      }

      const categories = getStorageItem<Category[]>(KEYS.CATEGORIES, []);
      const filtered = categories.filter(c => !(c.id === id && c.created_by === user.id));
      setStorageItem(KEYS.CATEGORIES, filtered);
    }
  },

  products: {
    list: async (): Promise<Product[]> => {
      const user = await dbClient.auth.getUser();
      if (!user) throw new Error('Unauthorized');

      if (!isMock && supabase) {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .order('name', { ascending: true });
        if (error) throw error;
        return data as Product[];
      }

      const products = getStorageItem<Product[]>(KEYS.PRODUCTS, []);
      return products
        .filter(p => p.created_by === user.id)
        .sort((a, b) => a.name.localeCompare(b.name));
    },

    create: async (product: Omit<Product, 'id' | 'created_by' | 'created_at'>): Promise<Product> => {
      const user = await dbClient.auth.getUser();
      if (!user) throw new Error('Unauthorized');

      if (!isMock && supabase) {
        const { data, error } = await supabase
          .from('products')
          .insert({ ...product, created_by: user.id })
          .select()
          .single();
        if (error) throw error;
        return data as Product;
      }

      const products = getStorageItem<Product[]>(KEYS.PRODUCTS, []);
      const newProduct: Product = {
        ...product,
        id: generateUUID(),
        created_by: user.id,
        created_at: new Date().toISOString(),
      };
      products.push(newProduct);
      setStorageItem(KEYS.PRODUCTS, products);
      return newProduct;
    },

    update: async (id: string, product: Partial<Omit<Product, 'id' | 'created_by' | 'created_at'>>): Promise<Product> => {
      const user = await dbClient.auth.getUser();
      if (!user) throw new Error('Unauthorized');

      if (!isMock && supabase) {
        const { data, error } = await supabase
          .from('products')
          .update(product)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return data as Product;
      }

      const products = getStorageItem<Product[]>(KEYS.PRODUCTS, []);
      const index = products.findIndex(p => p.id === id && p.created_by === user.id);
      if (index === -1) throw new Error('Product not found');

      products[index] = {
        ...products[index],
        ...product,
      } as Product;
      setStorageItem(KEYS.PRODUCTS, products);
      return products[index];
    },

    delete: async (id: string): Promise<void> => {
      const user = await dbClient.auth.getUser();
      if (!user) throw new Error('Unauthorized');

      if (!isMock && supabase) {
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) throw error;
        return;
      }

      const products = getStorageItem<Product[]>(KEYS.PRODUCTS, []);
      const filtered = products.filter(p => !(p.id === id && p.created_by === user.id));
      setStorageItem(KEYS.PRODUCTS, filtered);
    }
  },

  customers: {
    list: async (): Promise<Customer[]> => {
      const user = await dbClient.auth.getUser();
      if (!user) throw new Error('Unauthorized');

      if (!isMock && supabase) {
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .order('name', { ascending: true });
        if (error) throw error;
        return data as Customer[];
      }

      const customers = getStorageItem<Customer[]>(KEYS.CUSTOMERS, []);
      return customers
        .filter(c => c.created_by === user.id)
        .sort((a, b) => a.name.localeCompare(b.name));
    },

    create: async (customer: Omit<Customer, 'id' | 'created_by' | 'created_at' | 'total_purchases' | 'total_pending'>): Promise<Customer> => {
      const user = await dbClient.auth.getUser();
      if (!user) throw new Error('Unauthorized');

      if (!isMock && supabase) {
        const { data, error } = await supabase
          .from('customers')
          .insert({ ...customer, created_by: user.id })
          .select()
          .single();
        if (error) throw error;
        return data as Customer;
      }

      const customers = getStorageItem<Customer[]>(KEYS.CUSTOMERS, []);
      const newCustomer: Customer = {
        ...customer,
        id: generateUUID(),
        total_purchases: 0,
        total_pending: 0,
        created_by: user.id,
        created_at: new Date().toISOString(),
      };
      customers.push(newCustomer);
      setStorageItem(KEYS.CUSTOMERS, customers);
      return newCustomer;
    },

    update: async (id: string, customer: Partial<Omit<Customer, 'id' | 'created_by' | 'created_at'>>): Promise<Customer> => {
      const user = await dbClient.auth.getUser();
      if (!user) throw new Error('Unauthorized');

      if (!isMock && supabase) {
        const { data, error } = await supabase
          .from('customers')
          .update(customer)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return data as Customer;
      }

      const customers = getStorageItem<Customer[]>(KEYS.CUSTOMERS, []);
      const index = customers.findIndex(c => c.id === id && c.created_by === user.id);
      if (index === -1) throw new Error('Customer not found');

      customers[index] = {
        ...customers[index],
        ...customer,
      } as Customer;
      setStorageItem(KEYS.CUSTOMERS, customers);
      return customers[index];
    },

    delete: async (id: string): Promise<void> => {
      const user = await dbClient.auth.getUser();
      if (!user) throw new Error('Unauthorized');

      if (!isMock && supabase) {
        const { error } = await supabase.from('customers').delete().eq('id', id);
        if (error) throw error;
        return;
      }

      const customers = getStorageItem<Customer[]>(KEYS.CUSTOMERS, []);
      const filtered = customers.filter(c => !(c.id === id && c.created_by === user.id));
      setStorageItem(KEYS.CUSTOMERS, filtered);
    }
  },

  shopSettings: {
    get: async (): Promise<ShopSettings> => {
      const user = await dbClient.auth.getUser();
      if (!user) throw new Error('Unauthorized');

      if (!isMock && supabase) {
        const { data, error } = await supabase
          .from('shop_settings')
          .select('*')
          .eq('created_by', user.id)
          .maybeSingle();
        if (error) throw error;
        if (data) return data as ShopSettings;

        // Create if missing
        const { data: newData, error: insertError } = await supabase
          .from('shop_settings')
          .insert({ created_by: user.id, shop_name: user.shop_name || 'My Shop' })
          .select()
          .single();
        if (insertError) throw insertError;
        return newData as ShopSettings;
      }

      const settings = getStorageItem<ShopSettings[]>(KEYS.SETTINGS, []);
      let userSettings = settings.find(s => s.created_by === user.id);
      if (!userSettings) {
        userSettings = {
          id: generateUUID(),
          shop_name: user.shop_name || 'My Shop',
          owner_name: user.email.split('@')[0],
          phone: '',
          email: user.email,
          address: '',
          gstin: '',
          default_tax_percentage: 0,
          currency_symbol: '₹',
          receipt_footer_message: 'Thank you for shopping with us!',
          bill_counter: 0,
          created_by: user.id,
          created_at: new Date().toISOString(),
        };
        settings.push(userSettings);
        setStorageItem(KEYS.SETTINGS, settings);
      }
      return userSettings;
    },

    update: async (data: Partial<Omit<ShopSettings, 'id' | 'created_by' | 'created_at'>>): Promise<ShopSettings> => {
      const user = await dbClient.auth.getUser();
      if (!user) throw new Error('Unauthorized');

      if (!isMock && supabase) {
        const { data: updatedData, error } = await supabase
          .from('shop_settings')
          .update(data)
          .eq('created_by', user.id)
          .select()
          .single();
        if (error) throw error;
        return updatedData as ShopSettings;
      }

      const settings = getStorageItem<ShopSettings[]>(KEYS.SETTINGS, []);
      const index = settings.findIndex(s => s.created_by === user.id);
      if (index === -1) throw new Error('Settings not found');

      settings[index] = {
        ...settings[index],
        ...data,
      } as ShopSettings;
      setStorageItem(KEYS.SETTINGS, settings);
      return settings[index];
    }
  },

  expenses: {
    list: async (): Promise<Expense[]> => {
      const user = await dbClient.auth.getUser();
      if (!user) throw new Error('Unauthorized');

      if (!isMock && supabase) {
        const { data, error } = await supabase
          .from('expenses')
          .select('*')
          .order('date', { ascending: false });
        if (error) throw error;
        return data as Expense[];
      }

      const expenses = getStorageItem<Expense[]>(KEYS.EXPENSES, []);
      return expenses
        .filter(e => e.created_by === user.id)
        .sort((a, b) => b.date.localeCompare(a.date));
    },

    create: async (expense: Omit<Expense, 'id' | 'created_by' | 'created_at'>): Promise<Expense> => {
      const user = await dbClient.auth.getUser();
      if (!user) throw new Error('Unauthorized');

      if (!isMock && supabase) {
        const { data, error } = await supabase
          .from('expenses')
          .insert({ ...expense, created_by: user.id })
          .select()
          .single();
        if (error) throw error;
        return data as Expense;
      }

      const expenses = getStorageItem<Expense[]>(KEYS.EXPENSES, []);
      const newExpense: Expense = {
        ...expense,
        id: generateUUID(),
        created_by: user.id,
        created_at: new Date().toISOString(),
      };
      expenses.push(newExpense);
      setStorageItem(KEYS.EXPENSES, expenses);
      return newExpense;
    },

    update: async (id: string, expense: Partial<Omit<Expense, 'id' | 'created_by' | 'created_at'>>): Promise<Expense> => {
      const user = await dbClient.auth.getUser();
      if (!user) throw new Error('Unauthorized');

      if (!isMock && supabase) {
        const { data, error } = await supabase
          .from('expenses')
          .update(expense)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return data as Expense;
      }

      const expenses = getStorageItem<Expense[]>(KEYS.EXPENSES, []);
      const index = expenses.findIndex(e => e.id === id && e.created_by === user.id);
      if (index === -1) throw new Error('Expense not found');

      expenses[index] = {
        ...expenses[index],
        ...expense,
      } as Expense;
      setStorageItem(KEYS.EXPENSES, expenses);
      return expenses[index];
    },

    delete: async (id: string): Promise<void> => {
      const user = await dbClient.auth.getUser();
      if (!user) throw new Error('Unauthorized');

      if (!isMock && supabase) {
        const { error } = await supabase.from('expenses').delete().eq('id', id);
        if (error) throw error;
        return;
      }

      const expenses = getStorageItem<Expense[]>(KEYS.EXPENSES, []);
      const filtered = expenses.filter(e => !(e.id === id && e.created_by === user.id));
      setStorageItem(KEYS.EXPENSES, filtered);
    }
  },

  bills: {
    list: async (): Promise<Bill[]> => {
      const user = await dbClient.auth.getUser();
      if (!user) throw new Error('Unauthorized');

      if (!isMock && supabase) {
        const { data, error } = await supabase
          .from('bills')
          .select('*, customers(*)')
          .order('bill_number', { ascending: false });
        if (error) throw error;
        return data.map(b => ({
          ...b,
          customer: b.customers
        })) as Bill[];
      }

      const bills = getStorageItem<Bill[]>(KEYS.BILLS, []);
      const customers = getStorageItem<Customer[]>(KEYS.CUSTOMERS, []);

      return bills
        .filter(b => b.created_by === user.id)
        .map(b => ({
          ...b,
          customer: customers.find(c => c.id === b.customer_id)
        }))
        .sort((a, b) => b.bill_number - a.bill_number);
    },

    get: async (id: string): Promise<Bill | null> => {
      const user = await dbClient.auth.getUser();
      if (!user) throw new Error('Unauthorized');

      if (!isMock && supabase) {
        const { data: bill, error: billError } = await supabase
          .from('bills')
          .select('*, customers(*)')
          .eq('id', id)
          .single();
        if (billError) throw billError;

        const { data: items, error: itemsError } = await supabase
          .from('bill_items')
          .select('*')
          .eq('bill_id', id);
        if (itemsError) throw itemsError;

        return {
          ...bill,
          customer: bill.customers,
          items: items as BillItem[]
        } as Bill;
      }

      const bills = getStorageItem<Bill[]>(KEYS.BILLS, []);
      const bill = bills.find(b => b.id === id && b.created_by === user.id);
      if (!bill) return null;

      const customers = getStorageItem<Customer[]>(KEYS.CUSTOMERS, []);
      const billItems = getStorageItem<BillItem[]>(KEYS.BILL_ITEMS, []);

      return {
        ...bill,
        customer: customers.find(c => c.id === bill.customer_id),
        items: billItems.filter(item => item.bill_id === id)
      };
    },

    create: async (
      billData: Omit<Bill, 'id' | 'bill_number' | 'created_by' | 'created_at' | 'customer' | 'items'>,
      items: Omit<BillItem, 'id' | 'bill_id'>[]
    ): Promise<Bill> => {
      const user = await dbClient.auth.getUser();
      if (!user) throw new Error('Unauthorized');

      if (!isMock && supabase) {
        // Step 1: Update shop settings counter in a transaction/RPC or sequential call
        const settings = await dbClient.shopSettings.get();
        const nextBillNumber = settings.bill_counter + 1;
        await dbClient.shopSettings.update({ bill_counter: nextBillNumber });

        // Step 2: Insert the bill
        const { data: newBill, error: billError } = await supabase
          .from('bills')
          .insert({
            ...billData,
            bill_number: nextBillNumber,
            created_by: user.id
          })
          .select()
          .single();
        if (billError) throw billError;

        // Step 3: Insert the items
        const itemsToInsert = items.map(item => ({
          ...item,
          bill_id: newBill.id
        }));
        const { error: itemsError } = await supabase.from('bill_items').insert(itemsToInsert);
        if (itemsError) throw itemsError;

        // Step 4: Decrement stock for each product
        for (const item of items) {
          if (item.product_id) {
            const { data: product } = await supabase
              .from('products')
              .select('stock_quantity')
              .eq('id', item.product_id)
              .single();
            if (product) {
              await supabase
                .from('products')
                .update({ stock_quantity: Number(product.stock_quantity) - Number(item.quantity) })
                .eq('id', item.product_id);
            }
          }
        }

        // Step 5: Update Customer Totals
        if (billData.customer_id) {
          const { data: customer } = await supabase
            .from('customers')
            .select('total_purchases, total_pending')
            .eq('id', billData.customer_id)
            .single();
          if (customer) {
            await supabase
              .from('customers')
              .update({
                total_purchases: Number(customer.total_purchases) + Number(billData.grand_total),
                total_pending: Number(customer.total_pending) + Number(billData.pending_amount)
              })
              .eq('id', billData.customer_id);
          }
        }

        return newBill as Bill;
      }

      // Mock implementation
      // 1. Get/Increment settings
      const settings = await dbClient.shopSettings.get();
      const nextBillNumber = settings.bill_counter + 1;
      await dbClient.shopSettings.update({ bill_counter: nextBillNumber });

      const billId = generateUUID();

      // 2. Create bill items
      const billItems = getStorageItem<BillItem[]>(KEYS.BILL_ITEMS, []);
      const newItems: BillItem[] = items.map(item => ({
        ...item,
        id: generateUUID(),
        bill_id: billId
      }));
      billItems.push(...newItems);
      setStorageItem(KEYS.BILL_ITEMS, billItems);

      // 3. Deduct stock from products
      const products = getStorageItem<Product[]>(KEYS.PRODUCTS, []);
      newItems.forEach(item => {
        if (item.product_id) {
          const prodIdx = products.findIndex(p => p.id === item.product_id && p.created_by === user.id);
          if (prodIdx !== -1) {
            products[prodIdx].stock_quantity = Math.max(0, products[prodIdx].stock_quantity - item.quantity);
          }
        }
      });
      setStorageItem(KEYS.PRODUCTS, products);

      // 4. Update customer aggregates
      if (billData.customer_id) {
        const customers = getStorageItem<Customer[]>(KEYS.CUSTOMERS, []);
        const custIdx = customers.findIndex(c => c.id === billData.customer_id && c.created_by === user.id);
        if (custIdx !== -1) {
          customers[custIdx].total_purchases += billData.grand_total;
          customers[custIdx].total_pending += billData.pending_amount;
        }
        setStorageItem(KEYS.CUSTOMERS, customers);
      }

      // 5. Create bill
      const bills = getStorageItem<Bill[]>(KEYS.BILLS, []);
      const newBill: Bill = {
        ...billData,
        id: billId,
        bill_number: nextBillNumber,
        created_by: user.id,
        created_at: new Date().toISOString()
      };
      bills.push(newBill);
      setStorageItem(KEYS.BILLS, bills);

      return newBill;
    },

    delete: async (id: string): Promise<void> => {
      const user = await dbClient.auth.getUser();
      if (!user) throw new Error('Unauthorized');

      const bill = await dbClient.bills.get(id);
      if (!bill) throw new Error('Bill not found');

      if (!isMock && supabase) {
        // Restore stock
        if (bill.items) {
          for (const item of bill.items) {
            if (item.product_id) {
              const { data: product } = await supabase
                .from('products')
                .select('stock_quantity')
                .eq('id', item.product_id)
                .single();
              if (product) {
                await supabase
                  .from('products')
                  .update({ stock_quantity: Number(product.stock_quantity) + Number(item.quantity) })
                  .eq('id', item.product_id);
              }
            }
          }
        }

        // Adjust customer totals
        if (bill.customer_id) {
          const { data: customer } = await supabase
            .from('customers')
            .select('total_purchases, total_pending')
            .eq('id', bill.customer_id)
            .single();
          if (customer) {
            await supabase
              .from('customers')
              .update({
                total_purchases: Math.max(0, Number(customer.total_purchases) - Number(bill.grand_total)),
                total_pending: Number(customer.total_pending) - Number(bill.pending_amount)
              })
              .eq('id', bill.customer_id);
          }
        }

        // Delete bill (cascade deletes bill items in supabase)
        const { error } = await supabase.from('bills').delete().eq('id', id);
        if (error) throw error;
        return;
      }

      // Mock implementation
      // 1. Restore stock
      const products = getStorageItem<Product[]>(KEYS.PRODUCTS, []);
      const billItems = getStorageItem<BillItem[]>(KEYS.BILL_ITEMS, []);
      const currentBillItems = billItems.filter(item => item.bill_id === id);

      currentBillItems.forEach(item => {
        if (item.product_id) {
          const prodIdx = products.findIndex(p => p.id === item.product_id && p.created_by === user.id);
          if (prodIdx !== -1) {
            products[prodIdx].stock_quantity += item.quantity;
          }
        }
      });
      setStorageItem(KEYS.PRODUCTS, products);

      // 2. Adjust customer totals
      if (bill.customer_id) {
        const customers = getStorageItem<Customer[]>(KEYS.CUSTOMERS, []);
        const custIdx = customers.findIndex(c => c.id === bill.customer_id && c.created_by === user.id);
        if (custIdx !== -1) {
          customers[custIdx].total_purchases = Math.max(0, customers[custIdx].total_purchases - bill.grand_total);
          customers[custIdx].total_pending = customers[custIdx].total_pending - bill.pending_amount;
        }
        setStorageItem(KEYS.CUSTOMERS, customers);
      }

      // 3. Delete records
      const bills = getStorageItem<Bill[]>(KEYS.BILLS, []);
      setStorageItem(KEYS.BILLS, bills.filter(b => b.id !== id));
      setStorageItem(KEYS.BILL_ITEMS, billItems.filter(item => item.bill_id !== id));
    },

    updatePayment: async (id: string, amount: number): Promise<Bill> => {
      const user = await dbClient.auth.getUser();
      if (!user) throw new Error('Unauthorized');

      const bill = await dbClient.bills.get(id);
      if (!bill) throw new Error('Bill not found');

      const newPaid = Number(bill.amount_paid) + amount;
      const newPending = Math.max(0, Number(bill.grand_total) - newPaid);
      const newStatus = newPaid >= Number(bill.grand_total) ? 'Paid' : 'Partial';

      if (!isMock && supabase) {
        const { data, error } = await supabase
          .from('bills')
          .update({ amount_paid: newPaid, pending_amount: newPending, status: newStatus })
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;

        if (bill.customer_id) {
          const { data: customer } = await supabase
            .from('customers')
            .select('total_pending')
            .eq('id', bill.customer_id)
            .single();
          if (customer) {
            await supabase
              .from('customers')
              .update({ total_pending: Number(customer.total_pending) - amount })
              .eq('id', bill.customer_id);
          }
        }

        return data as Bill;
      }

      // Mock
      const bills = getStorageItem<Bill[]>(KEYS.BILLS, []);
      const index = bills.findIndex(b => b.id === id && b.created_by === user.id);
      if (index === -1) throw new Error('Bill not found');

      bills[index] = {
        ...bill,
        amount_paid: newPaid,
        pending_amount: newPending,
        status: newStatus
      };
      setStorageItem(KEYS.BILLS, bills);

      if (bill.customer_id) {
        const customers = getStorageItem<Customer[]>(KEYS.CUSTOMERS, []);
        const custIdx = customers.findIndex(c => c.id === bill.customer_id && c.created_by === user.id);
        if (custIdx !== -1) {
          customers[custIdx].total_pending = customers[custIdx].total_pending - amount;
        }
        setStorageItem(KEYS.CUSTOMERS, customers);
      }

      return bills[index];
    },

    update: async (
      id: string,
      billData: Omit<Bill, 'id' | 'bill_number' | 'created_by' | 'created_at' | 'customer' | 'items'>,
      items: Omit<BillItem, 'id' | 'bill_id'>[]
    ): Promise<Bill> => {
      const user = await dbClient.auth.getUser();
      if (!user) throw new Error('Unauthorized');

      const oldBill = await dbClient.bills.get(id);
      if (!oldBill) throw new Error('Bill not found');

      if (!isMock && supabase) {
        // 1. Restore old stocks
        if (oldBill.items) {
          for (const item of oldBill.items) {
            if (item.product_id) {
              const { data: product } = await supabase
                .from('products')
                .select('stock_quantity')
                .eq('id', item.product_id)
                .single();
              if (product) {
                await supabase
                  .from('products')
                  .update({ stock_quantity: Number(product.stock_quantity) + Number(item.quantity) })
                  .eq('id', item.product_id);
              }
            }
          }
        }

        // 2. Revert customer aggregates
        if (oldBill.customer_id) {
          const { data: customer } = await supabase
            .from('customers')
            .select('total_purchases, total_pending')
            .eq('id', oldBill.customer_id)
            .single();
          if (customer) {
            await supabase
              .from('customers')
              .update({
                total_purchases: Math.max(0, Number(customer.total_purchases) - Number(oldBill.grand_total)),
                total_pending: Number(customer.total_pending) - Number(oldBill.pending_amount)
              })
              .eq('id', oldBill.customer_id);
          }
        }

        // 3. Delete old items
        const { error: deleteError } = await supabase.from('bill_items').delete().eq('bill_id', id);
        if (deleteError) throw deleteError;

        // 4. Update the bill
        const { data: updatedBill, error: billError } = await supabase
          .from('bills')
          .update({
            ...billData,
            customer_id: billData.customer_id || null,
          })
          .eq('id', id)
          .select()
          .single();
        if (billError) throw billError;

        // 5. Insert new items
        const itemsToInsert = items.map(item => ({
          ...item,
          bill_id: id
        }));
        const { error: itemsError } = await supabase.from('bill_items').insert(itemsToInsert);
        if (itemsError) throw itemsError;

        // 6. Deduct new stocks
        for (const item of items) {
          if (item.product_id) {
            const { data: product } = await supabase
              .from('products')
              .select('stock_quantity')
              .eq('id', item.product_id)
              .single();
            if (product) {
              await supabase
                .from('products')
                .update({ stock_quantity: Number(product.stock_quantity) - Number(item.quantity) })
                .eq('id', item.product_id);
            }
          }
        }

        // 7. Apply new customer aggregates
        if (billData.customer_id) {
          const { data: customer } = await supabase
            .from('customers')
            .select('total_purchases, total_pending')
            .eq('id', billData.customer_id)
            .single();
          if (customer) {
            await supabase
              .from('customers')
              .update({
                total_purchases: Number(customer.total_purchases) + Number(billData.grand_total),
                total_pending: Number(customer.total_pending) + Number(billData.pending_amount)
              })
              .eq('id', billData.customer_id);
          }
        }

        return updatedBill as Bill;
      }

      // Mock
      // 1. Restore old stocks
      const products = getStorageItem<Product[]>(KEYS.PRODUCTS, []);
      const oldBillItems = getStorageItem<BillItem[]>(KEYS.BILL_ITEMS, []);
      const currentOldBillItems = oldBillItems.filter(item => item.bill_id === id);

      currentOldBillItems.forEach(item => {
        if (item.product_id) {
          const prodIdx = products.findIndex(p => p.id === item.product_id && p.created_by === user.id);
          if (prodIdx !== -1) {
            products[prodIdx].stock_quantity += item.quantity;
          }
        }
      });

      // 2. Revert old customer aggregates
      if (oldBill.customer_id) {
        const customers = getStorageItem<Customer[]>(KEYS.CUSTOMERS, []);
        const custIdx = customers.findIndex(c => c.id === oldBill.customer_id && c.created_by === user.id);
        if (custIdx !== -1) {
          customers[custIdx].total_purchases = Math.max(0, customers[custIdx].total_purchases - oldBill.grand_total);
          customers[custIdx].total_pending = customers[custIdx].total_pending - oldBill.pending_amount;
        }
        setStorageItem(KEYS.CUSTOMERS, customers);
      }

      // 3. Remove old bill items from db
      const filteredBillItems = oldBillItems.filter(item => item.bill_id !== id);

      // 4. Create new bill items
      const newItems: BillItem[] = items.map(item => ({
        ...item,
        id: generateUUID(),
        bill_id: id
      }));
      filteredBillItems.push(...newItems);
      setStorageItem(KEYS.BILL_ITEMS, filteredBillItems);

      // 5. Deduct new stocks
      newItems.forEach(item => {
        if (item.product_id) {
          const prodIdx = products.findIndex(p => p.id === item.product_id && p.created_by === user.id);
          if (prodIdx !== -1) {
            products[prodIdx].stock_quantity = Math.max(0, products[prodIdx].stock_quantity - item.quantity);
          }
        }
      });
      setStorageItem(KEYS.PRODUCTS, products);

      // 6. Apply new customer aggregates
      if (billData.customer_id) {
        const customers = getStorageItem<Customer[]>(KEYS.CUSTOMERS, []);
        const custIdx = customers.findIndex(c => c.id === billData.customer_id && c.created_by === user.id);
        if (custIdx !== -1) {
          customers[custIdx].total_purchases += billData.grand_total;
          customers[custIdx].total_pending += billData.pending_amount;
        }
        setStorageItem(KEYS.CUSTOMERS, customers);
      }

      // 7. Update bill in list
      const bills = getStorageItem<Bill[]>(KEYS.BILLS, []);
      const billIndex = bills.findIndex(b => b.id === id && b.created_by === user.id);
      if (billIndex === -1) throw new Error('Bill not found');

      bills[billIndex] = {
        ...bills[billIndex],
        ...billData,
        customer_id: billData.customer_id || undefined,
      };
      setStorageItem(KEYS.BILLS, bills);

      return bills[billIndex];
    }
  }
};
