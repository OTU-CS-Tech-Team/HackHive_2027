import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
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

export async function requireUser(): Promise<User> {
  const user = await getUser();
  
  if (!user) {
    redirect('/auth/login');
  }
  
  return user;
}

export async function requireVerifiedUser(): Promise<VerifiedUser> {
  const user = await getUser();
  
  if (!user) {
    redirect('/auth/login');
  }
  
  if (!user.email || !user.email_confirmed_at) {
    redirect('/auth/verify-email');
  }
  
  return user as VerifiedUser;
}

export function isVerifiedUser(user: User | null): user is VerifiedUser {
  return user !== null && 
    typeof user.email === 'string' && 
    typeof user.email_confirmed_at === 'string';
}
