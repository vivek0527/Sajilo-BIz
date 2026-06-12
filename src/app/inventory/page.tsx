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
  Camera,
  Image as ImageIcon,
  FileText
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
  category_id: z.string().uuid().or(z.literal('')),
  selling_price: z.preprocess(
    (val) => (val === '' || val === undefined || val === null || isNaN(Number(val)) ? undefined : Number(val)),
    z.number({ invalid_type_error: 'Selling price is required' }).min(0.01, 'Selling price must be greater than 0')
  ),
  cost_price: z.preprocess(
    (val) => (val === '' || val === undefined || val === null || isNaN(Number(val)) ? undefined : Number(val)),
    z.number().min(0, 'Cost price cannot be negative').optional()
  ),
  mrp: z.preprocess(
    (val) => (val === '' || val === undefined || val === null || isNaN(Number(val)) ? undefined : Number(val)),
    z.number().min(0, 'MRP cannot be negative').optional()
  ),
  stock_quantity: z.preprocess(
    (val) => (val === '' || val === undefined || val === null || isNaN(Number(val)) ? undefined : Number(val)),
    z.number({ invalid_type_error: 'Stock quantity is required' }).min(0, 'Stock quantity cannot be negative')
  ),
  unit_value: z.preprocess(
    (val) => (val === '' || val === undefined || val === null || isNaN(Number(val)) ? undefined : Number(val)),
    z.number().min(0, 'Unit value cannot be negative').optional()
  ),
  unit: z.string().min(1, 'Unit is required'),
  barcode: z.string().optional(),
  low_stock_threshold: z.preprocess((val) => (val === '' || val === undefined || val === null ? 5 : Number(val)), z.number().min(0, 'Low stock threshold cannot be negative')).default(5),
  discount_percentage: z.preprocess(
    (val) => (val === '' || val === undefined || val === null || isNaN(Number(val)) ? undefined : Number(val)),
    z.number().optional()
  ),
});
type ProductFormInput = z.infer<typeof productSchema>;

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'products' | 'categories' | 'lowstock' | 'scanbill'>('products');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals state
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [prodModalOpen, setProdModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [barcodeScannerOpen, setBarcodeScannerOpen] = useState(false);

  // Bill Scanner state
  interface UploadedFile {
    id: string;
    file: File;
    name: string;
    size: number;
    url: string;
    status: 'pending' | 'scanning' | 'completed' | 'failed';
    error?: string;
  }
  
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanWarning, setScanWarning] = useState<string | null>(null);
  const [rawOcrLines, setRawOcrLines] = useState<string[]>([]);
  const [showRawLines, setShowRawLines] = useState(false);
  const [selectedPreviewFile, setSelectedPreviewFile] = useState<UploadedFile | null>(null);
  
  // Webcam capture state
  const [webcamActive, setWebcamActive] = useState(false);
  const [sessionCaptureCount, setSessionCaptureCount] = useState<number>(0);
  const [webcamDevices, setWebcamDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);

  // Scanned items to import
  const [scannedItems, setScannedItems] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);

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
    mutationFn: (data: ProductFormInput) => {
      const { discount_percentage, ...rest } = data;
      return dbClient.products.create({
        ...rest,
        category_id: rest.category_id || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setProdModalOpen(false);
    }
  });

  const updateProductMutation = useMutation({
    mutationFn: (data: { id: string; input: ProductFormInput }) => {
      const { discount_percentage, ...rest } = data.input;
      return dbClient.products.update(data.id, {
        ...rest,
        category_id: rest.category_id || undefined,
      });
    },
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
      category_id: '',
      selling_price: '' as any,
      cost_price: '' as any,
      stock_quantity: '' as any,
      unit: 'Piece',
      barcode: '',
      low_stock_threshold: 5,
      discount_percentage: '' as any
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
      category_id: categories.length > 0 ? categories[0].id : '',
      selling_price: '' as any,
      cost_price: '' as any,
      stock_quantity: '' as any,
      unit: 'Piece',
      barcode: '',
      low_stock_threshold: 5,
      discount_percentage: '' as any
    });
    setProdModalOpen(true);
  };

  const openEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    prodForm.reset({
      name: prod.name,
      category_id: prod.category_id || '',
      selling_price: Number(prod.selling_price),
      cost_price: prod.cost_price ? Number(prod.cost_price) : undefined,
      stock_quantity: Number(prod.stock_quantity),
      unit: prod.unit,
      barcode: prod.barcode || '',
      low_stock_threshold: prod.low_stock_threshold !== undefined ? Number(prod.low_stock_threshold) : 5,
      discount_percentage: (() => {
        const cost = prod.cost_price ? Number(prod.cost_price) : 0;
        const selling = Number(prod.selling_price);
        return cost > 0 && selling < cost ? Math.round(((cost - selling) / cost) * 100) : 0;
      })()
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newFiles: UploadedFile[] = Array.from(files).map(file => ({
        id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        name: file.name,
        size: file.size,
        url: URL.createObjectURL(file),
        status: 'pending'
      }));
      setUploadedFiles(prev => [...prev, ...newFiles]);
      if (!selectedPreviewFile && newFiles.length > 0) {
        setSelectedPreviewFile(newFiles[0]);
      }
      setScanError(null);
      setScanWarning(null);
      setImportResult(null);
    }
  };

  // Webcam stream handlers
  const startWebcam = async () => {
    setWebcamActive(true);
    setSessionCaptureCount(0);
    setScanError(null);
    // Give state updates time to render the video element
    setTimeout(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        
        // Enumerate webcam devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        setWebcamDevices(videoDevices);
        if (videoDevices.length > 0) {
          setSelectedCameraId(videoDevices[0].deviceId);
        }
      } catch (err: any) {
        console.error('Failed to open webcam:', err);
        setScanError('Could not access camera. Please check browser permissions.');
        setWebcamActive(false);
      }
    }, 100);
  };

  const handleCameraChange = async (deviceId: string) => {
    setSelectedCameraId(deviceId);
    stopWebcamStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Failed to switch camera:', err);
    }
  };

  const stopWebcamStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const stopWebcam = () => {
    stopWebcamStream();
    setWebcamActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `captured_bill_${Date.now()}.png`, { type: 'image/png' });
            const newFile: UploadedFile = {
              id: `capture-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              file,
              name: file.name,
              size: file.size,
              url: URL.createObjectURL(file),
              status: 'pending'
            };
            setUploadedFiles(prev => [...prev, newFile]);
            setSelectedPreviewFile(newFile);
            setSessionCaptureCount(prev => prev + 1);
            // Do not stop webcam stream to allow snapping multiple photos
          }
        }, 'image/png');
      }
    }
  };

  const handleRemoveFileFromQueue = (id: string) => {
    setUploadedFiles(prev => {
      const fileToRemove = prev.find(f => f.id === id);
      if (fileToRemove) {
        URL.revokeObjectURL(fileToRemove.url);
      }
      const filtered = prev.filter(f => f.id !== id);
      if (selectedPreviewFile?.id === id) {
        setSelectedPreviewFile(filtered.length > 0 ? filtered[0] : null);
      }
      return filtered;
    });
  };

  const handleScanBill = async () => {
    const pendingFiles = uploadedFiles.filter(f => f.status === 'pending' || f.status === 'failed');
    if (pendingFiles.length === 0) return;
    
    setScanning(true);
    setScanError(null);
    setScanWarning(null);
    setImportResult(null);
    
    let allOcrLines: string[] = [...rawOcrLines];
    let newScannedItems: any[] = [...scannedItems];
    
    // Process files sequentially
    for (const uFile of pendingFiles) {
      setUploadedFiles(prev => prev.map(f => f.id === uFile.id ? { ...f, status: 'scanning' } : f));
      
      const formData = new FormData();
      formData.append('file', uFile.file);
      
      try {
        const res = await fetch('/api/ocr', {
          method: 'POST',
          body: formData,
        });
        
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to scan bill');
        }
        
        if (data.warning) {
          setScanWarning(prev => prev ? `${prev} | ${data.warning}` : data.warning);
        }
        
        // Add divider line in raw output
        allOcrLines.push(`=== FILE: ${uFile.name} ===`);
        allOcrLines.push(...(data.raw_lines || []));
        
        // Auto-match names with existing items
        const items = (data.items || []).map((item: any, index: number) => {
          const existing = products.find(
            p => p.name.toLowerCase().includes(item.name.toLowerCase()) || 
                 item.name.toLowerCase().includes(p.name.toLowerCase())
          );
          
          return {
            id: `scanned-${index}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            originalName: item.name,
            originalPrice: item.cost_price,
            originalQty: item.quantity,
            fileName: uFile.name,
            
            action: existing ? 'update' : 'create',
            productId: existing ? existing.id : '',
            
            // Editable fields
            name: item.name,
            category_id: existing ? (existing.category_id || '') : (categories.length > 0 ? categories[0].id : ''),
            cost_price: item.cost_price,
            selling_price: existing ? existing.selling_price : Math.round(item.cost_price * 1.3),
            mrp: existing ? (existing.mrp || 0) : Math.round(item.cost_price * 1.4),
            stock_quantity: item.quantity,
            unit: existing ? existing.unit : 'Piece',
            unit_value: existing ? (existing.unit_value || '') : '',
            barcode: existing ? (existing.barcode || '') : '',
            low_stock_threshold: existing ? (existing.low_stock_threshold || 5) : 5,
          };
        });
        
        newScannedItems.push(...items);
        setUploadedFiles(prev => prev.map(f => f.id === uFile.id ? { ...f, status: 'completed' } : f));
      } catch (err: any) {
        console.error('Error scanning file:', uFile.name, err);
        setUploadedFiles(prev => prev.map(f => f.id === uFile.id ? { ...f, status: 'failed', error: err.message } : f));
        setScanError(prev => prev ? `${prev}\nFailed on ${uFile.name}: ${err.message}` : `Failed on ${uFile.name}: ${err.message}`);
      }
    }
    
    setRawOcrLines(allOcrLines);
    setScannedItems(newScannedItems);
    setScanning(false);
  };

  const handleImportScannedItems = async () => {
    if (scannedItems.length === 0) return;
    setImporting(true);
    setImportResult(null);
    let successCount = 0;
    let failedCount = 0;
    
    for (const item of scannedItems) {
      try {
        if (item.action === 'create') {
          await dbClient.products.create({
            name: item.name,
            category_id: item.category_id || undefined,
            cost_price: Number(item.cost_price) || 0,
            selling_price: Number(item.selling_price) || 0,
            mrp: Number(item.mrp) || undefined,
            stock_quantity: Number(item.stock_quantity) || 0,
            unit: item.unit,
            unit_value: item.unit_value ? Number(item.unit_value) : undefined,
            barcode: item.barcode || undefined,
            low_stock_threshold: Number(item.low_stock_threshold) || 5,
          });
        } else {
          const existing = products.find(p => p.id === item.productId);
          if (!existing) throw new Error('Product not found for update');
          
          const newStock = Number(existing.stock_quantity) + Number(item.stock_quantity);
          await dbClient.products.update(item.productId, {
            cost_price: Number(item.cost_price) || 0,
            selling_price: Number(item.selling_price) || 0,
            mrp: Number(item.mrp) || undefined,
            stock_quantity: newStock,
            barcode: item.barcode || undefined,
          });
        }
        successCount++;
      } catch (err) {
        console.error('Import failed for product:', item.name, err);
        failedCount++;
      }
    }
    
    queryClient.invalidateQueries({ queryKey: ['products'] });
    setImportResult({ success: successCount, failed: failedCount });
    setImporting(false);
    
    if (failedCount === 0) {
      setScannedItems([]);
      uploadedFiles.forEach(f => URL.revokeObjectURL(f.url));
      setUploadedFiles([]);
      setSelectedPreviewFile(null);
      setRawOcrLines([]);
    }
  };

  const handleScannedItemChange = (id: string, field: string, value: any) => {
    setScannedItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      
      const updatedItem = { ...item, [field]: value };
      
      // If action is changing, handle pre-filling
      if (field === 'action') {
        if (value === 'update' && item.productId) {
          const existing = products.find(p => p.id === item.productId);
          if (existing) {
            updatedItem.name = existing.name;
            updatedItem.category_id = existing.category_id || '';
            updatedItem.selling_price = existing.selling_price;
            updatedItem.mrp = existing.mrp || 0;
            updatedItem.unit = existing.unit;
            updatedItem.unit_value = existing.unit_value || '';
            updatedItem.barcode = existing.barcode || '';
            updatedItem.low_stock_threshold = existing.low_stock_threshold || 5;
          }
        } else if (value === 'create') {
          updatedItem.name = item.originalName;
          updatedItem.cost_price = item.originalPrice;
          updatedItem.selling_price = Math.round(item.originalPrice * 1.3);
          updatedItem.mrp = Math.round(item.originalPrice * 1.4);
          updatedItem.stock_quantity = item.originalQty;
          updatedItem.unit = 'Piece';
          updatedItem.unit_value = '';
          updatedItem.barcode = '';
          updatedItem.low_stock_threshold = 5;
        }
      }
      
      // If selected existing product is changing
      if (field === 'productId') {
        const existing = products.find(p => p.id === value);
        if (existing) {
          updatedItem.name = existing.name;
          updatedItem.category_id = existing.category_id || '';
          updatedItem.selling_price = existing.selling_price;
          updatedItem.mrp = existing.mrp || 0;
          updatedItem.unit = existing.unit;
          updatedItem.unit_value = existing.unit_value || '';
          updatedItem.barcode = existing.barcode || '';
          updatedItem.low_stock_threshold = existing.low_stock_threshold || 5;
        }
      }
      
      return updatedItem;
    }));
  };

  const handleRemoveScannedItem = (id: string) => {
    setScannedItems(prev => prev.filter(item => item.id !== id));
  };

  const handleAddManualItem = () => {
    setScannedItems(prev => [
      ...prev,
      {
        id: `manual-${Date.now()}`,
        originalName: '',
        originalPrice: 0,
        originalQty: 1,
        action: 'create',
        productId: '',
        name: 'New Product',
        category_id: categories.length > 0 ? categories[0].id : '',
        cost_price: 0,
        selling_price: 0,
        mrp: 0,
        stock_quantity: 1,
        unit: 'Piece',
        unit_value: '',
        barcode: '',
        low_stock_threshold: 5,
      }
    ]);
  };

  // Filtering products
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.barcode && p.barcode.includes(searchQuery));
    const matchesCategory = selectedCategoryFilter === '' || p.category_id === selectedCategoryFilter;
    
    let matchesDate = true;
    if (startDate || endDate) {
      const createdDateStr = new Date(p.created_at).toISOString().split('T')[0];
      if (startDate && createdDateStr < startDate) matchesDate = false;
      if (endDate && createdDateStr > endDate) matchesDate = false;
    }
    
    return matchesSearch && matchesCategory && matchesDate;
  });

  const lowStockProducts = products.filter(p => Number(p.stock_quantity) <= (p.low_stock_threshold !== undefined ? Number(p.low_stock_threshold) : 5));

  const filteredLowStockProducts = lowStockProducts.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.barcode && p.barcode.includes(searchQuery));
    const matchesCategory = selectedCategoryFilter === '' || p.category_id === selectedCategoryFilter;
    
    let matchesDate = true;
    if (startDate || endDate) {
      const createdDateStr = new Date(p.created_at).toISOString().split('T')[0];
      if (startDate && createdDateStr < startDate) matchesDate = false;
      if (endDate && createdDateStr > endDate) matchesDate = false;
    }
    
    return matchesSearch && matchesCategory && matchesDate;
  });

  const getStockBadgeColor = (qty: number, threshold = 5) => {
    if (qty === 0) return 'bg-red-500/10 text-red-500 border-red-500/20';
    if (qty <= threshold) return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
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
          className={`flex items-center gap-2 border-b-2 px-6 py-3 text-sm font-medium transition-all ${activeTab === 'products'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
        >
          <Package size={16} />
          Products ({products.length})
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`flex items-center gap-2 border-b-2 px-6 py-3 text-sm font-medium transition-all ${activeTab === 'categories'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
        >
          <FolderOpen size={16} />
          Categories ({categories.length})
        </button>
        <button
          onClick={() => setActiveTab('lowstock')}
          className={`flex items-center gap-2 border-b-2 px-6 py-3 text-sm font-medium transition-all ${activeTab === 'lowstock'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
        >
          <AlertTriangle size={16} />
          Low Stock <span className="ml-1 bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-0.5 rounded-full text-xs font-bold">{lowStockProducts.length}</span>
        </button>
        <button
          onClick={() => setActiveTab('scanbill')}
          className={`flex items-center gap-2 border-b-2 px-6 py-3 text-sm font-medium transition-all ${activeTab === 'scanbill'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
        >
          <FileSpreadsheet size={16} />
          Bill Scanner
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

            {/* Start Date */}
            <div className="relative min-w-0 sm:min-w-[150px]">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground text-[10px] uppercase font-bold">
                From
              </span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="block w-full rounded-xl border border-border bg-card pl-12 pr-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              />
            </div>

            {/* End Date */}
            <div className="relative min-w-0 sm:min-w-[150px]">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground text-[10px] uppercase font-bold">
                To
              </span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="block w-full rounded-xl border border-border bg-card pl-9 pr-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              />
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
                            <span className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-xs font-medium ${getStockBadgeColor(Number(p.stock_quantity), p.low_stock_threshold !== undefined ? Number(p.low_stock_threshold) : 5)}`}>
                              {p.stock_quantity}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-mono font-semibold">
                            {currencySymbol}{Number(p.selling_price).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 font-mono text-muted-foreground">
                            {p.cost_price ? `${currencySymbol}${Number(p.cost_price).toFixed(2)}` : '-'}
                          </td>
                          <td className="px-6 py-4 text-xs text-muted-foreground">
                            {p.unit_value ? `${p.unit_value} ${p.unit}` : p.unit}
                          </td>
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
                        <span className={`inline-flex items-center rounded-lg border px-2 py-0.5 font-medium ${getStockBadgeColor(Number(p.stock_quantity), p.low_stock_threshold !== undefined ? Number(p.low_stock_threshold) : 5)}`}>
                          Stock: {p.stock_quantity}
                        </span>
                        <span className="font-mono font-semibold text-foreground">{currencySymbol}{Number(p.selling_price).toFixed(2)}</span>
                        <span className="text-muted-foreground">
                          {p.unit_value ? `${p.unit_value} ${p.unit}` : p.unit}
                        </span>
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

      {/* LOW STOCK TAB CONTENT */}
      {activeTab === 'lowstock' && (
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

            {/* Start Date */}
            <div className="relative min-w-0 sm:min-w-[150px]">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground text-[10px] uppercase font-bold">
                From
              </span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="block w-full rounded-xl border border-border bg-card pl-12 pr-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              />
            </div>

            {/* End Date */}
            <div className="relative min-w-0 sm:min-w-[150px]">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground text-[10px] uppercase font-bold">
                To
              </span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="block w-full rounded-xl border border-border bg-card pl-9 pr-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              />
            </div>
          </div>

          {/* Low Stock Table */}
          {prodsLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="animate-spin text-primary" size={28} />
            </div>
          ) : filteredLowStockProducts.length === 0 ? (
            <div className="glass-panel flex flex-col items-center justify-center rounded-2xl p-12 text-center">
              <Package className="mb-4 text-emerald-500" size={32} />
              <h3 className="font-semibold text-foreground">Stock Levels are Healthy</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                There are no products currently at or below their low stock threshold.
              </p>
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
                      <th className="px-6 py-4">Threshold</th>
                      <th className="px-6 py-4">Selling Price</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-sm text-foreground">
                    {filteredLowStockProducts.map((p) => {
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
                            <span className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-xs font-medium ${getStockBadgeColor(Number(p.stock_quantity), p.low_stock_threshold !== undefined ? Number(p.low_stock_threshold) : 5)}`}>
                              {p.stock_quantity}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs font-mono text-muted-foreground">
                            {p.low_stock_threshold !== undefined ? p.low_stock_threshold : 5}
                          </td>
                          <td className="px-6 py-4 font-mono font-semibold">
                            {currencySymbol}{Number(p.selling_price).toFixed(2)}
                          </td>
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
                {filteredLowStockProducts.map((p) => {
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
                        <span className={`inline-flex items-center rounded-lg border px-2 py-0.5 font-medium ${getStockBadgeColor(Number(p.stock_quantity), p.low_stock_threshold !== undefined ? Number(p.low_stock_threshold) : 5)}`}>
                          Stock: {p.stock_quantity}
                        </span>
                        <span className="text-muted-foreground">Threshold: {p.low_stock_threshold !== undefined ? p.low_stock_threshold : 5}</span>
                        <span className="font-mono font-semibold text-foreground">{currencySymbol}{Number(p.selling_price).toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* BILL SCANNER TAB CONTENT */}
      {activeTab === 'scanbill' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Webcam / FileSelector Main Area */}
          {scannedItems.length === 0 && !scanning ? (
            <div className="space-y-6">
              
              {/* Webcam Feed Box */}
              {webcamActive ? (
                <div className="glass-panel flex flex-col items-center justify-center rounded-2xl p-6 text-center max-w-2xl mx-auto border-2 border-primary/30 shadow-xl bg-primary/5">
                  <div className="flex items-center justify-between w-full border-b border-border pb-3 mb-4">
                    <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                      <Camera size={16} className="text-primary animate-pulse" /> Live Camera Stream
                    </h4>
                    
                    {/* Camera selector */}
                    {webcamDevices.length > 1 && (
                      <select
                        value={selectedCameraId}
                        onChange={(e) => handleCameraChange(e.target.value)}
                        className="rounded-lg border border-border bg-card px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        {webcamDevices.map(device => (
                          <option key={device.deviceId} value={device.deviceId}>
                            {device.label || `Camera ${device.deviceId.substr(0, 5)}`}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  
                  <div className="rounded-xl overflow-hidden border border-border bg-black w-full aspect-video flex items-center justify-center relative">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {sessionCaptureCount > 0 && (
                    <div className="mt-3 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-500 text-xs font-semibold animate-pulse">
                      ✓ Snapshot #{sessionCaptureCount} successfully captured & added to queue!
                    </div>
                  )}
                  
                  <div className="mt-5 flex gap-3">
                    <button
                      onClick={stopWebcam}
                      className="rounded-xl border border-border px-5 py-2.5 text-xs font-semibold hover:bg-secondary text-foreground transition-all"
                    >
                      Close Camera
                    </button>
                    
                    <button
                      onClick={capturePhoto}
                      className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary/95 transition-all flex items-center gap-1.5"
                    >
                      <Camera size={16} /> Capture Photo
                    </button>
                  </div>
                </div>
              ) : (
                <div className="glass-panel rounded-2xl p-8 border border-border bg-secondary/10 shadow-xl space-y-8">
                  <div className="text-center max-w-lg mx-auto">
                    <h3 className="font-extrabold text-xl text-foreground tracking-tight">Scan Vendor Invoices & Bills</h3>
                    <p className="text-sm text-muted-foreground mt-2">
                      Upload PDF documents, high-resolution image receipts, or snap photos directly using your camera. PaddleOCR will automatically extract products, prices, and quantities.
                    </p>
                  </div>

                  <div className="grid gap-6 md:grid-cols-3">
                    {/* Card 1: Upload PDF */}
                    <label className="glass-panel-interactive flex flex-col items-center justify-center p-6 rounded-2xl cursor-pointer text-center group border border-border hover:border-primary/40 transition-all duration-300">
                      <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
                        <FileText size={24} />
                      </div>
                      <h4 className="font-bold text-sm text-foreground">Upload PDF</h4>
                      <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                        Select one or more PDF files. Supports multi-page billing.
                      </p>
                      <input
                        type="file"
                        accept="application/pdf"
                        multiple
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>

                    {/* Card 2: Upload Images */}
                    <label className="glass-panel-interactive flex flex-col items-center justify-center p-6 rounded-2xl cursor-pointer text-center group border border-border hover:border-primary/40 transition-all duration-300">
                      <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 mb-4 group-hover:scale-110 transition-transform">
                        <ImageIcon size={24} />
                      </div>
                      <h4 className="font-bold text-sm text-foreground">Upload Images</h4>
                      <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                        Select multiple receipt images from your device.
                      </p>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>

                    {/* Card 3: Capture Photo */}
                    <button
                      onClick={startWebcam}
                      className="glass-panel-interactive flex flex-col items-center justify-center p-6 rounded-2xl text-center group border border-border hover:border-primary/40 transition-all duration-300 w-full"
                    >
                      <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-4 group-hover:scale-110 transition-transform">
                        <Camera size={24} />
                      </div>
                      <h4 className="font-bold text-sm text-foreground">Capture Photo</h4>
                      <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                        Snap bill photos sequentially using your webcam.
                      </p>
                    </button>
                  </div>

                  {importResult && (
                    <div className="mt-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-500 flex flex-col items-center gap-1">
                      <span className="font-semibold">Import Completed Successfully!</span>
                      <span>Successfully imported/updated {importResult.success} products. {importResult.failed > 0 && `Failed to import ${importResult.failed} products.`}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Uploaded File Queue List */}
              {uploadedFiles.length > 0 && (
                <div className="glass-panel rounded-2xl p-6 border border-border space-y-4 max-w-xl mx-auto shadow-md">
                  <h4 className="font-bold text-sm text-foreground flex items-center justify-between">
                    <span>Uploaded Bills Queue ({uploadedFiles.length})</span>
                    <button 
                      onClick={() => {
                        uploadedFiles.forEach(f => URL.revokeObjectURL(f.url));
                        setUploadedFiles([]);
                        setSelectedPreviewFile(null);
                      }}
                      className="text-xs text-destructive hover:underline font-normal"
                    >
                      Clear Queue
                    </button>
                  </h4>
                  
                  <div className="divide-y divide-border/50 max-h-60 overflow-y-auto pr-1">
                    {uploadedFiles.map((file) => (
                      <div key={file.id} className="py-2.5 flex items-center justify-between text-xs gap-3">
                        <div className="min-w-0 flex-1 flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full shrink-0 ${
                            file.status === 'completed' ? 'bg-emerald-500' :
                            file.status === 'scanning' ? 'bg-primary animate-ping' :
                            file.status === 'failed' ? 'bg-red-500' : 'bg-muted-foreground'
                          }`} />
                          <button
                            onClick={() => setSelectedPreviewFile(file)}
                            className={`truncate hover:underline text-left font-medium ${
                              selectedPreviewFile?.id === file.id ? 'text-primary font-semibold' : 'text-foreground'
                            }`}
                          >
                            {file.name}
                          </button>
                          <span className="text-[10px] text-muted-foreground font-mono shrink-0">({(file.size / 1024).toFixed(1)} KB)</span>
                        </div>
                        
                        <div className="flex items-center gap-2 shrink-0">
                          {file.status === 'scanning' && <Loader2 className="animate-spin text-primary shrink-0" size={12} />}
                          {file.status === 'completed' && <span className="text-emerald-500 font-semibold">Ready</span>}
                          {file.status === 'failed' && <span className="text-red-500 font-semibold" title={file.error}>Failed</span>}
                          {file.status === 'pending' && <span className="text-muted-foreground">Queued</span>}
                          
                          <button
                            onClick={() => handleRemoveFileFromQueue(file.id)}
                            className="text-muted-foreground hover:text-destructive p-1 rounded hover:bg-secondary"
                            disabled={scanning}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-border flex justify-end">
                    <button
                      onClick={handleScanBill}
                      disabled={scanning || uploadedFiles.every(f => f.status === 'completed')}
                      className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary/95 transition-all flex items-center gap-2"
                    >
                      <Camera size={16} /> Analyze Bill Queue ({uploadedFiles.filter(f => f.status === 'pending' || f.status === 'failed').length} left)
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : scanning ? (
            <div className="glass-panel flex flex-col items-center justify-center rounded-2xl p-16 text-center">
              <div className="relative h-20 w-20 mb-6 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                <Camera className="text-primary animate-bounce" size={24} />
              </div>
              <h3 className="font-bold text-lg text-foreground">Scanning & Parsing Invoices...</h3>
              <div className="mt-4 space-y-2 max-w-sm w-full mx-auto">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Processing File Queue</span>
                  <span className="font-semibold text-primary animate-pulse">Running OCR</span>
                </div>
                <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full animate-[progress_3s_infinite_linear]" style={{ width: '75%' }} />
                </div>
                
                {uploadedFiles.find(f => f.status === 'scanning') && (
                  <p className="text-xs text-primary font-semibold mt-2 truncate">
                    Currently scanning: "{uploadedFiles.find(f => f.status === 'scanning')?.name}"
                  </p>
                )}
                
                <p className="text-xs text-muted-foreground pt-2">
                  Processing PDFs or snapping multiple files may take 10-30 seconds per file. Please keep this browser window active.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-12">
              
              {/* Left Column: Image / PDF Preview */}
              <div className="lg:col-span-4 space-y-4">
                
                {/* Visual file list manager */}
                <div className="glass-panel rounded-2xl p-4 border border-border space-y-3">
                  <h4 className="font-bold text-xs text-foreground uppercase tracking-wider text-muted-foreground border-b border-border pb-2 flex items-center justify-between">
                    <span>Scanned Queue</span>
                    <label className="text-[10px] text-primary hover:underline cursor-pointer">
                      + Add More
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        multiple
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  </h4>
                  
                  <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                    {uploadedFiles.map(file => (
                      <button
                        key={file.id}
                        onClick={() => setSelectedPreviewFile(file)}
                        className={`w-full text-left p-2 rounded-xl text-xs flex justify-between items-center transition-all ${
                          selectedPreviewFile?.id === file.id ? 'bg-primary/10 border border-primary/20 text-primary font-medium' : 'hover:bg-secondary/50 text-foreground border border-transparent'
                        }`}
                      >
                        <span className="truncate flex-1 pr-2">{file.name}</span>
                        <span className={`text-[10px] uppercase font-bold shrink-0 ${file.status === 'completed' ? 'text-emerald-500' : 'text-red-500'}`}>
                          {file.status === 'completed' ? 'Scanned' : 'Error'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview pane */}
                <div className="glass-panel rounded-2xl overflow-hidden p-4 flex flex-col h-fit">
                  <div className="flex items-center justify-between border-b border-border pb-3 mb-3">
                    <h4 className="font-semibold text-sm text-foreground flex items-center gap-2 truncate pr-2">
                      <Camera size={16} className="text-primary" />
                      <span className="truncate" title={selectedPreviewFile?.name || 'File Preview'}>
                        {selectedPreviewFile?.name || 'Preview'}
                      </span>
                    </h4>
                    <button
                      onClick={() => {
                        uploadedFiles.forEach(f => URL.revokeObjectURL(f.url));
                        setUploadedFiles([]);
                        setSelectedPreviewFile(null);
                        setScannedItems([]);
                        setRawOcrLines([]);
                      }}
                      className="text-xs text-destructive hover:underline shrink-0"
                    >
                      Clear All
                    </button>
                  </div>
                  
                  {selectedPreviewFile && (
                    <div className="rounded-xl overflow-hidden border border-border bg-secondary/35 flex items-center justify-center max-h-[450px] overflow-y-auto p-2 scrollbar-none relative">
                      {selectedPreviewFile.file.type === 'application/pdf' ? (
                        <div className="flex flex-col items-center justify-center p-8 text-center bg-card rounded-lg border border-border/80 shadow-sm w-full">
                          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3">
                            <FileSpreadsheet size={24} />
                          </div>
                          <span className="font-semibold text-xs text-foreground truncate max-w-full px-2">{selectedPreviewFile.name}</span>
                          <span className="text-[10px] text-muted-foreground mt-1 font-mono">PDF Document (Page Count Varies)</span>
                          <a
                            href={selectedPreviewFile.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-4 text-[10px] font-bold text-primary hover:underline"
                          >
                            Open PDF in New Tab
                          </a>
                        </div>
                      ) : (
                        <img
                          src={selectedPreviewFile.url}
                          alt="Scanned Bill Preview"
                          className="max-w-full h-auto object-contain rounded-lg shadow-sm"
                        />
                      )}
                    </div>
                  )}
                </div>

                {/* Raw lines toggle */}
                <div className="glass-panel rounded-2xl p-4">
                  <button
                    onClick={() => setShowRawLines(!showRawLines)}
                    className="flex items-center justify-between w-full text-left text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    <span>DEBUG: View Combined Raw OCR Text ({rawOcrLines.length} lines)</span>
                    <span>{showRawLines ? 'Hide' : 'Show'}</span>
                  </button>
                  
                  {showRawLines && rawOcrLines.length > 0 && (
                    <div className="mt-3 p-3 bg-secondary/50 rounded-xl max-h-48 overflow-y-auto text-[10px] font-mono text-muted-foreground space-y-1 select-all border border-border">
                      {rawOcrLines.map((line, idx) => (
                        <div key={idx} className={`border-b border-border/10 last:border-0 pb-1 ${
                          line.startsWith('=== FILE:') ? 'text-primary font-bold pt-2 border-b-primary/20' : ''
                        }`}>{line}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Aggregated Extracted Items Mapping */}
              <div className="lg:col-span-8 space-y-4">
                <div className="glass-panel rounded-2xl p-6 shadow-md border border-border space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4 gap-2">
                    <div>
                      <h3 className="font-bold text-base text-foreground">Extracted Products ({scannedItems.length})</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Verify and map parsed items from all files to your inventory.
                      </p>
                    </div>
                    
                    <button
                      onClick={handleAddManualItem}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground transition-all shrink-0"
                    >
                      <Plus size={12} /> Add Item Manually
                    </button>
                  </div>

                  {scanWarning && (
                    <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-500 flex items-center gap-2">
                      <AlertTriangle size={14} className="shrink-0" />
                      <span className="truncate">{scanWarning}</span>
                    </div>
                  )}

                  {scanError && (
                    <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-500 flex items-center gap-2">
                      <AlertTriangle size={14} className="shrink-0" />
                      <span className="truncate">{scanError}</span>
                    </div>
                  )}

                  {scannedItems.length === 0 ? (
                    <div className="py-12 text-center text-sm text-muted-foreground">
                      No items extracted. Try adding items manually or scanning another bill.
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1 scrollbar-thin">
                      {scannedItems.map((item, index) => (
                        <div key={item.id} className="relative p-4 rounded-xl border border-border bg-secondary/10 hover:border-primary/20 transition-all space-y-3">
                          {/* Trash button to exclude item */}
                          <button
                            onClick={() => handleRemoveScannedItem(item.id)}
                            className="absolute right-3 top-3 text-muted-foreground hover:text-destructive p-1 rounded-lg hover:bg-secondary transition-all"
                            title="Exclude from import"
                          >
                            <X size={14} />
                          </button>

                          {/* Scanned stats */}
                          <div className="flex flex-wrap gap-x-3 gap-y-1 items-center text-xs">
                            <span className="font-bold text-primary font-mono">Item #{index + 1}</span>
                            {item.originalName && (
                              <>
                                <span className="text-muted-foreground border-l border-border pl-3">
                                  Scanned Name: <span className="font-semibold text-foreground">"{item.originalName}"</span>
                                </span>
                                <span className="text-muted-foreground border-l border-border pl-3">
                                  Scanned Cost: <span className="font-mono font-semibold text-foreground">{currencySymbol}{item.originalPrice}</span>
                                </span>
                                <span className="text-muted-foreground border-l border-border pl-3">
                                  Scanned Qty: <span className="font-semibold text-foreground">{item.originalQty}</span>
                                </span>
                                {item.fileName && (
                                  <span className="text-[10px] text-muted-foreground border-l border-border pl-3 truncate max-w-[150px]" title={item.fileName}>
                                    From: <span className="font-semibold">{item.fileName}</span>
                                  </span>
                                )}
                              </>
                            )}
                            {!item.originalName && (
                              <span className="text-muted-foreground border-l border-border pl-3 font-semibold text-amber-500">
                                Manually Added Item
                              </span>
                            )}
                          </div>

                          {/* Action Selector: Create or Update */}
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1">
                              <label className="text-[10px] uppercase font-bold text-muted-foreground">Import Action</label>
                              <select
                                value={item.action}
                                onChange={(e) => handleScannedItemChange(item.id, 'action', e.target.value)}
                                className="block w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold focus:border-primary focus:outline-none"
                              >
                                <option value="create">Create New Product</option>
                                <option value="update">Update Existing Product</option>
                              </select>
                            </div>

                            {item.action === 'update' ? (
                              <div className="space-y-1">
                                <label className="text-[10px] uppercase font-bold text-muted-foreground">Select Product to Update *</label>
                                <select
                                  value={item.productId}
                                  onChange={(e) => handleScannedItemChange(item.id, 'productId', e.target.value)}
                                  className="block w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs focus:border-primary focus:outline-none"
                                >
                                  <option value="">-- Choose Inventory Product --</option>
                                  {products.map(p => (
                                    <option key={p.id} value={p.id}>
                                      {p.name} (Stock: {p.stock_quantity} {p.unit}, Cost: {currencySymbol}{p.cost_price || 0})
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <label className="text-[10px] uppercase font-bold text-muted-foreground">Category</label>
                                <select
                                  value={item.category_id}
                                  onChange={(e) => handleScannedItemChange(item.id, 'category_id', e.target.value)}
                                  className="block w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs focus:border-primary focus:outline-none"
                                >
                                  <option value="">Uncategorised</option>
                                  {categories.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>

                          {/* Editable Details Fields */}
                          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                            <div className="col-span-2 sm:col-span-2 space-y-1">
                              <label className="text-[10px] uppercase font-bold text-muted-foreground">Product Name</label>
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) => handleScannedItemChange(item.id, 'name', e.target.value)}
                                className="block w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs focus:border-primary focus:outline-none"
                                placeholder="Product Name"
                              />
                            </div>
                            
                            <div className="space-y-1">
                              <label className="text-[10px] uppercase font-bold text-muted-foreground">Unit of Measure</label>
                              <select
                                value={item.unit}
                                onChange={(e) => handleScannedItemChange(item.id, 'unit', e.target.value)}
                                className="block w-full rounded-lg border border-border bg-card px-2 py-1 text-xs focus:border-primary focus:outline-none"
                              >
                                <option value="Piece">Piece (pc)</option>
                                <option value="Kilogram">Kilogram (kg)</option>
                                <option value="Liter">Liter (L)</option>
                                <option value="Meter">Meter (m)</option>
                                <option value="Box">Box</option>
                                <option value="Packet">Packet</option>
                              </select>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] uppercase font-bold text-muted-foreground">Qty to Import</label>
                              <input
                                type="number"
                                value={item.stock_quantity}
                                onChange={(e) => handleScannedItemChange(item.id, 'stock_quantity', Number(e.target.value))}
                                className="block w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-mono focus:border-primary focus:outline-none"
                                placeholder="Qty"
                                min={0}
                              />
                            </div>
                            
                            <div className="space-y-1">
                              <label className="text-[10px] uppercase font-bold text-muted-foreground">Cost Price ({currencySymbol})</label>
                              <input
                                type="number"
                                step="0.01"
                                value={item.cost_price}
                                onChange={(e) => handleScannedItemChange(item.id, 'cost_price', Number(e.target.value))}
                                className="block w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-mono focus:border-primary focus:outline-none"
                                placeholder="Cost Price"
                                min={0}
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] uppercase font-bold text-muted-foreground">Selling Price ({currencySymbol})</label>
                              <input
                                type="number"
                                step="0.01"
                                value={item.selling_price}
                                onChange={(e) => handleScannedItemChange(item.id, 'selling_price', Number(e.target.value))}
                                className="block w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-mono focus:border-primary focus:outline-none"
                                placeholder="Selling Price"
                                min={0}
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] uppercase font-bold text-muted-foreground">MRP ({currencySymbol})</label>
                              <input
                                type="number"
                                step="0.01"
                                value={item.mrp}
                                onChange={(e) => handleScannedItemChange(item.id, 'mrp', Number(e.target.value))}
                                className="block w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-mono focus:border-primary focus:outline-none"
                                placeholder="MRP"
                                min={0}
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] uppercase font-bold text-muted-foreground">Barcode</label>
                              <input
                                type="text"
                                value={item.barcode}
                                onChange={(e) => handleScannedItemChange(item.id, 'barcode', e.target.value)}
                                className="block w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-mono focus:border-primary focus:outline-none"
                                placeholder="Barcode"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Bulk import execution section */}
                  {scannedItems.length > 0 && (
                    <div className="flex flex-wrap justify-between items-center pt-4 border-t border-border gap-4">
                      <button
                        onClick={() => {
                          setScannedItems([]);
                          uploadedFiles.forEach(f => URL.revokeObjectURL(f.url));
                          setUploadedFiles([]);
                          setSelectedPreviewFile(null);
                          setRawOcrLines([]);
                        }}
                        className="rounded-xl border border-border px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
                      >
                        Reset / Cancel
                      </button>
                      
                      <div className="flex gap-2">
                        {uploadedFiles.some(f => f.status === 'pending' || f.status === 'failed') && (
                          <button
                            onClick={handleScanBill}
                            disabled={scanning}
                            className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-2.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-all flex items-center gap-1.5"
                          >
                            <Camera size={14} /> Scan Pending Bills
                          </button>
                        )}
                        
                        <button
                          onClick={handleImportScannedItems}
                          disabled={importing || scannedItems.some(item => item.action === 'update' && !item.productId)}
                          className="rounded-xl bg-primary px-6 py-2.5 text-xs font-semibold text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {importing && <Loader2 className="animate-spin" size={12} />}
                          Import {scannedItems.length} Products to Inventory
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Content Size / Value</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 5"
                      {...prodForm.register('unit_value', {
                        valueAsNumber: true,
                        onChange: (e) => {
                          e.target.value = e.target.value.replace(/^0+(?=\d)/, '');
                        }
                      })}
                      className="block w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    />
                    {prodForm.formState.errors.unit_value && (
                      <p className="text-xs text-destructive">{prodForm.formState.errors.unit_value.message}</p>
                    )}
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
                </div>

                  <div className="grid gap-4 grid-cols-1 sm:grid-cols-4 sm:col-span-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">MRP ({currencySymbol})</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...prodForm.register('mrp', {
                        valueAsNumber: true,
                        onChange: (e) => {
                          e.target.value = e.target.value.replace(/^0+(?=\d)/, '');
                          const mrpVal = Number(e.target.value) || 0;
                          const disc = Number(prodForm.getValues('discount_percentage')) || 0;
                          if (mrpVal > 0) {
                            const calculated = mrpVal * (1 - disc / 100);
                            prodForm.setValue('selling_price', Number(calculated.toFixed(2)));
                          }
                        }
                      })}
                      onFocus={(e) => e.target.select()}
                      className="block w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm focus:border-primary focus:outline-none font-mono"
                    />
                    {prodForm.formState.errors.mrp && (
                      <p className="text-xs text-destructive">{prodForm.formState.errors.mrp.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Cost Price ({currencySymbol})</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...prodForm.register('cost_price', {
                        valueAsNumber: true,
                        onChange: (e) => {
                          e.target.value = e.target.value.replace(/^0+(?=\d)/, '');
                        }
                      })}
                      onFocus={(e) => e.target.select()}
                      className="block w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm focus:border-primary focus:outline-none font-mono"
                    />
                    {prodForm.formState.errors.cost_price && (
                      <p className="text-xs text-destructive">{prodForm.formState.errors.cost_price.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Discount (%)</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="0"
                      {...prodForm.register('discount_percentage', {
                        valueAsNumber: true,
                        onChange: (e) => {
                          e.target.value = e.target.value.replace(/^0+(?=\d)/, '');
                          const disc = Number(e.target.value) || 0;
                          const mrpVal = Number(prodForm.getValues('mrp')) || 0;
                          if (mrpVal > 0) {
                            const calculated = mrpVal * (1 - disc / 100);
                            prodForm.setValue('selling_price', Number(calculated.toFixed(2)));
                          }
                        }
                      })}
                      onFocus={(e) => e.target.select()}
                      className="block w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm focus:border-primary focus:outline-none font-mono"
                    />
                    {prodForm.formState.errors.discount_percentage && (
                      <p className="text-xs text-destructive">{prodForm.formState.errors.discount_percentage.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Selling Price ({currencySymbol}) *</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...prodForm.register('selling_price', {
                        valueAsNumber: true,
                        onChange: (e) => {
                          e.target.value = e.target.value.replace(/^0+(?=\d)/, '');
                        }
                      })}
                      onFocus={(e) => e.target.select()}
                      className="block w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm focus:border-primary focus:outline-none font-mono"
                    />
                    {prodForm.formState.errors.selling_price && (
                      <p className="text-xs text-destructive">{prodForm.formState.errors.selling_price.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Stock Quantity *</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0"
                    {...prodForm.register('stock_quantity', {
                      valueAsNumber: true,
                      onChange: (e) => {
                        e.target.value = e.target.value.replace(/^0+(?=\d)/, '');
                      }
                    })}
                    onFocus={(e) => e.target.select()}
                    className="block w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm focus:border-primary focus:outline-none font-mono"
                  />
                  {prodForm.formState.errors.stock_quantity && (
                    <p className="text-xs text-destructive">{prodForm.formState.errors.stock_quantity.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Low Stock Alert Level</label>
                  <input
                    type="number"
                    step="1"
                    placeholder="5"
                    {...prodForm.register('low_stock_threshold', {
                      valueAsNumber: true,
                      onChange: (e) => {
                        e.target.value = e.target.value.replace(/^0+(?=\d)/, '');
                      }
                    })}
                    onFocus={(e) => e.target.select()}
                    className="block w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm focus:border-primary focus:outline-none font-mono"
                  />
                  {prodForm.formState.errors.low_stock_threshold && (
                    <p className="text-xs text-destructive">{prodForm.formState.errors.low_stock_threshold.message}</p>
                  )}
                </div>

                <div className="space-y-1.5 sm:col-span-2">
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
                    <div className="mt-2">
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
