import Link from "next/link";

/** Event date — confirmed by Umad */
export const EVENT_DATE_TEXT = "January 29–31, 2027 • In-person event";

export function JoinHero() {
  return (
    <div className="join-hero flex flex-col items-center px-4 py-8 text-center md:px-8 md:py-12">
      {/* Big bold title with gold-to-amber gradient */}
      <h1 className="join-title text-5xl font-extrabold tracking-tight sm:text-6xl md:text-7xl lg:text-8xl">
        HackHive 2027
      </h1>

      {/* Date line */}
      <p className="join-text mt-4 text-lg font-medium sm:text-xl md:mt-6 md:text-2xl">
        {EVENT_DATE_TEXT}
      </p>

      {/* MLH line */}
      <p className="join-text mt-2 text-base font-semibold uppercase tracking-wider sm:text-lg md:text-xl">
        MLH Official Member
      </p>

      {/* Applications line */}
      <p className="join-text mt-4 text-base sm:text-lg md:mt-6 md:text-xl">
        Applications are open, join us as a hacker!
      </p>

      {/* CTA Button */}
      <Link
        href="/apply"
        className="join-btn-primary mt-8 inline-flex min-h-[52px] items-center justify-center rounded-lg px-8 py-3 text-lg font-bold transition-all hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 sm:px-10 sm:text-xl md:mt-10 md:min-h-[56px] md:rounded-xl md:px-12 md:text-2xl"
      >
        Join as a hacker
      </Link>

      {/* Learn more link */}
      <Link
        href="#faq"
        className="join-text-link mt-4 inline-flex min-h-[48px] items-center justify-center text-base font-medium underline underline-offset-4 transition-colors hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 md:mt-6 md:text-lg"
      >
        Learn more
      </Link>
    </div>
  );
}

export function JoinHeroMobile() {
  return (
    <div className="join-hero flex flex-col items-center px-4 py-6 text-center">
      {/* Big bold title with gold-to-amber gradient */}
      <h1 className="join-title text-4xl font-extrabold tracking-tight xs:text-5xl">
        HackHive 2027
      </h1>

      {/* Date line */}
      <p className="join-text mt-3 text-base font-medium">
        {EVENT_DATE_TEXT}
      </p>

      {/* MLH line */}
      <p className="join-text mt-1.5 text-sm font-semibold uppercase tracking-wider">
        MLH Official Member
      </p>

      {/* Applications line */}
      <p className="join-text mt-3 text-sm">
        Applications are open, join us as a hacker!
      </p>
    </div>
  );
}

export function JoinCTAButtons() {
  return (
    <div className="flex w-full flex-col items-center gap-3 px-4">
      <Link
        href="/apply"
        className="join-btn-primary inline-flex min-h-[52px] w-full max-w-sm items-center justify-center rounded-lg px-8 py-3.5 text-xl font-bold transition-all hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2"
      >
        Join as a hacker
      </Link>

      <Link
        href="#faq"
        className="join-text-link inline-flex min-h-[48px] items-center justify-center py-2 text-base font-medium underline underline-offset-4 transition-colors hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2"
      >
        Learn more
      </Link>
    </div>
  );
}
