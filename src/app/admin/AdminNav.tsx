"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  ChartColumn,
  Cpu,
  Handshake,
  Inbox,
  LayoutDashboard,
  LogOut,
  Mic,
  ScanLine,
  Search,
  ShoppingBag,
  Tags,
  Users,
  type LucideIcon,
} from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { TABLES, type TableName } from "./tables";

const TABLE_ICONS: Record<TableName, LucideIcon> = {
  event_categories: Tags,
  sponsors: Handshake,
  speakers_judges: Mic,
  shop_items: ShoppingBag,
  scavenger_items: Search,
  hardware_items: Cpu,
};

type NavLink = { href: string; label: string; icon: LucideIcon };

const GROUPS: { title?: string; links: NavLink[] }[] = [
  { links: [{ href: "/admin", label: "Overview", icon: LayoutDashboard }] },
  {
    title: "Hackers",
    links: [
      { href: "/admin/applicants", label: "Applicants", icon: Users },
      { href: "/admin/requests", label: "Item requests", icon: Inbox },
      { href: "/admin/scan", label: "Scanner", icon: ScanLine },
      { href: "/admin/stats", label: "Stats", icon: ChartColumn },
    ],
  },
  {
    title: "Site content",
    links: [
      { href: "/admin/schedule", label: "Schedule", icon: CalendarDays },
      ...(Object.keys(TABLES) as TableName[]).map((table) => ({
        href: `/admin/${table}`,
        label: TABLES[table].heading,
        icon: TABLE_ICONS[table],
      })),
    ],
  },
];

const ring = "outline-offset-2 focus-visible:outline-2 focus-visible:outline-amber-600";

export function AdminNav() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/admin" ? pathname === href : pathname.startsWith(href));

  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-hive-line bg-hive-panel md:flex">
        <div className="border-b border-hive-line px-5 pt-6 pb-5">
          <Link href="/" className={`-ml-1 inline-flex items-center gap-2 rounded-lg ${ring}`}>
            <Image src="/Images/HackhiveLogo.png" alt="" width={40} height={40} />
            <span className="text-xs font-semibold text-hive-muted">HackHive 2027</span>
          </Link>
          <p className="mt-1 font-display text-xl font-bold text-hive-ink">Admin</p>
        </div>

        <nav aria-label="Admin" className="flex-1 overflow-y-auto px-3 py-4">
          {GROUPS.map((group, i) => (
            <div key={i} className="mb-4">
              {group.title && <p className="mb-1 px-3 text-xs font-semibold tracking-wide text-hive-muted uppercase">{group.title}</p>}
              <ul>
                {group.links.map(({ href, label, icon: Icon }) => {
                  const active = isActive(href);
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        aria-current={active ? "page" : undefined}
                        className={`flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${ring} ${
                          active ? "bg-white text-hive-ink shadow-sm ring-1 ring-hive-line" : "text-hive-ink/70 hover:bg-hive-line/60 hover:text-hive-ink"
                        }`}
                      >
                        <Icon className={`size-4 shrink-0 ${active ? "text-hive-honey" : ""}`} aria-hidden />
                        {label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="flex items-center gap-1 border-t border-hive-line px-3 py-3">
          <Link href="/dashboard" className={`flex min-h-10 flex-1 items-center gap-2 rounded-lg px-3 text-sm font-medium text-hive-ink/70 hover:bg-hive-line/60 hover:text-hive-ink ${ring}`}>
            <ArrowLeft className="size-4" aria-hidden />
            Hacker dashboard
          </Link>
          <form action={signOut}>
            <button type="submit" aria-label="Log out" title="Log out" className={`flex size-10 items-center justify-center rounded-lg text-hive-muted hover:bg-hive-line/60 hover:text-hive-ink ${ring}`}>
              <LogOut className="size-4" aria-hidden />
            </button>
          </form>
        </div>
      </aside>

      {/* Phones keep the site bar, so the tabs become a scrolling strip under it. */}
      <nav aria-label="Admin" className="overflow-x-auto border-b border-hive-line bg-hive-panel md:hidden">
        <ul className="flex w-max gap-1 px-3 py-2">
          {GROUPS.flatMap((group) => group.links).map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  ref={(link) => {
                    if (active) link?.scrollIntoView({ inline: "center", block: "nearest" });
                  }}
                  className={`flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium whitespace-nowrap ${ring} ${
                    active ? "bg-white text-hive-ink shadow-sm ring-1 ring-hive-line" : "text-hive-ink/70"
                  }`}
                >
                  <Icon className={`size-4 ${active ? "text-hive-honey" : ""}`} aria-hidden />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
