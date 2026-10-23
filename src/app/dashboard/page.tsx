/* eslint-disable @next/next/no-img-element -- avatars come from Storage / OAuth providers */
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ActionForm } from "@/components/ActionForm";
import { ApplicationView } from "@/components/ApplicationView";
import { ScheduleSection } from "@/components/sections/ScheduleSection";
import { signOut } from "@/app/actions/auth";
import { getMyApplication } from "@/lib/application/api";
import { formatDateTime } from "@/lib/time";
import { createClient } from "@/lib/supabase/server";
import { saveEmergencyInfo, saveProfile, mintCheckinToken } from "./actions";
import { AvatarUpload } from "./AvatarUpload";
import { CheckinQr } from "./CheckinQr";

export const metadata: Metadata = { title: "Dashboard | HackHive 2027" };

const card = "rounded-lg border border-neutral-200 p-5";
const input = "w-full rounded border border-neutral-300 px-3 py-2";
const muted = "text-sm text-neutral-600";

// Sidebar entries; the panel on the right is picked by ?tab=, schedule by default.
const TABS = {
  schedule: "Schedule",
  application: "Application",
  team: "Looking for group",
  checkout: "Hardware checkout",
  hunt: "Scavenger hunt",
  shop: "Points shop",
  profile: "Pass & profile",
} as const;
type Tab = keyof typeof TABS;

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

  return (
    <main className="mx-auto max-w-6xl px-4 pt-24 pb-16">
      <header className="mb-6 flex items-center gap-3 border-b border-neutral-200 pb-4">
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="" referrerPolicy="no-referrer" className="size-10 rounded-full object-cover" />
        ) : (
          <span className="size-10 shrink-0 rounded-full bg-amber-200" aria-hidden />
        )}
        <h1 className="flex-1 text-xl font-bold">Hey {profile?.full_name ?? "hacker"}</h1>
        {admin && (
          <Link href="/admin" className="rounded border px-4 py-2">
            Admin
          </Link>
        )}
        <form action={signOut}>
          <button type="submit" className="rounded border px-4 py-2">
            Sign out
          </button>
        </form>
      </header>

      <div className="grid gap-6 md:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label="Dashboard" className="flex gap-1 overflow-x-auto md:flex-col md:self-start md:border-r md:border-neutral-200 md:pr-4">
          {allowed.map((key) => (
            <Link
              key={key}
              href={key === "team" ? "/dashboard/team" : key === "schedule" ? "/dashboard" : `/dashboard?tab=${key}`}
              aria-current={tab === key ? "page" : undefined}
              className={`rounded px-3 py-2 whitespace-nowrap ${tab === key ? "bg-neutral-900 text-white" : "hover:bg-neutral-100"}`}
            >
              {TABS[key]}
            </Link>
          ))}
        </nav>

        <div>
          {tab === "schedule" && <ScheduleSection />}
          {tab === "application" && <ApplicationTab />}
          {tab === "team" && <TeamTab supabase={supabase} userId={user.id} />}
          {tab === "checkout" && <CheckoutTab supabase={supabase} />}
          {tab === "hunt" && <HuntTab supabase={supabase} />}
          {tab === "shop" && <ShopTab supabase={supabase} userId={user.id} />}
          {tab === "profile" && <ProfileTab supabase={supabase} userId={user.id} email={user.email} />}
        </div>
      </div>
    </main>
  );
}

