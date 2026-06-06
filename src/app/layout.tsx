import '@/app/globals.css';
import Providers from '@/components/Providers';
import AppLayout from '@/components/AppLayout';
import { Inter } from 'next/font/google';

import type { Viewport } from 'next';

const inter = Inter({ subsets: ['latin'] });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata = {
  title: 'Saral Biz - Smart Shop Management SaaS',
  description: 'Manage inventory, generate invoices, track customers & expenses, and monitor shop growth with live analytics.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" style={{ colorScheme: 'dark' }}>
      <body className={`${inter.className}`}>
        <Providers>
          <AppLayout>
            {children}
          </AppLayout>
        </Providers>
      </body>
    </html>
  );
}
