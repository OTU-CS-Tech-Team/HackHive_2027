import Link from "next/link";

const links = [
  { href: "#sponsors", label: "Sponsors" },
  { href: "#hackhive-2025", label: "HackHive 2025" },
  { href: "#faq", label: "FAQ" },
] as const;

export function Navbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b border-neutral-200 bg-white px-4 sm:px-6">
      <Link href="/" className="shrink-0 text-lg font-bold text-neutral-900">
        HackHive
      </Link>
      <nav aria-label="Page sections" className="hidden items-center gap-8 md:flex">
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="text-sm font-medium text-neutral-900"
          >
            {link.label}
          </a>
        ))}
      </nav>
      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        <Link
          href="/apply/status"
          className="hidden text-sm font-medium text-neutral-600 hover:text-neutral-900 sm:block"
        >
          My Application
        </Link>
        <Link
          href="/signup"
          className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 sm:px-4"
        >
          Apply
        </Link>
      </div>
    </header>
  );
}
