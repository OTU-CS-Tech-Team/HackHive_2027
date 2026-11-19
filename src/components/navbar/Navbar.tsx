import Link from "next/link";
import Image from "next/image";
import { getVerifiedUser } from "@/lib/auth/helpers";
import { signOut } from "@/app/actions/auth";
import { getAccountLinks, links } from "@/components/navbar/links";
import MobileNavMenu from "@/components/navbar/MobileNavMenu";

export async function Navbar() {
  // Same check the pages use, so an unverified account doesn't show "Log out"
  // while every page treats it as signed out.
  const isSignedIn = !!(await getVerifiedUser());
  const accountLinks = getAccountLinks(isSignedIn);

  return (
    <>
      <div className="flex shrink-0 items-center gap-2">
        <MobileNavMenu links={links} accountLinks={accountLinks} />
       
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        <nav aria-label="Page sections" className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 md:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="text-md font-medium whitespace-nowrap text-neutral-900">
              {link.label}
            </Link>
          ))}
          {isSignedIn && (
            <Link href="/dashboard" className="text-md font-medium whitespace-nowrap text-neutral-900">
              Dashboard
            </Link>
          )}
        </nav>
        {isSignedIn ? (
          <>
            <form action={signOut}>
              <button
                type="submit"
                data-nav-logout
                className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 sm:px-4"
              >
                Log out
              </button>
            </form>
          </>
        ) : (
          // Returning hackers reach log in from the signup page.
          <Link
            href="/signup"
            data-nav-cta
            className="rounded-lg bg-hive-ink px-3 py-2 text-sm font-semibold text-white hover:bg-[#1c4258] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hive-ink sm:px-4"
          >
            Apply
          </Link>
        )}
      </div>
    </>
  );
}
