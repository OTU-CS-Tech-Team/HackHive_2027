import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/auth";
import { getAccountLinks, links } from "@/components/navbar/links";
import MobileNavMenu from "@/components/navbar/MobileNavMenu";

export async function Navbar() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isSignedIn = !!user;
  const accountLinks = getAccountLinks(isSignedIn);

  return (
    <>
      <div className="flex shrink-0 items-center gap-2">
        <MobileNavMenu links={links} accountLinks={accountLinks} />
        <Link href="/" aria-label="HackHive home" className="shrink-0">
          <Image src="/Images/HackhiveLogo.png" alt="HackHive" width={44} height={44} />
        </Link>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        <nav aria-label="Page sections" className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 md:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm font-medium whitespace-nowrap text-neutral-900">
              {link.label}
            </Link>
          ))}
          {isSignedIn && (
            <Link href="/dashboard" className="text-sm font-medium whitespace-nowrap text-neutral-900">
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
