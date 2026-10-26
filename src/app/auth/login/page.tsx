import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/auth/helpers";
import { isValidRedirectPath } from "@/lib/application/form-utils";
import { LoginForm } from "./LoginForm";

export const instant = false;

interface LoginPageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = params.next && isValidRedirectPath(params.next) ? params.next : "/dashboard";
  
  const verifiedUser = await getVerifiedUser();
  if (verifiedUser) {
    redirect(next);
  }

  return <LoginForm next={next} />;
}
