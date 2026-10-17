import { createClient } from "@supabase/supabase-js";

// No cookies, so it's safe inside 'use cache' functions (public content only).
export const supabasePublic = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  { auth: { persistSession: false } },
);
