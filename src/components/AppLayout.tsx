'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useUIStore } from '@/lib/store';
import { dbClient } from '@/lib/db';
import Sidebar from './Sidebar';
import HeaderBar from './HeaderBar';
import { Loader2 } from 'lucide-react';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, setUser, sidebarOpen, setSidebarOpen } = useUIStore();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const verifyUser = async () => {
      // Allow auth pages and receipt print pages without layout and session redirect
      if (pathname.startsWith('/auth') || pathname.startsWith('/receipts')) {
        setCheckingAuth(false);
        return;
      }

      try {
        const currentUser = await dbClient.auth.getUser();
        if (!currentUser) {
          router.push('/auth/login');
        } else {
          setUser(currentUser);
          setCheckingAuth(false);
        }
      } catch (err) {
        console.error('Auth verification error:', err);
        router.push('/auth/login');
      }
    };

    verifyUser();
  }, [pathname, router, setUser]);

  // Collapse sidebar initially on mobile viewports
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, [setSidebarOpen]);

  // Close sidebar on path change in mobile viewports
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, [pathname, setSidebarOpen]);

  if (pathname.startsWith('/auth') || pathname.startsWith('/receipts')) {
    return <>{children}</>;
  }

  if (checkingAuth) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="animate-spin text-primary" size={32} />
        <span className="text-sm text-muted-foreground">Verifying secure session...</span>
      </div>
    );
  }

  // Determine section title based on pathname
  let pageTitle = 'Dashboard';
  if (pathname.startsWith('/inventory')) pageTitle = 'Inventory Management';
  else if (pathname.startsWith('/billing/new')) pageTitle = 'Billing Console';
  else if (pathname.startsWith('/billing/all')) pageTitle = 'Invoices History';
  else if (pathname.startsWith('/billing/')) pageTitle = 'Invoice Details';
  else if (pathname.startsWith('/customers')) pageTitle = 'Customer Relations';
  else if (pathname.startsWith('/expenses')) pageTitle = 'Expense Tracker';
  else if (pathname.startsWith('/accounts')) pageTitle = 'Accounts & Analytics';
  else if (pathname.startsWith('/settings')) pageTitle = 'Shop Settings';

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-xs md:hidden no-print"
        />
      )}
      <div
        className={`flex flex-col min-h-screen transition-all duration-300 ${
          sidebarOpen ? 'md:pl-64' : 'md:pl-20'
        }`}
      >
        <HeaderBar title={pageTitle} />
        <main className="flex-1 p-3 sm:p-6 md:p-8">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
