"use server";

import { revalidatePath, updateTag } from "next/cache";
import { fromLocalInput } from "@/lib/time";
import { createClient } from "@/lib/supabase/server";
import { TABLES, type Field, type TableName } from "./tables";

export type ScannedHacker = {
  id: string;
  name: string;
  email: string | null;
  school: string | null;
  avatar_url: string | null;
  balance: number;
  checkedIn: string[]; // event ids they already got points for
  emergency: { contact_name: string; contact_phone: string; relationship: string | null; medical_notes: string | null } | null;
};

export type ActionResult = { ok: boolean; message: string; balance?: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// RLS (is_admin) is what actually guards these; this just gives a clear error.
async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data } = user
    ? await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle()
    : { data: null };
  if (!data) throw new Error("Admins only");
  return supabase;
}

type Supabase = Awaited<ReturnType<typeof requireAdmin>>;

async function balanceOf(supabase: Supabase, userId: string) {
  const { data } = await supabase.from("point_balances").select("balance").eq("user_id", userId).maybeSingle();
  return data?.balance ?? 0;
}

export async function lookupHacker(token: string): Promise<ScannedHacker | { error: string }> {
  const supabase = await requireAdmin();
  if (!UUID.test(token)) return { error: "That's not a HackHive pass." };

  const { data: tokenRow } = await supabase.from("checkin_tokens").select("user_id, expires_at").eq("token", token).maybeSingle();
  if (!tokenRow || new Date(tokenRow.expires_at) < new Date()) {
    return { error: "Code expired. Ask them to refresh their dashboard." };
  }

  const userId = tokenRow.user_id;
  const [{ data: profile }, { data: emergency }, balance, { data: attended }] = await Promise.all([
    supabase.from("profiles").select("full_name, email, school, avatar_url").eq("id", userId).single(),
    supabase.from("emergency_info").select("contact_name, contact_phone, relationship, medical_notes").eq("user_id", userId).maybeSingle(),
    balanceOf(supabase, userId),
    supabase.from("point_transactions").select("event_id").eq("user_id", userId).not("event_id", "is", null),
  ]);

  return {
    id: userId,
    name: profile?.full_name || profile?.email || "Hacker",
    email: profile?.email ?? null,
    school: profile?.school ?? null,
    avatar_url: profile?.avatar_url ?? null,
    balance,
    checkedIn: (attended ?? []).map((row) => row.event_id as string),
    emergency,
  };
}

async function insertTransaction(
  supabase: Supabase,
  row: { user_id: string; amount: number; reason: string; event_id?: string; shop_item_id?: string },
  success: string,
): Promise<ActionResult> {
  const { error } = await supabase.from("point_transactions").insert(row);
  if (error) {
    // 23505 = the once-per-event unique index; P0001 = a raise from the redeem trigger.
    const message = error.code === "23505" ? "Already got points for this event." : error.message;
    return { ok: false, message };
  }
  return { ok: true, message: success, balance: await balanceOf(supabase, row.user_id) };
}

export async function awardEventPoints(userId: string, eventId: string): Promise<ActionResult> {
  const supabase = await requireAdmin();
  const { data: event } = await supabase.from("events").select("title, points").eq("id", eventId).single();
  if (!event || event.points <= 0) return { ok: false, message: "That event has no points." };
  return insertTransaction(
    supabase,
    { user_id: userId, amount: event.points, reason: event.title, event_id: eventId },
    `+${event.points} for ${event.title}`,
  );
}

export async function awardPoints(userId: string, amount: number, reason: string): Promise<ActionResult> {
  const supabase = await requireAdmin();
  if (!Number.isInteger(amount) || amount === 0 || !reason.trim()) return { ok: false, message: "Need a non-zero amount and a reason." };
  return insertTransaction(supabase, { user_id: userId, amount, reason: reason.trim() }, `${amount > 0 ? "+" : ""}${amount} for ${reason.trim()}`);
}

