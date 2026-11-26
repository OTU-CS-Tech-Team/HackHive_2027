/* eslint-disable @next/next/no-img-element -- shop and hardware images come from Storage */
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, CalendarDays, ClipboardList, Cpu, Hexagon, IdCard, LogOut, MapPin, ShoppingBag, Users, type LucideIcon } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { ActionForm } from "@/components/ActionForm";
import { ApplicationAnswers, ApplicationStatus } from "@/components/ApplicationView";
import { ScheduleSection } from "@/components/sections/ScheduleSection";
import { getMyApplication } from "@/lib/application/api";
import { MAX_PENDING_REQUESTS } from "@/lib/itemRequests";
import { formatDateTime, formatDay, formatTime } from "@/lib/time";
import { createClient } from "@/lib/supabase/server";
import { saveEmergencyInfo, saveProfile, mintCheckinToken } from "./actions";
import { AvatarUpload } from "@/components/AvatarUpload";
import { ItemRequestForm } from "./ItemRequestForm";
import { Passport } from "./Passport";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { WaterfallBackdrop } from "@/components/WaterfallBackdrop";
import { PcbBackdrop } from "@/components/PcbBackdrop";
import { BackgroundToggle } from "@/components/BackgroundToggle";

export const metadata: Metadata = { title: "Dashboard | HackHive 2027" };

const card = "rounded-lg border border-neutral-200 p-5";
const input = "w-full rounded border border-neutral-300 px-3 py-2";
const muted = "text-sm text-neutral-600";
// Status pills, the same shape as the admin pages' badges.
const pill = "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset";

// Sidebar entries; the panel on the right is picked by ?tab=, schedule by default.
const TABS = {
  schedule: "Schedule",
  application: "Application",
  team: "Looking for group",
  checkout: "Hardware checkout",
  hunt: "Scavenger hunt",
  shop: "Points shop",
  profile: "Profile",
  passport: "Passport",
} as const;
type Tab = keyof typeof TABS;

const ICONS: Record<Tab, LucideIcon> = {
  schedule: CalendarDays,
  passport: Hexagon,
  application: ClipboardList,
  team: Users,
  checkout: Cpu,
  hunt: MapPin,
  shop: ShoppingBag,
  profile: IdCard,
};

const sidebarLabel = "mb-3 px-3 text-sm font-bold tracking-wider text-neutral-500 uppercase";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export default function DashboardPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  return (
    <Suspense fallback={<main className="mx-auto max-w-6xl px-4 pt-24">Loading…</main>}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}

