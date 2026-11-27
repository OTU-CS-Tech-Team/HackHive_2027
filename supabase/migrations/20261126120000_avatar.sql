-- The bee a hacker builds on /dashboard/avatar: one { item, color } per slot
-- (the pieces live in src/lib/avatar.ts). Null means the default bee. Hackers
-- can write their own row straight through the API, so the app ignores unknown
-- pieces; the check just keeps it a small object. Safe to run twice: it was
-- 20261121000000_avatar.sql until main got a migration with that number.
alter table public.profiles
  add column if not exists avatar jsonb check (jsonb_typeof(avatar) = 'object' and octet_length(avatar::text) <= 1024);
