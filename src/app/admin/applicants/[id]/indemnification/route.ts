import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/require-admin';
import { createServiceClient } from '@/lib/supabase/server';

// Like the resume route: the indemnifications bucket's admin policy only covers
// reg_admins, so sign the link with the service role after the admin check.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin('/admin/applicants');
  const { id } = await params;

  const { data: application } = await session.from('applications').select('indemnification_path').eq('id', id).maybeSingle();
  if (!application?.indemnification_path) {
    return new NextResponse('No indemnification form on file.', { status: 404 });
  }

  const { data, error } = await createServiceClient()
    .storage.from('indemnifications')
    .createSignedUrl(application.indemnification_path, 300);
  if (error || !data) {
    console.error('Indemnification link error:', error);
    return new NextResponse("Couldn't open that indemnification form. Try again.", { status: 502 });
  }

  return NextResponse.redirect(data.signedUrl);
}
