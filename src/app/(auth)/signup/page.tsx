import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/auth/helpers";
import { SignupForm } from "./SignupForm";

export const instant = false;

export default async function SignupPage() {
  const verifiedUser = await getVerifiedUser();
  
  if (verifiedUser) {
    redirect("/apply");
  }

  return <SignupForm />;
}
