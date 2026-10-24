import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import Script from "next/script";
import { Navbar } from "@/components/navbar/Navbar";
import MobileNavMenu from "@/components/navbar/MobileNavMenu";
import NavbarShell from "@/components/navbar/NavbarShell";
import { links } from "@/components/navbar/links";
import "./globals.css";

export const metadata: Metadata = {
  title: "HackHive 2027",
  description: "HackHive 2027",
};

function NavbarFallback() {
  return (
    <>
      <div className="flex shrink-0 items-center gap-2">
        <MobileNavMenu links={links} />
        <Link href="/" className="shrink-0 text-lg font-bold text-neutral-900">
          HackHive
        </Link>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        <nav aria-label="Page sections" className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm font-medium whitespace-nowrap text-neutral-900">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <NavbarShell>
          <Suspense fallback={<NavbarFallback />}>
            <Navbar />
          </Suspense>
        </NavbarShell>
        <Script src="/navbar-interactions.js?v=6" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}
