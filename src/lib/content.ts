import { cacheLife, cacheTag } from "next/cache";
import { supabasePublic } from "@/supabase/public-client";

export type EventCategory = "hackhive" | "workshop" | "fun" | "food" | "ceremony";

export type HackEvent = {
  id: string;
  title: string;
  description: string | null;
  category: EventCategory;
  location: string | null;
  host: string | null;
  starts_at: string;
  ends_at: string;
  points: number;
};

export type Sponsor = {
  id: string;
  name: string;
  tier: "gold" | "silver" | "bronze";
  logo_url: string | null;
  website_url: string | null;
};

export type Person = {
  id: string;
  name: string;
  role: "speaker" | "judge";
  title: string | null;
  company: string | null;
  bio: string | null;
  photo_url: string | null;
  linkedin_url: string | null;
};

// Content edited in the Supabase dashboard shows up within a few minutes;
// edits made from /admin show up right away (updateTag with these tags).
// The schedule also refreshes live in the browser.
async function selectAll<T>(table: string, order: string): Promise<T[]> {
  const { data, error } = await supabasePublic.from(table).select("*").order(order);
  if (error) throw error; // don't cache an empty page
  return data as T[];
}

export async function getEvents() {
  "use cache";
  cacheLife("minutes");
  cacheTag("events");
  return selectAll<HackEvent>("events", "starts_at");
}

export async function getSponsors() {
  "use cache";
  cacheLife("minutes");
  cacheTag("sponsors");
  return selectAll<Sponsor>("sponsors", "sort_order");
}

export async function getPeople() {
  "use cache";
  cacheLife("minutes");
  cacheTag("people");
  return selectAll<Person>("speakers_judges", "sort_order");
}
