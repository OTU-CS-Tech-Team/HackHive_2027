import { Suspense } from "react";
import { createSupabaseServerClient } from "@/supabase/server-client";
import { LoginButtons, SignOutButton } from "./LoginButtons";

// cacheComponents is on: cookie/searchParams reads must stream behind Suspense.
export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <Suspense fallback={<main className="mx-auto max-w-sm p-8">Loading…</main>}>
      <LoginContent searchParams={searchParams} />
    </Suspense>
  );
}

async function LoginContent({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { error } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto max-w-sm p-8">
        <h1 className="mb-6 text-2xl font-bold">Sign in</h1>
        {error && <p className="mb-4 text-red-500">Sign-in failed, try again.</p>}
        <LoginButtons />
      </main>
    );
  }

  const [{ data: profile }, { data: admin }] = await Promise.all([
    supabase.from("profiles").select("full_name, avatar_url, github_url").eq("id", user.id).single(),
    supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle(),
  ]);

  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="mb-6 text-2xl font-bold">Signed in</h1>
      <p>{user.email}</p>
      <p>Name: {profile?.full_name ?? "no profile row"}</p>
      {profile?.github_url && <p>GitHub: {profile.github_url}</p>}
      <p>Admin: {admin ? "yes" : "no"}</p>
      <SignOutButton />
    </main>
  );
}
