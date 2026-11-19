import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { redirectToResume } from "@/lib/admin/resume-link";
import { applicationIdFor } from "@/lib/review/blind";

// The original resume for a blind review card whose resume couldn't be
// anonymized. Takes the applicant number, so the card never carries the id.
export async function GET(_request: Request, { params }: { params: Promise<{ no: string }> }) {
  const session = await requireAdmin("/admin/review");
  const { no } = await params;
  const id = /^\d{1,9}$/.test(no) ? await applicationIdFor(session, Number(no)) : null;
  if (!id) return new NextResponse("Applicant not found.", { status: 404 });
  return redirectToResume(session, id);
}
