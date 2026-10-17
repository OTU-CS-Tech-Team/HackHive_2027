import { Suspense } from "react";
import { createSupabaseServerClient } from "@/supabase/server-client";
import { redirect } from "next/navigation";
import { LoginButtons } from "./LoginButtons";

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

  if (user) redirect("/dashboard");

  return (
    <main className="mx-auto max-w-sm px-4 pt-24">
      <LoginButtons initialError={error ? "Sign-in didn't complete. Try again." : undefined} />
    </main>
  );
}
