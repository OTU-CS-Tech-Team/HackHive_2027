import Link from "next/link";
import { CalendarDays, ClipboardList, Cpu, Hexagon, IdCard, LogOut, MapPin, ShoppingBag, Users, type LucideIcon } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/server";
import Image from "next/image";

// Sidebar entries; the dashboard picks its panel by ?tab=, schedule by default.
export const TABS = {
  schedule: "Schedule",
  application: "Application",
  team: "Looking for group",
  checkout: "Hardware checkout",
  hunt: "Scavenger hunt",
  shop: "Points shop",
  profile: "Profile",
  passport: "Passport",
} as const;
export type Tab = keyof typeof TABS;

export const ICONS: Record<Tab, LucideIcon> = {
  schedule: CalendarDays,
  passport: Hexagon,
  application: ClipboardList,
  team: Users,
  checkout: Cpu,
  hunt: MapPin,
  shop: ShoppingBag,
  profile: IdCard,
};

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Accepted hackers and admins get the whole hub; everyone else only sees their application.
export async function getAccess(supabase: Supabase, userId: string) {
  const [{ data: admin }, { data: application }] = await Promise.all([
    supabase.from("admin_users").select("user_id").eq("user_id", userId).maybeSingle(),
    supabase.from("applications").select("decision").eq("user_id", userId).maybeSingle(),
  ]);
  const allowed = admin || application?.decision === "accepted" ? (Object.keys(TABS) as Tab[]) : (["application"] as Tab[]);
  return { admin, allowed };
}

const sidebarLabel = "mb-3 px-3 text-sm font-bold tracking-wider text-neutral-500 uppercase";

export function DashboardSidebar({ allowed, active }: { allowed: Tab[]; active: Tab }) {
  return (
<aside className="bg-white/75 px-4 backdrop-blur-sm md:sticky md:top-[7.5rem] md:-mb-16 md:h-[calc(100dvh-7.5rem)] md:flex md:flex-col md:border-r md:border-neutral-200 md:px-5 md:pb-4 rounded-2xl">      
      <nav aria-label="Dashboard" className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-col md:overflow-visible md:px-0 md:pb-0">
        {/* The passport has its own button in the header instead. */}
        {allowed.filter((key) => key !== "passport").map((key) => {
          const Icon = ICONS[key];
          const isActive = active === key;
          return (
            <Link
              key={key}
              href={key === "team" ? "/dashboard/team" : key === "schedule" ? "/dashboard" : `/dashboard?tab=${key}`}
              aria-current={isActive ? "page" : undefined}
              className={`flex min-h-12 items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 ${isActive ? "bg-amber-50 text-amber-900" : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                }`}
            >
              <Icon className={`size-6 shrink-0 ${isActive ? "text-amber-600" : "text-neutral-400"}`} aria-hidden />
              {TABS[key]}
            </Link>
          );
        })}
      </nav>

      {/* Phones already get Log out in the top navbar. */}
      <div className="mt-auto hidden pt-8 md:block">
        <p className={sidebarLabel}>Account</p>
        <form action={signOut}>
          <button
            type="submit"
            className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
          >
            <LogOut className="size-6 shrink-0 text-neutral-400" aria-hidden />
            Log out
          </button>
        </form>
      </div>
    </aside>
  );
}