async function Dashboard({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const { tab: requested } = await searchParams;
  const wanted: Tab = typeof requested === "string" && Object.hasOwn(TABS, requested) ? (requested as Tab) : "schedule";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/login?next=${encodeURIComponent(wanted === "schedule" ? "/dashboard" : `/dashboard?tab=${wanted}`)}`);

  const [{ data: profile }, { data: admin }, { data: application }] = await Promise.all([
    supabase.from("profiles").select("full_name, avatar_url").eq("id", user.id).single(),
    supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle(),
    supabase.from("applications").select("decision").eq("user_id", user.id).maybeSingle(),
  ]);
  // Accepted hackers and admins get the whole hub; everyone else only sees their application and its status.
  const allowed = admin || application?.decision === "accepted" ? (Object.keys(TABS) as Tab[]) : (["application"] as Tab[]);
  const tab = allowed.includes(wanted) ? wanted : allowed[0];
  if (tab === "team") redirect("/dashboard/team");
  const region = tab === "schedule" ? "top" : tab === "application" ? "middle" : undefined;
  const framed = region !== undefined || tab === "checkout";
  return (
    <main className="pt-24 pb-16 md:grid md:grid-cols-[17rem_minmax(0,1fr)]">
      {region && <WaterfallBackdrop region={region} />}
      {tab === "checkout" && <PcbBackdrop />}
      {framed && <BackgroundToggle />}
      <DashboardSidebar allowed={allowed} active={tab} />

{/* <div className="fixed top-20 left-2 z-50 rounded bg-red-600 px-2 py-1 text-xs text-white">region: {String(region)}</div> */}
<div data-panel className={`relative z-10 mx-auto mt-6 w-full max-w-4xl min-w-0 px-4 md:mt-0 md:px-8 ${framed ? "rounded-2xl bg-white/75 py-4 shadow-lg backdrop-blur-sm" : ""}`}>          <header className="mb-6 flex items-center gap-3 border-b border-neutral-200 pb-4">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <AvatarUpload avatarUrl={profile?.avatar_url ?? null} />
              <h1 className="truncate text-xl font-bold">Hey {profile?.full_name ?? "hacker"}</h1>
            </div>
            {allowed.includes("passport") && (
              <Link
                href="/dashboard?tab=passport"
                aria-current={tab === "passport" ? "page" : undefined}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 ${
                  tab === "passport" ? "border-amber-300 bg-amber-50 text-amber-900" : "border-neutral-200 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                }`}
              >
                <Hexagon className={`size-5 shrink-0 ${tab === "passport" ? "text-amber-600" : "text-neutral-400"}`} aria-hidden />
                {TABS.passport}
              </Link>
            )}
            {admin && (
              <Link href="/admin" className="rounded border px-4 py-2 transition-colors hover:border-neutral-900 hover:bg-neutral-900 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600">
                Admin
              </Link>
            )}
          </header>

          {tab === "schedule" && <ScheduleSection />}
          {tab === "passport" && (
            <>
              <Link
                href="/dashboard?tab=profile"
                className="-ml-2 mb-4 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
              >
                <ArrowLeft className="size-4" aria-hidden />
                Back to profile
              </Link>
              <PassportTab supabase={supabase} userId={user.id} profile={profile} />
            </>
          )}
          {tab === "application" && <ApplicationTab />}
          {tab === "checkout" && <CheckoutTab supabase={supabase} userId={user.id} />}
          {tab === "hunt" && <HuntTab supabase={supabase} />}
          {tab === "shop" && <ShopTab supabase={supabase} userId={user.id} />}
          {tab === "profile" && <ProfileTab supabase={supabase} userId={user.id} email={user.email} />}
        </div>
    </main>
  );
}

async function ApplicationTab() {
  const result = await getMyApplication();
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold">My application</h2>
      {result.ok && result.application ? (
        <>
          <ApplicationStatus application={result.application} />
          <ApplicationAnswers application={result.application} />
        </>
      ) : (
        <p className={muted}>
          {result.ok ? "You haven't started an application yet. " : `${result.error}. `}
          <Link href="/apply" className="underline">
            Go to the application
          </Link>
        </p>
      )}
    </section>
  );
}

// Badges are the events a hacker was scanned into for points; missions are every
// event worth points. Both come from the same tables the admin scanner writes.
async function PassportTab({
  supabase,
  userId,
  profile,
}: {
  supabase: Supabase;
  userId: string;
  profile: { full_name: string | null; avatar_url: string | null } | null;
}) {
  const [{ data: balance }, { data: earned }, { data: events }, qr] = await Promise.all([
    supabase.from("point_balances").select("balance").eq("user_id", userId).maybeSingle(),
    supabase.from("point_transactions").select("event_id, reason").eq("user_id", userId).not("event_id", "is", null).order("created_at"),
    supabase.from("events").select("id, title, points, starts_at").gt("points", 0).order("starts_at"),
    mintCheckinToken(),
  ]);

  return (
    <Passport
      fullName={profile?.full_name ?? null}
      avatarUrl={profile?.avatar_url ?? null}
      points={balance?.balance ?? 0}
      badges={(earned ?? []).map((row) => ({ id: row.event_id as string, label: row.reason }))}
      missions={(events ?? []).map((event) => ({
        id: event.id,
        title: event.title,
        points: event.points,
        when: `${formatDay(event.starts_at).slice(0, 3)} ${formatTime(event.starts_at)}`,
      }))}
      initialQrDataUrl={qr}
    />
  );
}

