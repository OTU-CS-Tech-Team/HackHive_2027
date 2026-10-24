import { cacheLife, cacheTag } from "next/cache";
import { supabasePublic } from "@/lib/supabase/public";

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

async function selectAll<T>(table: string, order: string): Promise<T[]> {
  try {
    const { data, error } = await supabasePublic.from(table).select("*").order(order);
    if (error) {
      console.error(`Error fetching from ${table}:`, error);
      return [];
    }
    return data as T[];
  } catch (err) {
    console.error(`Failed to fetch from ${table}:`, err);
    return [];
  }
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
