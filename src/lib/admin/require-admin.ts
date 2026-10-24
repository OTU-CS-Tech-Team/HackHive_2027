import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireAdmin(next = "/admin") {
  const session = await createClient();
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user) redirect(`/auth/login?next=${next}`);
  const { data: admin, error: adminError } = await session.from("admin_users")
    .select("user_id").eq("user_id", user.id).maybeSingle();
  if (adminError || !admin) redirect("/");
  return session;
}