async function ApplicationTab() {
  const result = await getMyApplication();
  return (
    <section>
      <h2 className="mb-4 text-2xl font-bold">My application</h2>
      {result.ok && result.application ? (
        <ApplicationView application={result.application} />
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

async function TeamTab({ supabase, userId }: { supabase: Supabase; userId: string }) {
  const { data: teammates } = await supabase
    .from("profiles")
    .select("id, full_name, school, avatar_url, linkedin_url, github_url, instagram_url, email")
    .eq("looking_for_team", true)
    .neq("id", userId);
  return (
    <section>
      <h2 className="mb-1 text-2xl font-bold">Looking for group</h2>
      <p className={`mb-4 ${muted}`}>
        Hackers who ticked &ldquo;looking for teammates&rdquo; on their{" "}
        <Link href="/dashboard?tab=profile" className="underline">
          profile
        </Link>
        .
      </p>
      {teammates?.length ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {teammates.map((mate) => (
            <li key={mate.id} className="flex gap-3 rounded border p-3">
              {mate.avatar_url ? (
                <img src={mate.avatar_url} alt="" referrerPolicy="no-referrer" className="size-12 rounded-full object-cover" />
              ) : (
                <span className="size-12 shrink-0 rounded-full bg-neutral-200" aria-hidden />
              )}
              <div className="text-sm">
                <p className="font-semibold">{mate.full_name}</p>
                {mate.school && <p className="text-neutral-600">{mate.school}</p>}
                <p className="flex flex-wrap gap-x-3">
                  <a href={`mailto:${mate.email}`} className="underline">Email</a>
                  {mate.linkedin_url && <a href={mate.linkedin_url} target="_blank" rel="noreferrer" className="underline">LinkedIn</a>}
                  {mate.github_url && <a href={mate.github_url} target="_blank" rel="noreferrer" className="underline">GitHub</a>}
                  {mate.instagram_url && <a href={mate.instagram_url} target="_blank" rel="noreferrer" className="underline">Instagram</a>}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className={muted}>Nobody yet. Tick the box on your profile to be the first.</p>
      )}
    </section>
  );
}

async function CheckoutTab({ supabase }: { supabase: Supabase }) {
  const { data: hardware } = await supabase.from("hardware_items").select("*").order("sort_order").order("name");
  return (
    <section>
      <h2 className="mb-1 text-2xl font-bold">Hardware checkout</h2>
      <p className={`mb-4 ${muted}`}>Borrow from the help desk with your pass. Bring it back before judging.</p>
      {hardware?.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {hardware.map((item) => (
            <li key={item.id} className={`rounded border p-4 ${item.stock === 0 ? "opacity-50" : ""}`}>
              {item.image_url && <img src={item.image_url} alt="" className="mb-3 h-32 w-full rounded object-cover" />}
              <h3 className="font-semibold">{item.name}</h3>
              {item.description && <p className={muted}>{item.description}</p>}
              {item.stock !== null && <p className="mt-2 text-sm font-medium">{item.stock === 0 ? "All checked out" : `${item.stock} available`}</p>}
            </li>
          ))}
        </ul>
      ) : (
        <p className={muted}>Hardware list coming soon.</p>
      )}
    </section>
  );
}

async function HuntTab({ supabase }: { supabase: Supabase }) {
  const { data: hunt } = await supabase.from("scavenger_items").select("*").order("sort_order").order("name");
  return (
    <section>
      <h2 className="mb-1 text-2xl font-bold">Scavenger hunt</h2>
      <p className={`mb-4 ${muted}`}>Found one? Show it at the help desk with your pass to claim the points.</p>
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
      <p className={`mb-4 ${muted}`}>You have {points} pts. Redeem at the help desk. They scan your pass.</p>
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
  const [{ data: profile }, { data: emergency }, { data: balance }, { data: history }, qr] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase.from("emergency_info").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("point_balances").select("balance").eq("user_id", userId).maybeSingle(),
    supabase.from("point_transactions").select("id, amount, reason, created_at").eq("user_id", userId).order("created_at", { ascending: false }),
    mintCheckinToken(),
  ]);

  return (
    <section>
      <h2 className="mb-1 text-2xl font-bold">Pass & profile</h2>
      <p className={`mb-4 ${muted}`}>{email}</p>
      <div className="mb-4">
        <AvatarUpload />
      </div>

      {!emergency && (
        <p className="mb-6 rounded border border-amber-300 bg-amber-50 p-3">
          Add an emergency contact below before the event. Organizers only see it if they need to.
        </p>
      )}

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <section className={`${card} flex flex-col items-center text-center`}>
          <h3 className="mb-3 text-lg font-semibold">Your HackHive pass</h3>
          <CheckinQr initialQrDataUrl={qr} />
          <p className={`mt-3 ${muted}`}>Show this at check-in, events, and the help desk to earn and spend points.</p>
        </section>

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
              I&apos;m looking for teammates (shows your profile and email to other hackers)
            </label>
          </ActionForm>
        </section>

        <section className={card}>
          <h3 className="mb-1 text-lg font-semibold">Emergency info</h3>
          <p className={`mb-4 ${muted}`}>Private. Only organizers can see it, when they scan your pass.</p>
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
