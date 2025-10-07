import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import Header from '@/components/Header';
import MainNav from '@/components/MainNav';

export const metadata: Metadata = {
  title: "FlowGent",
  description: "Evangelist Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased min-h-screen">
        <Header />
        <MainNav />
        <main className="p-4 md:p-6">
          <div className="mx-auto max-w-6xl space-y-6">
            {children}
          </div>
        </main>
        <Toaster />
      </body>
    </html>
  );
}
