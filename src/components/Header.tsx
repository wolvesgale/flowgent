'use client';

import Link from 'next/link';
import Image from 'next/image';

import { Button } from '@/components/ui/button';

export default function Header() {
  return (
    <header className="w-full bg-brand text-white shadow-xs">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-3 text-white">
          <Image
            src="/taaan-referral.svg"
            alt="TAAAN Referral"
            width={160}
            height={32}
            className="h-8 w-auto"
            priority
          />
          <span className="text-lg font-semibold">FlowGent</span>
        </Link>
        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="outline"
            className="border border-white/40 bg-white/10 text-white shadow-xs hover:bg-white/20"
          >
            <Link href="/dashboard">ダッシュボード</Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            className="bg-brand-600 text-white hover:bg-brand-600/80"
          >
            <Link href="/api/auth/logout">ログアウト</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
