import Link from "next/link";

const links = [
  { href: "/#schedule", label: "Schedule" },
  { href: "/#speakers", label: "Speakers & Judges" },
  { href: "/#sponsors", label: "Sponsors" },
  { href: "/#hackhive-2025", label: "Archive" },
  { href: "/#faq", label: "FAQ" },
] as const;

export function Navbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 grid h-16 grid-cols-[1fr_auto_1fr] items-center border-b border-neutral-200 bg-white px-6">
      <Link href="/" className="font-bold">
        HackHive
      </Link>
      <nav aria-label="Main" className="flex items-center justify-center gap-6 overflow-x-auto">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="text-sm font-medium whitespace-nowrap text-neutral-900">
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="flex justify-end">
        {/* /dashboard sends signed-out visitors to /login. */}
        <Link href="/dashboard" className="text-sm font-medium text-neutral-900">
          Dashboard
        </Link>
      </div>
    </header>
  );
}
