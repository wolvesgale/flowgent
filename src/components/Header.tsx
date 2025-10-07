'use client';

import Link from 'next/link';
import Image from 'next/image';

export default function Header() {
  return (
    <header className="w-full py-3 px-4 flowgent-header">
      <div className="mx-auto max-w-6xl flex items-center justify-between">
        <div className="text-white text-lg font-semibold">FlowGent</div>
        <Link href="/" className="inline-flex items-center">
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
        </Link>
      </div>
    </header>
  );
}