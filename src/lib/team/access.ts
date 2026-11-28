import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireTeamAccess(next = "/dashboard/team") {
  const session = await createClient();
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user) redirect(`/auth/login?next=${encodeURIComponent(next)}`);
  // Reuse the same database rule that guards the accepted-hacker hub.
  const { data: allowed, error: accessError } = await session.rpc("has_hub_access");
  if (accessError) return { ok: false as const };
  if (allowed !== true) redirect("/dashboard?tab=application");
  return { ok: true as const, session, user };
}
