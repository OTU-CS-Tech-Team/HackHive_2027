-- The bee a hacker builds in the dashboard's Your bee tab: one { item, color }
-- per slot (the pieces live in src/lib/avatar.ts). Null means the default bee.
-- Hackers can write their own row straight through the API, so the app ignores
-- unknown pieces; the check just keeps it a small object. Safe to run twice: it
-- was 20261121000000_avatar.sql, then 20261126120000_avatar.sql, until main got
-- migrations at or past those numbers.
alter table public.profiles
  add column if not exists avatar jsonb check (jsonb_typeof(avatar) = 'object' and octet_length(avatar::text) <= 1024);
