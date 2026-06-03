'use client';

import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUIStore } from '@/lib/store';
import { dbClient } from '@/lib/db';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        staleTime: 5 * 60 * 1000, // 5 minutes
      },
    },
  }));

  const { setUser, theme, setTheme } = useUIStore();

  useEffect(() => {
    // 1. Sync User Session
    const checkSession = async () => {
      try {
        const userSession = await dbClient.auth.getUser();
        setUser(userSession);
      } catch (err) {
        console.error('Session sync error:', err);
      }
    };
    checkSession();

    // 2. Hydrate theme class
    const savedTheme = theme;
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(savedTheme);
    setTheme(savedTheme);
  }, [setUser, setTheme, theme]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
