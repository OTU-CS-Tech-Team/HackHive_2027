import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

// The same lemon-to-orange gradient as the HackHive title. White text
// can't sit on yellow this light, so the label is deep brown #3b2400:
// about 11:1 on the lemon and 5.4:1 on the orange corner (AA either way).
// Hover brightens the glow, not the fill, so the contrast holds.
const ctaClassName =
  "mt-7 inline-flex min-h-13 items-center justify-center rounded-full bg-[image:radial-gradient(ellipse_80%_120%_at_55%_0%,#ffdd01_0%,#ffc000_45%,rgba(255,170,1,0)_80%),linear-gradient(160deg,#ffaa01_0%,#ffa402_45%,#ff7400_100%)] px-8 text-[1.2rem] font-bold lg:min-h-15 lg:px-10 lg:text-[1.35rem] tracking-[0.01em] text-[#3b2400] [text-shadow:0_1px_0_rgba(255,244,200,0.55)] shadow-[inset_0_1px_0_rgba(255,246,200,0.75),inset_0_-2px_0_rgba(170,70,0,0.25),0_10px_26px_rgba(230,110,0,0.35),0_0_22px_rgba(255,200,40,0.4)] transition-[box-shadow,transform] duration-200 hover:-translate-y-px hover:shadow-[inset_0_1px_0_rgba(255,246,200,0.85),inset_0_-2px_0_rgba(170,70,0,0.25),0_14px_32px_rgba(230,110,0,0.42),0_0_34px_rgba(255,210,60,0.6)] active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#3b2400] motion-reduce:transition-none";

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
