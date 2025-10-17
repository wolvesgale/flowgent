'use client';

import Link from 'next/link';
import Image from 'next/image';

import { Button } from '@/components/ui/button';

export default function Header() {
  return (
    <header className="w-full px-4 py-3 flowgent-header">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
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
            className="border-white/40 bg-white/10 text-white hover:bg-white/20"
          >
            <Link href="/dashboard">ダッシュボード</Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            className="text-white hover:bg-purple-600/60"
          >
            <Link href="/api/auth/logout">ログアウト</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
