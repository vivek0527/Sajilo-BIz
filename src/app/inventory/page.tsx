'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { dbClient } from '@/lib/db';
import { Category, Product, ShopSettings } from '@/lib/types';
import dynamic from 'next/dynamic';

const BarcodeScanner = dynamic(() => import('@/components/BarcodeScanner'), { ssr: false });
import {
  Package,
  FolderOpen,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Loader2,
  AlertTriangle,
  FileSpreadsheet,
  X,
  Camera
} from 'lucide-react';

// Form Zod Schemas
const categorySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color code'),
});
type CategoryFormInput = z.infer<typeof categorySchema>;

const productSchema = z.object({
  name: z.string().min(2, 'Product name must be at least 2 characters'),
  description: z.string().optional(),
  category_id: z.string().uuid().or(z.literal('')),
  selling_price: z.number().min(0.01, 'Selling price must be greater than 0'),
  cost_price: z.number().min(0, 'Cost price cannot be negative').optional(),
  stock_quantity: z.number().min(0, 'Stock quantity cannot be negative'),
  unit: z.string().min(1, 'Unit is required'),
  barcode: z.string().optional(),
});
type ProductFormInput = z.infer<typeof productSchema>;

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'products' | 'categories'>('products');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');

  // Modals state
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [prodModalOpen, setProdModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [barcodeScannerOpen, setBarcodeScannerOpen] = useState(false);

  // Queries
  const { data: settings } = useQuery<ShopSettings>({
    queryKey: ['settings'],
    queryFn: dbClient.shopSettings.get,
  });

  const { data: categories = [], isLoading: catsLoading } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: dbClient.categories.list,
  });

  const { data: products = [], isLoading: prodsLoading } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: dbClient.products.list,
  });

  // Mutators for Categories
  const createCategoryMutation = useMutation({
    mutationFn: (data: CategoryFormInput) => dbClient.categories.create(data.name, data.description, data.color),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setCatModalOpen(false);
    }
  });

  const updateCategoryMutation = useMutation({
    mutationFn: (data: { id: string; input: CategoryFormInput }) =>
      dbClient.categories.update(data.id, data.input.name, data.input.description, data.input.color),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setCatModalOpen(false);
      setEditingCategory(null);
    }
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: dbClient.categories.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    }
  });

  // Mutators for Products
  const createProductMutation = useMutation({
    mutationFn: (data: ProductFormInput) => dbClient.products.create({
      ...data,
      category_id: data.category_id || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setProdModalOpen(false);
    }
  });

  const updateProductMutation = useMutation({
    mutationFn: (data: { id: string; input: ProductFormInput }) =>
      dbClient.products.update(data.id, {
        ...data.input,
        category_id: data.input.category_id || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setProdModalOpen(false);
      setEditingProduct(null);
    }
  });

  const deleteProductMutation = useMutation({
    mutationFn: dbClient.products.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    }
  });

  // Forms setup
  const catForm = useForm<CategoryFormInput>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: '', description: '', color: '#6366f1' }
  });

  const prodForm = useForm<ProductFormInput>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      description: '',
      category_id: '',
      selling_price: 0,
      cost_price: 0,
      stock_quantity: 0,
      unit: 'Piece',
      barcode: ''
    }
  });

  const openAddCategory = () => {
    setEditingCategory(null);
    catForm.reset({ name: '', description: '', color: '#6366f1' });
    setCatModalOpen(true);
  };

  const openEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    catForm.reset({
      name: cat.name,
      description: cat.description || '',
      color: cat.color
    });
    setCatModalOpen(true);
  };

  const openAddProduct = () => {
    setEditingProduct(null);
    prodForm.reset({
      name: '',
      description: '',
      category_id: categories.length > 0 ? categories[0].id : '',
      selling_price: 0,
      cost_price: 0,
      stock_quantity: 0,
      unit: 'Piece',
      barcode: ''
    });
    setProdModalOpen(true);
  };

  const openEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    prodForm.reset({
      name: prod.name,
      description: prod.description || '',
      category_id: prod.category_id || '',
      selling_price: Number(prod.selling_price),
      cost_price: prod.cost_price ? Number(prod.cost_price) : undefined,
      stock_quantity: Number(prod.stock_quantity),
      unit: prod.unit,
      barcode: prod.barcode || ''
    });
    setProdModalOpen(true);
  };

  const handleCatSubmit = (data: CategoryFormInput) => {
    if (editingCategory) {
      updateCategoryMutation.mutate({ id: editingCategory.id, input: data });
    } else {
      createCategoryMutation.mutate(data);
    }
  };

  const handleProdSubmit = (data: ProductFormInput) => {
    if (editingProduct) {
      updateProductMutation.mutate({ id: editingProduct.id, input: data });
    } else {
      createProductMutation.mutate(data);
    }
  };

  const handleDeleteCategory = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete the category "${name}"? Products inside this category will become uncategorised.`)) {
      deleteCategoryMutation.mutate(id);
    }
  };

  const handleDeleteProduct = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
      deleteProductMutation.mutate(id);
    }
  };

  // Filtering products
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (p.barcode && p.barcode.includes(searchQuery));
    const matchesCategory = selectedCategoryFilter === '' || p.category_id === selectedCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  const getStockBadgeColor = (qty: number) => {
    if (qty === 0) return 'bg-red-500/10 text-red-500 border-red-500/20';
    if (qty < 10) return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
  };

  const currencySymbol = settings?.currency_symbol || '₹';

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Package className="text-primary" size={24} /> Inventory Management
          </h2>
          <p className="text-sm text-muted-foreground hidden sm:block">
            Monitor and configure your store products, categories, stock, and pricing models.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          {activeTab === 'products' ? (
            <button
              onClick={openAddProduct}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/95 transition-all"
            >
              <Plus size={16} /> Add Product
            </button>
          ) : (
            <button
              onClick={openAddCategory}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/95 transition-all"
            >
              <Plus size={16} /> Add Category
            </button>
          )}
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-border overflow-x-auto scrollbar-none whitespace-nowrap">
        <button
          onClick={() => setActiveTab('products')}
          className={`flex items-center gap-2 border-b-2 px-6 py-3 text-sm font-medium transition-all ${
            activeTab === 'products'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Package size={16} />
          Products ({products.length})
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`flex items-center gap-2 border-b-2 px-6 py-3 text-sm font-medium transition-all ${
            activeTab === 'categories'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <FolderOpen size={16} />
          Categories ({categories.length})
        </button>
      </div>

      {/* PRODUCTS TAB CONTENT */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col gap-4 sm:flex-row">
            {/* Search */}
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                <Search size={18} />
              </span>
              <input
                type="text"
                placeholder="Search products by name or barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full rounded-xl border border-border bg-card px-10 py-2.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Category Filter */}
            <div className="relative min-w-0 sm:min-w-[200px]">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                <Filter size={14} />
              </span>
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="block w-full rounded-xl border border-border bg-card pl-9 pr-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Products Table */}
          {prodsLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="animate-spin text-primary" size={28} />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="glass-panel flex flex-col items-center justify-center rounded-2xl p-12 text-center">
              <AlertTriangle className="mb-4 text-muted-foreground" size={32} />
              <h3 className="font-semibold text-foreground">No Products Found</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Try adjusting your search query, selecting another category, or add your first product to get started.
              </p>
              <button
                onClick={openAddProduct}
                className="mt-4 flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-4 py-2 text-xs font-semibold text-primary hover:bg-primary/20"
              >
                <Plus size={12} /> Add Product
              </button>
            </div>
          ) : (
            <div className="glass-panel overflow-hidden rounded-2xl border border-border shadow-md">
              {/* Desktop Table */}
              <div className="overflow-x-auto hidden md:block">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-secondary/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <th className="px-6 py-4">Name</th>
                      <th className="px-6 py-4">Category</th>
                      <th className="px-6 py-4">Stock</th>
                      <th className="px-6 py-4">Selling Price</th>
                      <th className="px-6 py-4">Cost Price</th>
                      <th className="px-6 py-4">Unit</th>
                      <th className="px-6 py-4">Barcode</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-sm text-foreground">
                    {filteredProducts.map((p) => {
                      const cat = categories.find(c => c.id === p.category_id);
                      return (
                        <tr key={p.id} className="hover:bg-secondary/25 transition-all">
                          <td className="px-6 py-4 font-medium">{p.name}</td>
                          <td className="px-6 py-4">
                            {cat ? (
                              <span
                                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border"
                                style={{
                                  backgroundColor: `${cat.color}15`,
                                  borderColor: `${cat.color}30`,
                                  color: cat.color
                                }}
                              >
                                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
                                {cat.name}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">Uncategorised</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-xs font-medium ${getStockBadgeColor(Number(p.stock_quantity))}`}>
                              {p.stock_quantity}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-mono font-semibold">
                            {currencySymbol}{Number(p.selling_price).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 font-mono text-muted-foreground">
                            {p.cost_price ? `${currencySymbol}${Number(p.cost_price).toFixed(2)}` : '-'}
                          </td>
                          <td className="px-6 py-4 text-xs text-muted-foreground">{p.unit}</td>
                          <td className="px-6 py-4 text-xs text-muted-foreground font-mono">{p.barcode || '-'}</td>
                          <td className="px-6 py-4 text-right space-x-2">
                            <button
                              onClick={() => openEditProduct(p)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(p.id, p.name)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-destructive/20 text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden divide-y divide-border">
                {filteredProducts.map((p) => {
                  const cat = categories.find(c => c.id === p.category_id);
                  return (
                    <div key={p.id} className="p-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-sm text-foreground">{p.name}</div>
                          {cat && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border mt-1"
                              style={{
                                backgroundColor: `${cat.color}15`,
                                borderColor: `${cat.color}30`,
                                color: cat.color
                              }}
                            >
                              <span className="h-1 w-1 rounded-full" style={{ backgroundColor: cat.color }} />
                              {cat.name}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button
                            onClick={() => openEditProduct(p)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(p.id, p.name)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-destructive/20 text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className={`inline-flex items-center rounded-lg border px-2 py-0.5 font-medium ${getStockBadgeColor(Number(p.stock_quantity))}`}>
                          Stock: {p.stock_quantity}
                        </span>
                        <span className="font-mono font-semibold text-foreground">{currencySymbol}{Number(p.selling_price).toFixed(2)}</span>
                        <span className="text-muted-foreground">{p.unit}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CATEGORIES TAB CONTENT */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          {catsLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="animate-spin text-primary" size={28} />
            </div>
          ) : categories.length === 0 ? (
            <div className="glass-panel flex flex-col items-center justify-center rounded-2xl p-12 text-center">
              <FolderOpen className="mb-4 text-muted-foreground" size={32} />
              <h3 className="font-semibold text-foreground">No Categories Found</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Create categories to group your products logically (e.g. Beverages, Electronics, Groceries).
              </p>
              <button
                onClick={openAddCategory}
                className="mt-4 flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-4 py-2 text-xs font-semibold text-primary hover:bg-primary/20"
              >
                <Plus size={12} /> Add Category
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((cat) => {
                const catProductCount = products.filter(p => p.category_id === cat.id).length;
                return (
                  <div key={cat.id} className="glass-panel-interactive rounded-2xl p-6 flex flex-col justify-between h-40">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border"
                          style={{
                            backgroundColor: `${cat.color}15`,
                            borderColor: `${cat.color}30`,
                            color: cat.color
                          }}
                        >
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
                          {cat.name}
                        </span>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => openEditCategory(cat)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(cat.id, cat.name)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-destructive/20 text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-2">{cat.description || 'No description provided.'}</p>
                    </div>
                    <div className="border-t border-border/50 pt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Products inside:</span>
                      <span className="font-semibold text-foreground">{catProductCount}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CATEGORY DIALOG MODAL */}
      {catModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setCatModalOpen(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            >
              <X size={18} />
            </button>
            <h3 className="text-lg font-bold text-foreground">
              {editingCategory ? 'Edit Category' : 'Add New Category'}
            </h3>
            <form onSubmit={catForm.handleSubmit(handleCatSubmit)} className="space-y-4 mt-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Category Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Beverages"
                  {...catForm.register('name')}
                  className="block w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
                {catForm.formState.errors.name && (
                  <p className="text-xs text-destructive">{catForm.formState.errors.name.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Description</label>
                <textarea
                  placeholder="Explain what products are categorized here..."
                  rows={2}
                  {...catForm.register('description')}
                  className="block w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Color Badge</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    {...catForm.register('color')}
                    className="h-8 w-16 cursor-pointer border border-border rounded"
                  />
                  <input
                    type="text"
                    {...catForm.register('color')}
                    className="block w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm focus:border-primary focus:outline-none font-mono"
                  />
                </div>
                {catForm.formState.errors.color && (
                  <p className="text-xs text-destructive">{catForm.formState.errors.color.message}</p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setCatModalOpen(false)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending}
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5"
                >
                  {(createCategoryMutation.isPending || updateCategoryMutation.isPending) && (
                    <Loader2 className="animate-spin" size={12} />
                  )}
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRODUCT DIALOG MODAL */}
      {prodModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-xl rounded-2xl p-6 shadow-xl relative max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setProdModalOpen(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            >
              <X size={18} />
            </button>
            <h3 className="text-lg font-bold text-foreground">
              {editingProduct ? 'Edit Product' : 'Add New Product'}
            </h3>
            
            {categories.length === 0 && (
              <div className="mt-4 rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 text-xs text-amber-500 flex items-center gap-2">
                <AlertTriangle size={16} />
                <span>We suggest adding a category first, but you can create uncategorised items.</span>
              </div>
            )}

            <form onSubmit={prodForm.handleSubmit(handleProdSubmit)} className="space-y-4 mt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-medium text-foreground">Product Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Coca-Cola 300ml"
                    {...prodForm.register('name')}
                    className="block w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                  {prodForm.formState.errors.name && (
                    <p className="text-xs text-destructive">{prodForm.formState.errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-medium text-foreground">Description</label>
                  <textarea
                    placeholder="Provide details about size, flavor, pack, etc..."
                    rows={2}
                    {...prodForm.register('description')}
                    className="block w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Category</label>
                  <select
                    {...prodForm.register('category_id')}
                    className="block w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  >
                    <option value="">Uncategorised</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Unit of Measurement *</label>
                  <select
                    {...prodForm.register('unit')}
                    className="block w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  >
                    <option value="Piece">Piece (pc)</option>
                    <option value="Kilogram">Kilogram (kg)</option>
                    <option value="Liter">Liter (L)</option>
                    <option value="Meter">Meter (m)</option>
                    <option value="Box">Box</option>
                    <option value="Packet">Packet</option>
                  </select>
                  {prodForm.formState.errors.unit && (
                    <p className="text-xs text-destructive">{prodForm.formState.errors.unit.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Selling Price ({currencySymbol}) *</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    {...prodForm.register('selling_price', { valueAsNumber: true })}
                    className="block w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm focus:border-primary focus:outline-none font-mono"
                  />
                  {prodForm.formState.errors.selling_price && (
                    <p className="text-xs text-destructive">{prodForm.formState.errors.selling_price.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Cost Price ({currencySymbol})</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    {...prodForm.register('cost_price', { valueAsNumber: true })}
                    className="block w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm focus:border-primary focus:outline-none font-mono"
                  />
                  {prodForm.formState.errors.cost_price && (
                    <p className="text-xs text-destructive">{prodForm.formState.errors.cost_price.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Stock Quantity *</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0"
                    {...prodForm.register('stock_quantity', { valueAsNumber: true })}
                    className="block w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm focus:border-primary focus:outline-none font-mono"
                  />
                  {prodForm.formState.errors.stock_quantity && (
                    <p className="text-xs text-destructive">{prodForm.formState.errors.stock_quantity.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Barcode (optional)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Scan or type barcode"
                      {...prodForm.register('barcode')}
                      className="block w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm focus:border-primary focus:outline-none font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setBarcodeScannerOpen(!barcodeScannerOpen)}
                      className="flex items-center gap-1.5 shrink-0 rounded-xl bg-primary/10 border border-primary/20 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/20 transition-all"
                    >
                      <Camera size={14} /> {barcodeScannerOpen ? 'Close' : 'Scan'}
                    </button>
                  </div>
                  {barcodeScannerOpen && (
                    <div className="border border-border rounded-xl overflow-hidden bg-card mt-2">
                      <BarcodeScanner
                        onScan={(barcode) => {
                          prodForm.setValue('barcode', barcode);
                          setBarcodeScannerOpen(false);
                        }}
                        onClose={() => setBarcodeScannerOpen(false)}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-border mt-6">
                <button
                  type="button"
                  onClick={() => setProdModalOpen(false)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createProductMutation.isPending || updateProductMutation.isPending}
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5"
                >
                  {(createProductMutation.isPending || updateProductMutation.isPending) && (
                    <Loader2 className="animate-spin" size={12} />
                  )}
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
