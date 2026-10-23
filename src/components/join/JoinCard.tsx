import Link from "next/link";

function MLHBadge() {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/50 bg-gradient-to-r from-amber-100/80 to-amber-50/80 px-4 py-1.5 text-sm font-medium text-amber-800 shadow-sm">
      <svg
        className="h-4 w-4 text-amber-500"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 2.18l7 3.12v5.7c0 4.83-3.4 9.36-7 10.46V3.18z" />
        <path d="M12 6l-4 1.8v3.2c0 2.4 1.6 4.6 4 5.2 2.4-.6 4-2.8 4-5.2V7.8L12 6z" />
      </svg>
      <span>MLH Official Member</span>
    </div>
  );
}

function GoldDivider() {
  return (
    <div className="flex w-full items-center justify-center gap-3 py-2">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-300/60 to-amber-400/80" />
      <svg
        className="h-3 w-3 text-amber-400"
        viewBox="0 0 12 12"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M6 0L7.5 4.5L12 6L7.5 7.5L6 12L4.5 7.5L0 6L4.5 4.5L6 0Z" />
      </svg>
      <div className="h-px flex-1 bg-gradient-to-l from-transparent via-amber-300/60 to-amber-400/80" />
    </div>
  );
}

export function JoinCardContent() {
  return (
    <div className="join-card-glass flex flex-col items-center px-6 py-8 text-center sm:px-8 sm:py-10 md:px-10 md:py-12">
      <MLHBadge />

      <h1 className="mt-5 font-serif text-3xl font-semibold tracking-tight text-amber-950 sm:text-4xl md:mt-6 md:text-5xl">
        HackHive 2027
      </h1>

      <GoldDivider />

      <p className="text-base text-amber-900/80 sm:text-lg md:text-xl">
        March 14–15 2027
      </p>

      <p className="mt-3 text-sm text-amber-900/70 sm:text-base md:mt-4 md:text-lg">
        Join as a hacker
      </p>
    </div>
  );
}

export function JoinCardWithButtons() {
  return (
    <div className="join-card-glass flex flex-col items-center px-8 py-10 text-center md:px-10 md:py-12">
      <MLHBadge />

      <h1 className="mt-6 font-serif text-4xl font-semibold tracking-tight text-amber-950 md:text-5xl">
        HackHive 2027
      </h1>

      <GoldDivider />

      <p className="text-lg text-amber-900/80 md:text-xl">
        March 14–15 2027
      </p>

      <p className="mt-4 text-base text-amber-900/70 md:text-lg">
        Join as a hacker
      </p>

      <div className="mt-8 flex w-full flex-col gap-3">
        <Link
          href="/apply"
          className="join-btn-primary inline-flex min-h-[48px] items-center justify-center rounded-full px-10 py-3 text-lg font-semibold transition-all hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2"
        >
          Join now
        </Link>

        <Link
          href="#faq"
          className="join-btn-secondary inline-flex min-h-[48px] items-center justify-center rounded-full border-2 border-amber-900/20 bg-white/50 px-10 py-3 text-lg font-semibold text-amber-900 backdrop-blur-sm transition-all hover:bg-white/70 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2"
        >
          Learn more
        </Link>
      </div>
    </div>
  );
}

export function JoinCTAButtons() {
  return (
    <div className="flex w-full flex-col items-center gap-3 px-4">
      <Link
        href="/apply"
        className="join-btn-primary inline-flex min-h-[52px] w-full max-w-md items-center justify-center rounded-full px-10 py-3 text-xl font-semibold transition-all hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2"
      >
        Join now
      </Link>

      <Link
        href="#faq"
        className="inline-flex min-h-[48px] items-center justify-center py-2 text-lg font-medium text-amber-900 underline underline-offset-4 transition-colors hover:text-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2"
      >
        Learn more
      </Link>
    </div>
  );
}
