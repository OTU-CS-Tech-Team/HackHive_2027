'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { itemRequestSchema, type ItemRequestInput } from '@/lib/itemRequests';

export type SubmitItemRequestResult = { ok: boolean; message: string };

export async function submitItemRequest(input: ItemRequestInput): Promise<SubmitItemRequestResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: 'Log in to request items.' };

  const parsed = itemRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const { items, teamMembers, details } = parsed.data;

  // RLS makes sure the row is the user's own and still pending.
  const { data, error } = await supabase
    .from('item_requests')
    .insert({ user_id: user.id, items, team_members: teamMembers, details })
    .select('queue_number')
    .single();
  // 23503: user_id points at public.profiles, and this account has no profile row yet.
  if (error?.code === '23503') return { ok: false, message: 'Finish setting up your profile before requesting items.' };
  if (error) return { ok: false, message: error.message };

  revalidatePath('/admin/requests');
  return { ok: true, message: `Request sent! You're #${data.queue_number} in the queue.` };
}