async function CheckoutTab({ supabase, userId }: { supabase: Supabase; userId: string }) {
  const { data: hardware } = await supabase.from("hardware_items").select("*").order("sort_order").order("name");
  return (
    <section>
      <h2 className="mb-1 text-2xl font-bold">Hardware checkout</h2>
      <p className={`mb-4 ${muted}`}>Borrow from the help desk with your passport. Bring it back before judging.</p>
      {/* Live stock, if admins track it under Hardware. Without it there's nothing to
          show here: the full MLH list is in the request form below. */}
      {hardware?.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {hardware.map((item) => (
            <li key={item.id} className={`${card} flex flex-col ${item.stock === 0 ? "bg-neutral-50" : ""}`}>
              {item.image_url && (
                <img src={item.image_url} alt="" className={`mb-3 h-32 w-full rounded-md object-cover ${item.stock === 0 ? "opacity-50 grayscale" : ""}`} />
              )}
              <h3 className="font-semibold [overflow-wrap:anywhere]">{item.name}</h3>
              {item.description && <p className={muted}>{item.description}</p>}
              {item.stock !== null && (
                <p className="mt-auto pt-3">
                  <span className={`${pill} ${item.stock === 0 ? "bg-neutral-100 text-neutral-600 ring-neutral-300" : "bg-green-50 text-green-800 ring-green-300"}`}>
                    {item.stock === 0 ? "All checked out" : `${item.stock} available`}
                  </span>
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      <ItemRequests supabase={supabase} userId={userId} />
    </section>
  );
}

// The hacker's pending item requests with their place in the queue, and the form to
// send another, up to MAX_PENDING_REQUESTS waiting. Once an organizer accepts or
// rejects a request it leaves the queue; the hacker hears the decision by email, and
// it's kept under a collapsed "Past requests" in case that email goes missing.
async function ItemRequests({ supabase, userId }: { supabase: Supabase; userId: string }) {
  const [{ data: requests }, { data: queuePositions }] = await Promise.all([
    supabase
      .from("item_requests")
      .select("id, items, created_at, status, reviewed_at, admin_note")
      .eq("user_id", userId)
      .order("queue_number"),
    supabase.rpc("my_item_request_positions"),
  ]);

  const pending = (requests ?? []).filter((request) => request.status === "pending");
  // Reviewed ones leave the queue but stay on record below, newest first, in case the
  // decision email never arrives.
  const past = (requests ?? [])
    .filter((request) => request.status !== "pending")
    .sort((a, b) => (b.reviewed_at ?? "").localeCompare(a.reviewed_at ?? ""));
  const positionOf = new Map(
    ((queuePositions ?? []) as { id: string; queue_position: number }[]).map((row) => [row.id, row.queue_position]),
  );

  return (
    <section className={`${card} mt-8`}>
      <h3 className="mb-1 text-lg font-semibold">Request items</h3>
      <p className={`mb-4 ${muted}`}>
        Need hardware or forgot your toothbrush? Send a request and an organizer will email you once it&apos;s been reviewed.
      </p>
      {pending.length > 0 && (
        <div className="mb-6">
          <h4 className="mb-2 text-sm font-semibold text-neutral-600">
            Waiting for review <span className="tabular-nums opacity-70">{pending.length}</span>
          </h4>
          <ul className="divide-y divide-neutral-200 border-y border-neutral-200">
            {pending.map((request) => {
              const position = positionOf.get(request.id);
              return (
                <li key={request.id} className="py-3 [overflow-wrap:anywhere]">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-600">
                    <span className={`${pill} bg-amber-50 text-amber-900 ring-amber-300`}>
                      {position ? `#${position} in the queue` : "In the queue"}
                    </span>
                    <span>Sent {formatDateTime(request.created_at)}</span>
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-2" aria-label="Items">
                    {(request.items as { name: string; quantity: number }[]).map((item, i) => (
                      <li key={i} className="inline-flex items-baseline gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-sm">
                        <span className="font-semibold tabular-nums">{item.quantity}×</span>
                        {item.name}
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {pending.length < MAX_PENDING_REQUESTS ? (
        <ItemRequestForm
          pendingCount={pending.length}
          // Hardware is one of each, so anything already waiting can't be picked again.
          requestedHardware={pending.flatMap((request) =>
            (request.items as { category: string; name: string }[]).filter((item) => item.category === "hardware").map((item) => item.name),
          )}
        />
      ) : (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You have {MAX_PENDING_REQUESTS} requests in the queue. You can send another once an organizer has reviewed one of them.
        </p>
      )}
      {past.length > 0 && (
        <details className="mt-6 border-t border-neutral-200 pt-4">
          <summary className="cursor-pointer text-sm font-semibold text-neutral-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600">
            Past requests <span className="tabular-nums opacity-70">{past.length}</span>
          </summary>
          <ul className="mt-3 divide-y divide-neutral-200 border-y border-neutral-200">
            {past.map((request) => (
              <li key={request.id} className="py-3 [overflow-wrap:anywhere]">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-600">
                  <span
                    className={`${pill} ${request.status === "accepted" ? "bg-green-50 text-green-800 ring-green-300" : "bg-red-50 text-red-800 ring-red-300"}`}
                  >
                    {request.status === "accepted" ? "Accepted" : "Not accepted"}
                  </span>
                  {request.reviewed_at && <span>Reviewed {formatDateTime(request.reviewed_at)}</span>}
                </p>
                <ul className="mt-2 flex flex-wrap gap-2" aria-label="Items">
                  {(request.items as { name: string; quantity: number }[]).map((item, i) => (
                    <li key={i} className="inline-flex items-baseline gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-sm">
                      <span className="font-semibold tabular-nums">{item.quantity}×</span>
                      {item.name}
                    </li>
                  ))}
                </ul>
                {request.admin_note && (
                  <p className="mt-2 text-sm">
                    <span className="font-medium">Organizer note:</span> {request.admin_note}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

async function HuntTab({ supabase }: { supabase: Supabase }) {
  const { data: hunt } = await supabase.from("scavenger_items").select("*").order("sort_order").order("name");
  return (
    <section>
      <h2 className="mb-1 text-2xl font-bold">Scavenger hunt</h2>
      <p className={`mb-4 ${muted}`}>Found one? Show it at the help desk with your passport to claim the points.</p>
      {hunt?.length ? (
        <ol className="flex flex-col divide-y">
          {hunt.map((item) => (
            <li key={item.id} className="py-3">
              <p className="flex justify-between gap-2 font-semibold">
                {item.name}
                <span className="text-sm font-medium text-neutral-600">{item.points} pts</span>
              </p>
              {item.clue && <p className={muted}>{item.clue}</p>}
            </li>
          ))}
        </ol>
      ) : (
        <p className={muted}>The hunt starts during the event.</p>
      )}
    </section>
  );
}

async function ShopTab({ supabase, userId }: { supabase: Supabase; userId: string }) {
  const [{ data: balance }, { data: shop }] = await Promise.all([
    supabase.from("point_balances").select("balance").eq("user_id", userId).maybeSingle(),
    supabase.from("shop_items").select("*").eq("active", true).order("sort_order"),
  ]);
  const points = balance?.balance ?? 0;
  return (
    <section>
      <h2 className="mb-1 text-2xl font-bold">Points shop</h2>
      <p className={`mb-4 ${muted}`}>You have {points} pts. Redeem at the help desk. They scan your passport.</p>
      {shop?.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shop.map((item) => (
            <li key={item.id} className={`rounded border p-4 ${points < item.cost || item.stock === 0 ? "opacity-50" : ""}`}>
              {item.image_url && <img src={item.image_url} alt="" className="mb-3 h-32 w-full rounded object-cover" />}
              <h3 className="font-semibold">{item.name}</h3>
              {item.description && <p className={muted}>{item.description}</p>}
              <p className="mt-2 text-sm font-medium">
                {item.cost} pts
                {item.stock !== null && ` · ${item.stock === 0 ? "Sold out" : `${item.stock} left`}`}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className={muted}>The shop opens closer to the event.</p>
      )}
    </section>
  );
}

async function ProfileTab({ supabase, userId, email }: { supabase: Supabase; userId: string; email?: string }) {
  const [{ data: profile }, { data: emergency }, { data: balance }, { data: history }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase.from("emergency_info").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("point_balances").select("balance").eq("user_id", userId).maybeSingle(),
    supabase.from("point_transactions").select("id, amount, reason, created_at").eq("user_id", userId).order("created_at", { ascending: false }),
  ]);

  return (
    <section>
      <h2 className="mb-1 text-2xl font-bold">Profile</h2>
      <p className={`mb-4 ${muted}`}>{email}</p>

      {!emergency && (
        <p className="mb-6 rounded border border-amber-300 bg-amber-50 p-3">
          Add an emergency contact below before the event. Organizers only see it if they need to.
        </p>
      )}

      <div className="mb-6">
        <section className={card}>
          <h3 className="text-lg font-semibold">Points</h3>
          <p className="mb-4 text-4xl font-bold">{balance?.balance ?? 0}</p>
          {history?.length ? (
            <ul className="max-h-60 divide-y overflow-y-auto text-sm">
              {history.map((row) => (
                <li key={row.id} className="flex justify-between py-2">
                  <span>
                    {row.reason}
                    <span className="block text-xs text-neutral-500">{formatDateTime(row.created_at)}</span>
                  </span>
                  <span className={row.amount > 0 ? "text-emerald-700" : "text-red-700"}>
                    {row.amount > 0 ? "+" : ""}
                    {row.amount}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={muted}>Go to events and workshops to earn points.</p>
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={card}>
          <h3 className="mb-4 text-lg font-semibold">Profile</h3>
          <p className={`mb-4 ${muted}`}><Link href="/dashboard/team/profile" className="underline">Edit your teammate profile</Link> to add skills, project ideas, and the roles you&apos;re looking for.</p>
          <ActionForm action={saveProfile} submitLabel="Save profile">
            <label>
              Name
              <input name="full_name" defaultValue={profile?.full_name ?? ""} className={input} />
            </label>
            <label>
              School
              <input name="school" defaultValue={profile?.school ?? ""} className={input} />
            </label>
            <label>
              LinkedIn
              <input name="linkedin_url" type="url" placeholder="https://linkedin.com/in/…" defaultValue={profile?.linkedin_url ?? ""} className={input} />
            </label>
            <label>
              GitHub
              <input name="github_url" type="url" placeholder="https://github.com/…" defaultValue={profile?.github_url ?? ""} className={input} />
            </label>
            <label>
              Instagram
              <input name="instagram_url" type="url" placeholder="https://instagram.com/…" defaultValue={profile?.instagram_url ?? ""} className={input} />
            </label>
            <label>
              Slack profile (optional)
              <input name="slack_url" type="url" maxLength={500} placeholder="https://your-workspace.slack.com/team/U123ABC" defaultValue={profile?.slack_url ?? ""} className={input} />
            </label>
            <label className="flex items-center gap-2">
              <input name="looking_for_team" type="checkbox" defaultChecked={profile?.looking_for_team ?? false} />
              I&apos;m looking for teammates (shows your profile and provided social links to other hackers)
            </label>
          </ActionForm>
        </section>

        <section className={card}>
          <h3 className="mb-1 text-lg font-semibold">Emergency info</h3>
          <p className={`mb-4 ${muted}`}>Private. Only organizers can see it, when they scan your passport.</p>
          <ActionForm action={saveEmergencyInfo} submitLabel="Save emergency info">
            <label>
              Contact name
              <input name="contact_name" required defaultValue={emergency?.contact_name ?? ""} className={input} />
            </label>
            <label>
              Contact phone
              <input name="contact_phone" type="tel" required defaultValue={emergency?.contact_phone ?? ""} className={input} />
            </label>
            <label>
              Relationship
              <input name="relationship" defaultValue={emergency?.relationship ?? ""} className={input} />
            </label>
            <label>
              Allergies, conditions, medication
              <textarea name="medical_notes" rows={3} defaultValue={emergency?.medical_notes ?? ""} className={input} />
            </label>
          </ActionForm>
        </section>
      </div>
    </section>
  );
}
