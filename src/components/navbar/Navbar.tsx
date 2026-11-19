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
      {/* Full height of the bar, so the MLH badge's slot starts at the very top of the screen. */}
      <div className="flex shrink-0 items-center gap-2 self-stretch sm:gap-4">
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
            className="rounded-lg bg-hive-ink px-3 py-2 text-sm font-semibold text-white hover:bg-[#1c4258] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hive-ink sm:px-4"
          >
            Apply
          </Link>
        )}
        {/* MLH trust badge: required on MLH member events, in the top right. It hangs
            down from the top of the screen past the bar, so its slot only reserves the
            width; the bar's hide-on-scroll slides it away too (NavbarShell.module.css). */}
        <div className="relative w-[60px] shrink-0 self-stretch md:w-[80px]">
          <a
            id="mlh-trust-badge"
            data-mlh-badge
            href="https://www.mlh.com/na?utm_source=na-hackathon&utm_medium=TrustBadge&utm_campaign=2027-season&utm_content=yellow"
            target="_blank"
            rel="noopener"
            className="absolute inset-x-0 top-0 block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- MLH serves the badge; it must load from their URL */}
            <img
              // MLH's official yellow badge, shown exactly as MLH serves it (no recolouring or
              // filters). Its #f8b92a is the closest official colour to our honey (#f5b83d).
              src="https://logged-assets.s3.amazonaws.com/trust-badge/2027/mlh-trust-badge-2027-yellow.svg"
              alt="Major League Hacking 2027 Hackathon Season"
              className="block w-full"
            />
          </a>
        </div>
      </div>
    </>
  );
}
