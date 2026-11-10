import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/require-admin';
import { createServiceClient } from '@/lib/supabase/server';

// The resumes bucket's admin policy only covers reg_admins, not the admin_users
// who use /admin, so sign the link with the service role after the admin check.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin('/admin/applicants');
  const { id } = await params;

  const { data: application } = await session.from('applications').select('resume_path').eq('id', id).maybeSingle();
  if (!application?.resume_path) {
    return new NextResponse('No resume on file.', { status: 404 });
  }

  const { data, error } = await createServiceClient().storage.from('resumes').createSignedUrl(application.resume_path, 300);
  if (error || !data) {
    console.error('Resume link error:', error);
    return new NextResponse("Couldn't open that resume. Try again.", { status: 502 });
  }

  return NextResponse.redirect(data.signedUrl);
}
