import Link from "next/link";

const links = [
  { href: "#sponsors", label: "Sponsors" },
  { href: "#hackhive-2025", label: "HackHive 2025" },
  { href: "#faq", label: "FAQ" },
] as const;

export function Navbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 grid h-16 grid-cols-[1fr_auto_1fr] items-center border-b border-neutral-200 bg-white px-6">
      <Link href="/" className="text-lg font-bold text-neutral-900">
        HackHive
      </Link>
      <nav aria-label="Page sections" className="hidden items-center justify-center gap-8 sm:flex">
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
      <div className="flex justify-end gap-4">
        <Link
          href="/apply/status"
          className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
        >
          My Application
        </Link>
        <Link
          href="/signup"
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Apply
        </Link>
      </div>
    </header>
  );
}
