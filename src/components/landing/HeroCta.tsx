import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

// Honey gold, light at the top and deep amber at the foot, with white text.
// The gold reaches #c98412 (3.1:1 with white) by 22%, above the cap height,
// so every pixel under the 1.2rem bold text is at least 3:1 (large-text AA),
// and a dark amber shadow firms up its edge. Hover brightens the
// glow, not the fill, so the contrast holds.
const ctaClassName =
  "mt-7 inline-flex min-h-13 items-center justify-center rounded-full bg-[linear-gradient(180deg,#f0b23a_0%,#c98412_22%,#bd790c_55%,#a86206_100%)] px-8 text-[1.2rem] font-bold tracking-[0.01em] text-white [text-shadow:0_1px_1px_rgba(98,50,0,0.6),0_0_10px_rgba(120,62,0,0.35)] shadow-[inset_0_1px_0_rgba(255,236,170,0.65),inset_0_-2px_0_rgba(120,64,0,0.25),0_10px_26px_rgba(176,107,8,0.38),0_0_22px_rgba(255,196,64,0.35)] transition-[box-shadow,transform] duration-200 hover:-translate-y-px hover:shadow-[inset_0_1px_0_rgba(255,236,170,0.75),inset_0_-2px_0_rgba(120,64,0,0.25),0_14px_32px_rgba(176,107,8,0.45),0_0_34px_rgba(255,200,80,0.6)] active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#3b2400] motion-reduce:transition-none";

export async function HeroCta() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return (
      <Link href="/apply" className={ctaClassName}>
        My Application
      </Link>
    );
  }

  return (
    <Link href="/signup" className={ctaClassName}>
      Apply now!
    </Link>
  );
}

export function HeroCtaFallback() {
  return (
    <Link href="/signup" className={ctaClassName}>
      Apply now!
    </Link>
  );
}
