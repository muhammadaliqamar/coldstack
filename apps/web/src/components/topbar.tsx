'use client';

import { useAuthStore, useUIStore } from '@/lib/store';
import { Bell, Menu, User as UserIcon } from 'lucide-react';
import { Button, buttonVariants } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Avatar, AvatarFallback } from './ui/avatar';
import { usePathname } from 'next/navigation';

export function Topbar() {
  const { user, logout } = useAuthStore();
  const { toggleSidebar } = useUIStore();
  const pathname = usePathname();

  // Create simple breadcrumbs based on pathname
  const segments = pathname.split('/').filter(Boolean);
  const title = segments[0] ? segments[0].charAt(0).toUpperCase() + segments[0].slice(1) : 'Dashboard';

  return (
    <header className="h-16 border-b bg-background flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={toggleSidebar} className="md:hidden">
          <Menu className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      </div>

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="relative text-muted-foreground">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger className={buttonVariants({ variant: "ghost", className: "relative h-8 w-8 rounded-full" })}>
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/10 text-primary">
                {user?.name?.charAt(0).toUpperCase() || <UserIcon className="w-4 h-4" />}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user?.name}</p>
                  <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { logout(); window.location.href = '/login'; }}>
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
