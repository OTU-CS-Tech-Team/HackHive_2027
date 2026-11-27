import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { User } from '@supabase/supabase-js';

export type VerifiedUser = User & {
  email: string;
  email_confirmed_at: string;
};

export async function getUser(): Promise<User | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getVerifiedUser(): Promise<VerifiedUser | null> {
  const user = await getUser();
  
  if (!user) return null;
  if (!user.email) return null;
  if (!user.email_confirmed_at) return null;
  
  return user as VerifiedUser;
}
export async function getAppliedUser(): Promise<VerifiedUser | null> {
  const user = await getUser();
  if (!user) return null;
  if (!user.email) return null;
  if (!user.email_confirmed_at) return null;
  const supabase = await createClient();
  const { data: application } = await supabase.from('applications').select('id, status').eq('user_id', user.id).maybeSingle();
  if (!application) return null;
  if(application.status === 'submitted') {
    return user as VerifiedUser;
  }
  return null;
}

export function isVerifiedUser(user: User | null): user is VerifiedUser {
  return user !== null && 
    typeof user.email === 'string' && 
    typeof user.email_confirmed_at === 'string';
}
