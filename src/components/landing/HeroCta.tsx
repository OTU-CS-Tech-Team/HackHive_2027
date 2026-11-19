import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

// The title's pollen yellow and hard amber edge, given body: the fill runs
// from a lighter top (#ffd84d) through #ffc414 to a deeper amber at the
// bottom, with a glossy inner highlight along the top and a soft inner shade
// along the bottom, so it reads as a rounded, pressable button. White text
// can't sit on yellow this light, so the label is deep brown #3b2400 (about
// 7.5:1 on the darkest stop, AA). Hover lifts the button onto a deeper edge;
// press sinks it onto a thinner one.
const ctaClassName =
  "mt-7 inline-flex min-h-13 items-center justify-center rounded-full bg-[linear-gradient(180deg,#ffd84d_0%,#ffc414_55%,#ffb300_100%)] px-8 text-[1.2rem] font-bold lg:min-h-15 lg:px-10 lg:text-[1.35rem] tracking-[0.01em] text-[#3b2400] [text-shadow:0_1px_0_rgba(255,240,190,0.6)] shadow-[inset_0_2px_0_rgba(255,255,255,0.55),inset_0_-3px_0_rgba(163,95,0,0.18),0_4px_0_#a35f00,0_8px_16px_rgba(90,40,0,0.22)] transition-[box-shadow,transform] duration-150 hover:-translate-y-px hover:shadow-[inset_0_2px_0_rgba(255,255,255,0.6),inset_0_-3px_0_rgba(163,95,0,0.18),0_5px_0_#a35f00,0_10px_20px_rgba(90,40,0,0.26)] active:translate-y-[3px] active:shadow-[inset_0_2px_0_rgba(255,255,255,0.4),inset_0_-1px_0_rgba(163,95,0,0.18),0_1px_0_#a35f00,0_3px_8px_rgba(90,40,0,0.2)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#3b2400] motion-reduce:transition-none";

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
