import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { isValidRedirectPath } from '@/lib/application/form-utils';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next');
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const error = searchParams.get('error');
  const error_description = searchParams.get('error_description');

  // Handle OAuth errors from provider
  if (error) {
    const errorMessage = error_description || error;
    const errorUrl = new URL('/auth/error', origin);
    errorUrl.searchParams.set('message', errorMessage);
    return NextResponse.redirect(errorUrl);
  }

  const safePath = next && isValidRedirectPath(next) ? next : '/apply';
  
  // Build the redirect URL safely and verify origin matches
  const redirectUrl = new URL(safePath, origin);
  if (redirectUrl.origin !== origin) {
    // Origin mismatch - redirect to apply
    return NextResponse.redirect(new URL('/apply', origin));
  }

  const supabase = await createClient();

  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (!exchangeError) {
      return NextResponse.redirect(redirectUrl);
    }
  }

  if (token_hash && type) {
    const { error: otpError } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as 'email' | 'signup' | 'recovery' | 'invite' | 'email_change',
    });
    if (!otpError) {
      return NextResponse.redirect(redirectUrl);
    }
  }

  return NextResponse.redirect(new URL('/auth/error', origin));
}
