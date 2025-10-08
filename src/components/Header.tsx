'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';

type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'CS';
};

export default function Header() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          cache: 'no-store',
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setUser(data.user as SessionUser);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Failed to fetch user:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      setUser(null);
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <header className="w-full py-3 px-4 flowgent-header">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 text-white md:flex-row md:items-center md:justify-between">
        <Link href="/" className="flex items-center gap-2 text-white">
          <Image
            src="/logo.svg"
            alt="FlowGent Logo"
            width={32}
            height={32}
            className="h-8 w-auto"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
          <span className="text-lg font-semibold">FlowGent</span>
        </Link>

        <div className="flex flex-col items-start gap-2 text-xs md:flex-row md:items-center md:gap-4">
          {loading ? (
            <div className="h-9 w-40 animate-pulse rounded-md bg-white/40" />
          ) : user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-sm">
                <User className="h-4 w-4" />
                <div className="flex flex-col text-left">
                  <span className="font-semibold leading-5">{user.name}</span>
                  <span className="text-xs opacity-80">{user.email}</span>
                </div>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="bg-white/90 text-purple-700 hover:bg-white"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                ログアウト
              </Button>
            </div>
          ) : (
            <Button asChild variant="secondary" size="sm" className="bg-white/90 text-purple-700 hover:bg-white">
              <Link href="/login">ログイン</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}