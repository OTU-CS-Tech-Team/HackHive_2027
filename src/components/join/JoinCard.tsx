import Link from "next/link";

function MLHBadge() {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/60 bg-gradient-to-b from-amber-50 to-amber-100/80 px-4 py-1.5 text-sm font-medium text-amber-800 shadow-sm">
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

function GoldDivider({ showDiamond = true }: { showDiamond?: boolean }) {
  return (
    <div className="flex w-full items-center justify-center gap-3 py-3">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-300/50 to-amber-400/70" />
      {showDiamond && (
        <svg
          className="h-2.5 w-2.5 text-amber-400"
          viewBox="0 0 12 12"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M6 0L7.5 4.5L12 6L7.5 7.5L6 12L4.5 7.5L0 6L4.5 4.5L6 0Z" />
        </svg>
      )}
      <div className="h-px flex-1 bg-gradient-to-l from-transparent via-amber-300/50 to-amber-400/70" />
    </div>
  );
}

export function JoinCardContent() {
  return (
    <div className="join-card-glass flex flex-col items-center px-6 py-8 text-center">
      <p className="text-sm font-medium italic text-amber-800/90">
        MLH Official Member
      </p>

      <h1 className="mt-4 font-serif text-4xl font-semibold tracking-tight text-amber-950 sm:text-5xl">
        HackHive 2027
      </h1>

      <GoldDivider showDiamond={true} />

      <p className="text-lg text-amber-900/80">
        March 14–15 2027
      </p>

      <p className="mt-3 text-base text-amber-900/70">
        Join as a hacker
      </p>
    </div>
  );
}

export function JoinCardWithButtons() {
  return (
    <div className="join-card-glass flex flex-col items-center px-8 py-10 text-center md:px-12 md:py-12">
      <MLHBadge />

      <h1 className="mt-6 font-serif text-4xl font-semibold tracking-tight text-amber-950 md:text-5xl">
        HackHive 2027
      </h1>

      <p className="mt-2 text-lg text-amber-900/80 md:text-xl">
        March 14–15 2027
      </p>

      <p className="mt-3 text-base text-amber-900/70 md:text-lg">
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
          className="join-btn-secondary inline-flex min-h-[48px] items-center justify-center rounded-full border border-amber-900/20 bg-white/60 px-10 py-3 text-lg font-medium text-amber-900 backdrop-blur-sm transition-all hover:bg-white/80 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2"
        >
          Learn more
        </Link>
      </div>
    </div>
  );
}

export function JoinCTAButtons() {
  return (
    <div className="flex w-full flex-col items-center gap-4 px-4">
      <Link
        href="/apply"
        className="join-btn-primary inline-flex min-h-[52px] w-full max-w-sm items-center justify-center rounded-full px-10 py-3.5 text-xl font-semibold transition-all hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2"
      >
        Join now
      </Link>

      <Link
        href="#faq"
        className="inline-flex min-h-[48px] items-center justify-center py-2 text-lg font-medium text-amber-900 underline underline-offset-4 decoration-amber-900/40 transition-colors hover:text-amber-700 hover:decoration-amber-700/60 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2"
      >
        Learn more
      </Link>
    </div>
  );
}
