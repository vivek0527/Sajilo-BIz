'use client';

import React, { useEffect, useState } from 'react';
import { useUIStore } from '@/lib/store';
import { Menu, Clock, Calendar } from 'lucide-react';

interface HeaderBarProps {
  title?: string;
}

export default function HeaderBar({ title }: HeaderBarProps) {
  const { toggleSidebar, user } = useUIStore();
  const [time, setTime] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>('');
  const [greeting, setGreeting] = useState<string>('Hello');

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setDateStr(now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }));

      const hour = now.getHours();
      if (hour < 12) setGreeting('Good Morning');
      else if (hour < 17) setGreeting('Good Afternoon');
      else setGreeting('Good Evening');
    };

    updateDateTime();
    const interval = setInterval(updateDateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const getOwnerName = () => {
    if (user?.shop_name) return user.shop_name;
    if (user?.email) return user.email.split('@')[0];
    return 'Shop Partner';
  };

  return (
    <header className="no-print sticky top-0 z-30 flex h-14 sm:h-16 w-full items-center justify-between border-b border-border bg-background/50 px-3 sm:px-6 backdrop-blur-md">
      <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
        {/* Mobile Hamburger menu */}
        <button
          onClick={toggleSidebar}
          className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl border border-border bg-card text-foreground hover:bg-secondary md:hidden shrink-0"
        >
          <Menu size={20} />
        </button>

        {title && (
          <h1 className="text-sm font-bold text-foreground sm:text-base md:text-xl truncate max-w-[120px] xs:max-w-[160px] sm:max-w-xs md:max-w-none">
            {title}
          </h1>
        )}
      </div>

      {/* Centered Orbya Tech Logo (Desktop only) */}
      <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center justify-center z-10">
        <a
          href="https://orbyatech.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          className="cursor-pointer hover:opacity-80 transition-opacity"
        >
          <img
            src="/orbya-light.png"
            alt="Orbya Tech"
            className="h-7 w-auto object-contain dark:hidden block"
          />
          <img
            src="/orbya-dark.png"
            alt="Orbya Tech"
            className="h-7 w-auto object-contain hidden dark:block"
          />
        </a>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 md:gap-6 shrink-0">
        {/* Mobile Orbya Tech Logo */}
        <div className="block md:hidden shrink-0">
          <a
            href="https://orbyatech.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="cursor-pointer hover:opacity-80 transition-opacity"
          >
            <img
              src="/orbya-light.png"
              alt="Orbya Tech"
              className="h-4 w-auto dark:hidden block"
            />
            <img
              src="/orbya-dark.png"
              alt="Orbya Tech"
              className="h-4 w-auto hidden dark:block"
            />
          </a>
        </div>

        {/* Date and Time Ticker */}
        <div className="hidden items-center gap-4 text-sm text-muted-foreground md:flex">
          <div className="flex items-center gap-1.5 rounded-lg bg-secondary/50 px-3 py-1.5">
            <Calendar size={14} className="text-primary" />
            <span>{dateStr}</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg bg-secondary/50 px-3 py-1.5 font-mono">
            <Clock size={14} className="text-primary" />
            <span>{time}</span>
          </div>
        </div>

        {/* User Greeting Info */}
        <div className="flex items-center gap-2">
          <div className="hidden flex-col text-right sm:flex">
            <span className="text-xs text-muted-foreground">{greeting},</span>
            <span className="text-sm font-semibold text-foreground">{getOwnerName()}</span>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-primary/20 to-violet-500/20 text-sm font-bold text-primary border border-primary/20">
            {getOwnerName().slice(0, 2).toUpperCase()}
          </div>
        </div>
      </div>
    </header>
  );
}
