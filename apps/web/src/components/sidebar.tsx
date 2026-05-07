'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Megaphone,
  KanbanSquare,
  Inbox,
  Globe,
  Users,
  BarChart3,
  ShieldCheck,
  Settings,
  Sun,
  Moon,
  Flame,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/lib/store';

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Campaigns', href: '/campaigns', icon: Megaphone },
  { name: 'Pipeline', href: '/pipeline', icon: KanbanSquare },
  { name: 'Inboxes', href: '/inboxes', icon: Inbox },
  { name: 'Domains', href: '/domains', icon: Globe },
  { name: 'Email Lists', href: '/lists', icon: Users },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Deliverability', href: '/deliverability', icon: ShieldCheck },
  { name: 'Warmup', href: '/warmup', icon: Flame },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen } = useUIStore();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!sidebarOpen) return null;

  const isDark = theme === 'dark';

  return (
    <aside className="w-64 border-r bg-background flex-shrink-0 flex flex-col h-full hidden md:flex">
      <div className="h-16 flex items-center px-6 border-b">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Megaphone className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg tracking-tight">ColdStack</span>
        </div>
      </div>
      
      <div className="flex-1 py-6 px-3 flex flex-col gap-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                isActive 
                  ? "bg-primary/10 text-primary" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.name}
            </Link>
          );
        })}
      </div>

      {/* Theme Toggle */}
      <div className="px-3 pb-4 pt-2 border-t">
        {mounted && (
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-300",
              "text-muted-foreground hover:bg-muted hover:text-foreground",
              "group relative overflow-hidden"
            )}
          >
            <div className="relative w-4 h-4">
              <Sun className={cn(
                "w-4 h-4 absolute inset-0 transition-all duration-300",
                isDark ? "opacity-0 rotate-90 scale-0" : "opacity-100 rotate-0 scale-100"
              )} />
              <Moon className={cn(
                "w-4 h-4 absolute inset-0 transition-all duration-300",
                isDark ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-0"
              )} />
            </div>
            <span>{isDark ? 'Dark Mode' : 'Light Mode'}</span>
            <div className={cn(
              "ml-auto w-9 h-5 rounded-full transition-colors duration-300 flex items-center px-0.5",
              isDark ? "bg-primary/20" : "bg-primary/20"
            )}>
              <div className={cn(
                "w-4 h-4 rounded-full transition-all duration-300 shadow-sm",
                isDark 
                  ? "translate-x-[14px] bg-primary" 
                  : "translate-x-0 bg-primary"
              )} />
            </div>
          </button>
        )}
      </div>
    </aside>
  );
}
