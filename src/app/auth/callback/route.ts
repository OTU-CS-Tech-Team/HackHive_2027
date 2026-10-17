import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

function getSafeRedirectPath(next: string | null): string {
  if (!next) return '/';
  
  // Must start with exactly one forward slash (not // or /\)
  if (!next.startsWith('/')) return '/';
  if (next.startsWith('//')) return '/';
  if (next.startsWith('/\\')) return '/';
  if (next.length > 1 && next[1] === '\\') return '/';
  
  // Additional safety: no protocol handlers
  if (next.includes(':')) return '/';
  
  return next;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next');
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type');

  const safePath = getSafeRedirectPath(next);
  
  // Build the redirect URL safely and verify origin matches
  const redirectUrl = new URL(safePath, origin);
  if (redirectUrl.origin !== origin) {
    // Origin mismatch - redirect to home
    return NextResponse.redirect(new URL('/', origin));
  }

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(redirectUrl);
    }
  }

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as 'email' | 'signup' | 'recovery' | 'invite' | 'email_change',
    });
    if (!error) {
      return NextResponse.redirect(redirectUrl);
    }
  }

  return NextResponse.redirect(new URL('/auth/error', origin));
}
