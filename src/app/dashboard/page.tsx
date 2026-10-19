/* eslint-disable @next/next/no-img-element -- avatars come from Storage / OAuth providers */
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ActionForm } from "@/components/ActionForm";
import { signOut } from "@/app/actions/auth";
import { formatDateTime } from "@/lib/time";
import { createClient } from "@/lib/supabase/server";
import { saveEmergencyInfo, saveProfile, mintCheckinToken } from "./actions";
import { AvatarUpload } from "./AvatarUpload";
import { CheckinQr } from "./CheckinQr";

export const metadata: Metadata = { title: "Dashboard | HackHive 2027" };

const card = "rounded-lg border border-neutral-200 p-5";
const input = "w-full rounded border border-neutral-300 px-3 py-2";

export default function DashboardPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-5xl px-4 pt-24">Loading…</main>}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/dashboard");

  const [{ data: profile }, { data: emergency }, { data: balance }, { data: history }, { data: shop }, { data: teammates }, { data: admin }, qr] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("emergency_info").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("point_balances").select("balance").eq("user_id", user.id).maybeSingle(),
      supabase.from("point_transactions").select("id, amount, reason, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("shop_items").select("*").eq("active", true).order("sort_order"),
      supabase.from("profiles").select("id, full_name, school, avatar_url, linkedin_url, github_url, instagram_url, email").eq("looking_for_team", true).neq("id", user.id),
      supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle(),
      mintCheckinToken(),
    ]);

  const points = balance?.balance ?? 0;

  return (
    <main className="mx-auto max-w-5xl px-4 pt-24 pb-16">
      <header className="mb-8 flex flex-wrap items-center gap-4">
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="" referrerPolicy="no-referrer" className="size-16 rounded-full object-cover" />
        ) : (
          <span className="size-16 rounded-full bg-amber-200" aria-hidden />
        )}
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Hey {profile?.full_name ?? "hacker"}</h1>
          <p className="text-neutral-600">{user.email}</p>
          <AvatarUpload />
        </div>
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

      {!emergency && (
        <p className="mb-6 rounded border border-amber-300 bg-amber-50 p-3">
          Add an emergency contact below before the event. Organizers only see it if they need to.
        </p>
      )}

      <div className="mb-6 grid gap-6 md:grid-cols-2">
        <section className={`${card} flex flex-col items-center text-center`}>
          <h2 className="mb-3 text-lg font-semibold">Your HackHive pass</h2>
          <CheckinQr initialQrDataUrl={qr} />
          <p className="mt-3 text-sm text-neutral-600">Show this at check-in, events, and the help desk to earn and spend points.</p>
        </section>

        <section className={card}>
          <h2 className="text-lg font-semibold">Points</h2>
          <p className="mb-4 text-4xl font-bold">{points}</p>
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
            <p className="text-sm text-neutral-600">Go to events and workshops to earn points.</p>
          )}
        </section>
      </div>

      <section className={`${card} mb-6`}>
        <h2 className="text-lg font-semibold">Shop</h2>
        <p className="mb-4 text-sm text-neutral-600">Redeem at the help desk. They scan your pass.</p>
        {shop?.length ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shop.map((item) => (
              <li key={item.id} className={`rounded border p-4 ${points < item.cost || item.stock === 0 ? "opacity-50" : ""}`}>
                {item.image_url && <img src={item.image_url} alt="" className="mb-3 h-32 w-full rounded object-cover" />}
                <h3 className="font-semibold">{item.name}</h3>
                {item.description && <p className="text-sm text-neutral-600">{item.description}</p>}
                <p className="mt-2 text-sm font-medium">
                  {item.cost} pts
                  {item.stock !== null && ` · ${item.stock === 0 ? "Sold out" : `${item.stock} left`}`}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-600">The shop opens closer to the event.</p>
        )}
      </section>

      <div className="mb-6 grid gap-6 md:grid-cols-2">
        <section className={card}>
          <h2 className="mb-4 text-lg font-semibold">Profile</h2>
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
            <label className="flex items-center gap-2">
              <input name="looking_for_team" type="checkbox" defaultChecked={profile?.looking_for_team ?? false} />
              I&apos;m looking for teammates (shows your profile and email to other hackers)
            </label>
          </ActionForm>
        </section>

        <section className={card}>
          <h2 className="mb-1 text-lg font-semibold">Emergency info</h2>
          <p className="mb-4 text-sm text-neutral-600">Private. Only organizers can see it, when they scan your pass.</p>
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

      <section className={card}>
        <h2 className="mb-1 text-lg font-semibold">Looking for a team</h2>
        <p className="mb-4 text-sm text-neutral-600">Hackers who ticked &ldquo;looking for teammates&rdquo; on their profile.</p>
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
          <p className="text-sm text-neutral-600">Nobody yet. Tick the box on your profile to be the first.</p>
        )}
      </section>
    </main>
  );
}
