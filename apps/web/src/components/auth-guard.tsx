'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/store';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { accessToken } = useAuthStore();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && !accessToken && !pathname.startsWith('/login') && !pathname.startsWith('/register')) {
      router.push('/login');
    }
  }, [isClient, accessToken, router, pathname]);

  // Don't render anything until we've verified auth on the client to prevent hydration mismatch
  // and flashing of protected content
  if (!isClient) {
    return null;
  }

  if (!accessToken && !pathname.startsWith('/login') && !pathname.startsWith('/register')) {
    return null;
  }

  return <>{children}</>;
}
