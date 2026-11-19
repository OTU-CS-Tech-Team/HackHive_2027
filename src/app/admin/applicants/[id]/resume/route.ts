import { requireAdmin } from '@/lib/admin/require-admin';
import { redirectToResume } from '@/lib/admin/resume-link';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin('/admin/applicants');
  const { id } = await params;
  return redirectToResume(session, id);
}
