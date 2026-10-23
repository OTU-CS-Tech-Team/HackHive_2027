'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { itemRequestSchema, MAX_PENDING_REQUESTS, type ItemRequestInput } from '@/lib/itemRequests';

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
    .select('id')
    .single();
  // 23503: user_id points at public.profiles, and this account has no profile row yet.
  if (error?.code === '23503') return { ok: false, message: 'Finish setting up your profile before requesting items.' };
  // HHQ01: item_requests_pending_limit, they already have the most requests allowed in the queue.
  if (error?.code === 'HHQ01')
    return {
      ok: false,
      message: `You already have ${MAX_PENDING_REQUESTS} requests in the queue. Wait for one to be reviewed first.`,
    };
  if (error) return { ok: false, message: error.message };

  revalidatePath('/admin/requests');
  revalidatePath('/dashboard');

  const { data: positions } = await supabase.rpc('my_item_request_positions');
  const position = (positions as { id: string; queue_position: number }[] | null)?.find((row) => row.id === data.id)?.queue_position;
  return { ok: true, message: position ? `Request sent! It's #${position} in the queue.` : 'Request sent!' };
}
