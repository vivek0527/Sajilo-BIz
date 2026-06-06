'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useUIStore } from '@/lib/store';
import { dbClient } from '@/lib/db';
import {
  LayoutDashboard,
  Package,
  Receipt,
  Users,
  TrendingDown,
  BarChart3,
  Settings,
  LogOut,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface SidebarProps {
  // no props needed
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { sidebarOpen, theme, toggleSidebar, toggleTheme, user, setUser } = useUIStore();

  const handleSignOut = async () => {
    try {
      await dbClient.auth.signOut();
      setUser(null);
      router.push('/auth/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const menuItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Inventory', href: '/inventory', icon: Package },
    { name: 'Billing Console', href: '/billing/new', icon: Receipt },
    { name: 'All Invoices', href: '/billing/all', icon: Receipt },
    { name: 'Customers', href: '/customers', icon: Users },
    { name: 'Expenses', href: '/expenses', icon: TrendingDown },
    { name: 'Accounts', href: '/accounts', icon: BarChart3 },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <aside
      className={`no-print fixed top-0 left-0 z-40 h-screen border-r border-border bg-card/90 backdrop-blur-md transition-all duration-300 ${sidebarOpen
        ? 'translate-x-0 w-64'
        : '-translate-x-full md:translate-x-0 w-64 md:w-20'
        }`}
    >
      <div className="flex h-full flex-col justify-between py-6 px-4">
        <div>
          {/* Logo Section */}
          <div className="mb-8 flex items-center justify-between px-2">
            <Link href="/dashboard" className="flex items-center gap-3">
              {sidebarOpen ? (
                <div className="flex items-center py-1">
                  <img
                    src="/logo.png"
                    alt="Saral Biz"
                    className="w-20 h-auto object-contain dark:brightness-110"
                  />
                </div>
              ) : (
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden">
                  <img
                    src="/logo.png"
                    alt="Saral Biz"
                    className="h-5 w-5 object-contain dark:brightness-110"
                  />
                </div>
              )}
            </Link>
            <button
              onClick={toggleSidebar}
              className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:text-foreground"
            >
              {sidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all ${isActive
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                    }`}
                >
                  <Icon size={20} className={isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground'} />
                  {sidebarOpen && <span>{item.name}</span>}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer Actions */}
        <div className="space-y-4 border-t border-border pt-4">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
          >
            {theme === 'light' ? (
              <>
                <Moon size={20} />
                {sidebarOpen && <span>Dark Mode</span>}
              </>
            ) : (
              <>
                <Sun size={20} />
                {sidebarOpen && <span>Light Mode</span>}
              </>
            )}
          </button>

          {/* User Display */}
          {sidebarOpen && user && (
            <div className="flex flex-col rounded-xl bg-secondary/50 p-3">
              <span className="text-xs text-muted-foreground">Logged in as</span>
              <span className="truncate text-xs font-semibold text-foreground">{user.email}</span>
            </div>
          )}

          {/* Logout */}
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-destructive hover:bg-destructive/10 transition-all"
          >
            <LogOut size={20} />
            {sidebarOpen && <span>Sign Out</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}
