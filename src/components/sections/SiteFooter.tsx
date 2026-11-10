import Link from "next/link";

const CLUB_EMAIL = "otu.csclub@gmail.com";

const footerLinks = [
  { href: "/#sponsors", label: "Sponsors" },
  { href: "/#judges", label: "Judges" },
  { href: "/#faq", label: "FAQs" },
] as const;

export function SiteFooter() {
  return (
    <footer className="absolute inset-x-0 bottom-0 z-[3] px-4 font-[family-name:var(--font-grotesk)] text-[#efe6d4] sm:px-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 border-t-2 border-white/70 py-3 text-sm sm:flex-row sm:pt-6 sm:pb-4 sm:items-center sm:justify-between sm:text-base">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <a href={`mailto:${CLUB_EMAIL}`} className="hover:text-[#f5b83d]">
            {CLUB_EMAIL}
          </a>
          <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {footerLinks.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-[#f5b83d]">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <p className="shrink-0">© 2026 HackHive</p>
      </div>
    </footer>
  );
}
