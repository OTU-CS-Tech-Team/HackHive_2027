const links = [
  { href: "#sponsors", label: "Sponsors" },
  { href: "#hackhive-2025", label: "HackHive 2025" },
  { href: "#faq", label: "FAQ" },
] as const;

export function Navbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 grid h-16 grid-cols-[1fr_auto_1fr] items-center border-b border-neutral-200 bg-white px-6">
      <div />
      <nav aria-label="Page sections" className="flex items-center justify-center gap-8">
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
      <div className="flex justify-end">
        <button type="button" className="text-sm font-medium text-neutral-900">
          Login
        </button>
      </div>
    </header>
  );
}
