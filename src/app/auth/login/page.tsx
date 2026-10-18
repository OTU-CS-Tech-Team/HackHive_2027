import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./LoginForm";

export const instant = false;

interface LoginPageProps {
  searchParams: Promise<{ next?: string }>;
}

function isValidRedirectPath(path: string | undefined): boolean {
  if (!path) return false;
  if (!path.startsWith('/')) return false;
  if (path.startsWith('//')) return false;
  if (path.startsWith('/\\')) return false;
  if (path.includes(':')) return false;
  return true;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  const params = await searchParams;
  const next = isValidRedirectPath(params.next) ? params.next! : "/apply";
  
  if (user) {
    redirect(next);
  }

  return <LoginForm next={next} />;
}