export async function redeemItem(userId: string, itemId: string): Promise<ActionResult> {
  const supabase = await requireAdmin();
  const { data: item } = await supabase.from("shop_items").select("name").eq("id", itemId).single();
  if (!item) return { ok: false, message: "Item not found." };
  // The trigger replaces the amount with the item's real cost and checks stock/balance.
  return insertTransaction(supabase, { user_id: userId, amount: -1, reason: item.name, shop_item_id: itemId }, `Redeemed ${item.name}`);
}

const CATEGORIES = ["hackhive", "workshop", "fun", "food", "ceremony"];

// Creates an event, or updates one when the form carries an id.
export async function saveEvent(formData: FormData): Promise<string> {
  const supabase = await requireAdmin();
  const get = (key: string) => String(formData.get(key) ?? "").trim();
  const id = get("id");
  const title = get("title");
  const category = get("category");
  const points = Number(get("points") || 0);
  if (!title || !CATEGORIES.includes(category)) return "Title and category are required.";
  if (!Number.isInteger(points) || points < 0) return "Points must be a whole number, 0 or more.";

  let starts_at: string, ends_at: string;
  try {
    starts_at = fromLocalInput(get("starts_at"));
    ends_at = fromLocalInput(get("ends_at"));
  } catch {
    return "Start and end times are required.";
  }
  if (ends_at <= starts_at) return "End time has to be after the start.";

  const row = {
    title,
    category,
    starts_at,
    ends_at,
    points,
    location: get("location") || null,
    host: get("host") || null,
    description: get("description") || null,
  };
  const { error } = id ? await supabase.from("events").update(row).eq("id", id) : await supabase.from("events").insert(row);
  if (error) return error.message;
  updateTag("events");
  revalidatePath("/admin");
  return id ? "Saved." : `Added ${title}.`;
}

export async function deleteEvent(id: string): Promise<string> {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) return error.message;
  updateTag("events");
  revalidatePath("/admin");
  return "Deleted.";
}

// Sponsors, speakers/judges, shop items: validated against the same config the form is built from.
export async function saveRow(table: TableName, formData: FormData): Promise<string> {
  if (!Object.hasOwn(TABLES, table)) return "Unknown table.";
  const supabase = await requireAdmin();
  const config = TABLES[table];
  const row: Record<string, string | number | boolean | null> = {};

  for (const field of config.fields as Field[]) {
    const raw = String(formData.get(field.name) ?? "").trim();
    if (field.type === "checkbox") {
      row[field.name] = raw === "on";
    } else if (!raw) {
      if (field.required) return `${field.label} is required.`;
      row[field.name] = field.type === "number" && !field.nullable ? 0 : null;
    } else if (field.type === "number") {
      const value = Number(raw);
      if (!Number.isInteger(value) || value < (field.min ?? 0)) return `${field.label} must be a whole number, ${field.min ?? 0} or more.`;
      row[field.name] = value;
    } else if (field.options && !Object.hasOwn(field.options, raw)) {
      return `Pick a ${field.label.toLowerCase()}.`;
    } else if ((field.type === "url" || field.type === "image") && !/^https?:\/\/\S+$/i.test(raw)) {
      // Rendered as href/src on public pages, so no javascript: URLs.
      return `${field.label} must be a link starting with https://`;
    } else {
      row[field.name] = raw;
    }
  }

  const id = String(formData.get("id") ?? "");
  const { error } = id ? await supabase.from(table).update(row).eq("id", id) : await supabase.from(table).insert(row);
  if (error) return error.message;
  if ("cacheTag" in config) updateTag(config.cacheTag);
  revalidatePath("/admin");
  return id ? "Saved." : `Added ${row.name}.`;
}

export async function deleteRow(table: TableName, id: string): Promise<string> {
  if (!Object.hasOwn(TABLES, table)) return "Unknown table.";
  const supabase = await requireAdmin();
  const { error } = await supabase.from(table).delete().eq("id", id);
  // 23503: a shop item someone already redeemed is still referenced by the points ledger.
  if (error?.code === "23503") return "Someone already redeemed this, so it can't be deleted. Untick \"Show in shop\" to hide it instead.";
  if (error) return error.message;
  const config = TABLES[table];
  if ("cacheTag" in config) updateTag(config.cacheTag);
  revalidatePath("/admin");
  return "Deleted.";
}
