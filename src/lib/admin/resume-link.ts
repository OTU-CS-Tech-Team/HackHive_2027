import "server-only";

import { NextResponse } from "next/server";
import { createServiceClient, type createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// The resumes bucket's admin policy only covers reg_admins, not the admin_users
// who use /admin, so sign the link with the service role after the admin check.
// The caller must have checked the admin already.
export async function redirectToResume(session: Supabase, applicationId: string) {
  const { data: application } = await session.from("applications").select("resume_path").eq("id", applicationId).maybeSingle();
  if (!application?.resume_path) {
    return new NextResponse("No resume on file.", { status: 404 });
  }

  const { data, error } = await createServiceClient().storage.from("resumes").createSignedUrl(application.resume_path, 300);
  if (error || !data) {
    console.error("Resume link error:", error);
    return new NextResponse("Couldn't open that resume. Try again.", { status: 502 });
  }

  return NextResponse.redirect(data.signedUrl);
}
