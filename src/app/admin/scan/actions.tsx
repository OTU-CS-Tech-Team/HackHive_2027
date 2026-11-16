"use server";

import { createClient } from "@/lib/supabase/server";

export type AwardResult =
  | { ok: true; name: string; points: number; eventTitle: string }
  | { ok: false; error: string };

export type InfoResult =
  | {
      ok: true;
      name: string;
      totalPoints: number;
      emergencyName: string | null;
      emergencyPhone: string | null;
      medicalNotes: string | null;
    }
  | { ok: false; error: string };

async function getAdminClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: admin } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  return admin ? { supabase, userId: user.id } : null;
}

export async function awardEventPoints(eventId: string, attendeeId: string): Promise<AwardResult> {
  const ctx = await getAdminClient();
  if (!ctx) return { ok: false, error: "Not authorized." };
  const { supabase, userId } = ctx;

  const [{ data: event }, { data: attendee }] = await Promise.all([
    supabase.from("events").select("title, points").eq("id", eventId).maybeSingle(),
    supabase.from("attendees").select("id, full_name").eq("id", attendeeId).maybeSingle(),
  ]);
  if (!event) return { ok: false, error: "Event not found." };
  if (!attendee) return { ok: false, error: "Pass not recognized." };

  const points = event.points ?? 0;
  const { error } = await supabase.from("point_transactions").insert({
    attendee_id: attendee.id,
    event_id: eventId,
    points,
    awarded_by: userId,
  });

  if (error) {
    if (error.code === "23505") return { ok: false, error: `${attendee.full_name} already scanned for this event.` };
    return { ok: false, error: "Could not save points. Try again." };
  }
  return { ok: true, name: attendee.full_name, points, eventTitle: event.title };
}

export async function getAttendeeInfo(attendeeId: string): Promise<InfoResult> {
  const ctx = await getAdminClient();
  if (!ctx) return { ok: false, error: "Not authorized." };
  const { supabase } = ctx;

  const [{ data: attendee }, { data: txs }] = await Promise.all([
    supabase
      .from("attendees")
      .select("full_name, emergency_contact_name, emergency_contact_phone, medical_notes")
      .eq("id", attendeeId)
      .maybeSingle(),
    supabase.from("point_transactions").select("points").eq("attendee_id", attendeeId),
  ]);
  if (!attendee) return { ok: false, error: "Pass not recognized." };

  return {
    ok: true,
    name: attendee.full_name,
    totalPoints: (txs ?? []).reduce((sum, t) => sum + (t.points ?? 0), 0),
    emergencyName: attendee.emergency_contact_name,
    emergencyPhone: attendee.emergency_contact_phone,
    medicalNotes: attendee.medical_notes,
  };
}