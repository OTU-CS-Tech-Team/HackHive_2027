import type { Metadata } from "next";
import { Suspense } from "react";
import { Navbar } from "@/components/navbar/Navbar";
import "./globals.css";

export const metadata: Metadata = {
  title: "HackHive 2027",
  description: "HackHive 2027",
};

function NavbarFallback() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b border-neutral-200 bg-white px-4 sm:px-6">
      <span className="shrink-0 text-lg font-bold text-neutral-900">HackHive</span>
      <div className="h-8 w-20" />
    </header>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Suspense fallback={<NavbarFallback />}>
          <Navbar />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
