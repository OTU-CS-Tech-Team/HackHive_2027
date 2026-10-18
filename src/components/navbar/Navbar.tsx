import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/auth";

const links = [
  { href: "/#sponsors", label: "Sponsors" },
  { href: "/#hackhive-2025", label: "HackHive 2025" },
  { href: "/#faq", label: "FAQ" },
] as const;

export async function Navbar() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isSignedIn = !!user;

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
        {isSignedIn ? (
          <>
            <Link
              href="/apply/status"
              className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
            >
              My Application
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 sm:px-4"
              >
                Log out
              </button>
            </form>
          </>
        ) : (
          <Link
            href="/auth/login"
            className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 sm:px-4"
          >
            Log in
          </Link>
        )}
      </div>
    </header>
  );
}
