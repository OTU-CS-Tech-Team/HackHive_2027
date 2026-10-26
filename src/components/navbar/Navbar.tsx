import Link from "next/link";
import { getVerifiedUser } from "@/lib/auth/helpers";
import { signOut } from "@/app/actions/auth";
import { links } from "@/components/navbar/links";
import MobileNavMenu from "@/components/navbar/MobileNavMenu";

export async function Navbar() {
  // Same check the pages use, so an unverified account doesn't show "Log out"
  // while every page treats it as signed out.
  const isSignedIn = !!(await getVerifiedUser());
  const accountLinks = isSignedIn
    ? [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/apply/status", label: "My Application" },
      ]
    : [];

  return (
    <>
      <div className="flex shrink-0 items-center gap-2">
        <MobileNavMenu links={links} accountLinks={accountLinks} />
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
        {isSignedIn ? (
          <>
            <Link
              href="/dashboard"
              className="hidden text-sm font-medium text-neutral-600 hover:text-neutral-900 lg:inline"
            >
              Dashboard
            </Link>
            <Link
              href="/apply/status"
              className="hidden text-sm font-medium text-neutral-600 hover:text-neutral-900 lg:inline"
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
    </>
  );
}
