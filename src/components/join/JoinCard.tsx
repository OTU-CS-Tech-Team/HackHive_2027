import Link from "next/link";

/** Event date — confirmed by Umad */
export const EVENT_DATE_TEXT = "January 29–31, 2027 • In-person event";

function MLHWordmark() {
  return (
    <span className="inline-flex items-center rounded-full bg-white/90 px-2 py-0.5 text-sm font-bold tracking-wide shadow-sm">
      <span className="text-[#e73427]">M</span>
      <span className="text-[#1d539f]">L</span>
      <span className="text-[#f0b93a]">H</span>
    </span>
  );
}

export function JoinHero() {
  return (
    <div className="flex max-w-xl flex-col items-center px-4 py-8 text-center md:px-8 md:py-12 lg:-translate-x-8 lg:-translate-y-4">
      {/* Big bold title with gold gradient - capped at lg:text-6xl to clear hive */}
      <h1 className="join-title text-5xl font-extrabold tracking-tight sm:text-6xl md:text-6xl lg:text-6xl">
        HackHive 2027
      </h1>

      {/* Date line */}
      <p className="join-text mt-4 text-lg font-medium sm:text-xl md:mt-6 md:text-2xl">
        {EVENT_DATE_TEXT}
      </p>

      {/* MLH line with wordmark */}
      <p className="join-text mt-2 text-base font-semibold uppercase tracking-wider sm:text-lg md:text-xl">
        <MLHWordmark /> Official Member
      </p>

      {/* Applications line - font-medium for readability */}
      <p className="join-text mt-4 text-base font-medium sm:text-lg md:mt-6 md:text-xl">
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
    <div className="flex flex-col items-center px-4 py-6 text-center">
      {/* Big bold title with gold gradient */}
      <h1 className="join-title text-4xl font-extrabold tracking-tight">
        HackHive 2027
      </h1>

      {/* Date line */}
      <p className="join-text mt-3 text-base font-medium">
        {EVENT_DATE_TEXT}
      </p>

      {/* MLH line with wordmark */}
      <p className="join-text mt-1.5 text-sm font-semibold uppercase tracking-wider">
        <MLHWordmark /> Official Member
      </p>

      {/* Applications line - font-medium for readability */}
      <p className="join-text mt-3 text-sm font-medium">
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
