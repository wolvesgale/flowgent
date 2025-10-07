'use client';

export default function Header() {
  return (
    <header className="w-full py-3 px-4 flowgent-header">
      <div className="mx-auto max-w-6xl flex items-center justify-between">
        <div className="text-white text-lg font-semibold">FlowGent</div>
        <a href="/" className="inline-flex items-center">
          <img 
            src="/logo.svg" 
            alt="FlowGent Logo" 
            className="h-8 w-auto"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        </a>
      </div>
    </header>
  );
}