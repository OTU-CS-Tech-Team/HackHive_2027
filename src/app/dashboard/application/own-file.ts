import 'server-only';
import { NextResponse } from 'next/server';
import { getVerifiedUser } from '@/lib/auth/helpers';
import { createClient, createServiceClient } from '@/lib/supabase/server';

const FILES = {
  resume: { bucket: 'resumes', column: 'resume_path', next: '/dashboard/application/resume' },
  indemnification: { bucket: 'indemnifications', column: 'indemnification_path', next: '/dashboard/application/indemnification' },
} as const;

// Sends a hacker to a short-lived link for one of their own application files.
// The path comes from their own row (read with their session), and must sit in
// their own folder, so the service role only ever signs their files. It's needed
// because the indemnifications bucket only lets admins read.
export async function redirectToOwnFile(kind: keyof typeof FILES, request: Request) {
  const { bucket, column, next } = FILES[kind];

  const user = await getVerifiedUser();
  if (!user) {
    return NextResponse.redirect(new URL(`/auth/login?next=${encodeURIComponent(next)}`, request.url));
  }

  const supabase = await createClient();
  const { data: application } = await supabase.from('applications').select(column).eq('user_id', user.id).maybeSingle();
  const path = (application as Record<string, string | null> | null)?.[column];
  if (!path || !path.startsWith(`${user.id}/`)) {
    return new NextResponse('No file on record.', { status: 404 });
  }

  const { data, error } = await createServiceClient().storage.from(bucket).createSignedUrl(path, 300);
  if (error || !data) {
    console.error(`Own ${kind} link error:`, error);
    return new NextResponse("Couldn't open that file. Try again.", { status: 502 });
  }

  return NextResponse.redirect(data.signedUrl);
}
