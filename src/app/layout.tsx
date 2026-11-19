import type { Metadata } from "next";
import { Geist, Geist_Mono, Host_Grotesk } from "next/font/google";
import { Suspense } from "react";
import Link from "next/link";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { Navbar } from "@/components/navbar/Navbar";
import MobileNavMenu from "@/components/navbar/MobileNavMenu";
import NavbarShell from "@/components/navbar/NavbarShell";
import { links } from "@/components/navbar/links";
import "./globals.css";
import { cn } from "@/lib/utils";
import { INTRO_DECIDE_SCRIPT } from "@/components/landing/intro/decideScript";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "optional",
  adjustFontFallback: true,
  preload: true,
});

// The heading face: the homepage title, section headings, the apply flow and
// admin, as var(--font-grotesk) in CSS modules and Tailwind's font-display.
// (The variable name dates from Space Grotesk; the face is now Host Grotesk.)
// optional: use the face if it is ready for first paint, and do not swap later.
const grotesk = Host_Grotesk({
  subsets: ["latin"],
  variable: "--font-grotesk",
  display: "optional",
  adjustFontFallback: true,
  preload: true,
});

// The navbar, as var(--font-nav) in NavbarShell.module.css.
const navFont = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-nav",
  weight: ["500"],
  display: "optional",
  adjustFontFallback: true,
  preload: true,
});

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
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning className={cn("font-sans", geist.variable, grotesk.variable, navFont.variable)}>
      {/* Extensions like Grammarly add attributes to <body> before React hydrates. */}
      <body suppressHydrationWarning>
        {/* Picks the homepage intro phase before first paint. See decideScript.ts. */}
        <script dangerouslySetInnerHTML={{ __html: INTRO_DECIDE_SCRIPT }} />
        <NavbarShell>
          <Suspense fallback={<NavbarFallback />}>
            <Navbar />
          </Suspense>
        </NavbarShell>
        <Script src="/navbar-interactions.js?v=9" strategy="afterInteractive" />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
