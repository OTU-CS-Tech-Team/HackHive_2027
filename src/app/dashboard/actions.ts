"use server";

import QRCode from "qrcode";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  return { supabase, user };
}

// Mints a fresh 5-minute token and wipes the old one, so only one QR per
// hacker works at a time and a shared screenshot goes stale fast.
export async function mintCheckinToken() {
  const { supabase, user } = await requireUser();
  await supabase.from("checkin_tokens").delete().eq("user_id", user.id);
  const { data, error } = await supabase
    .from("checkin_tokens")
    .insert({ user_id: user.id })
    .select("token")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not create a check-in code");
  return QRCode.toDataURL(data.token, { width: 240, margin: 1 });
}

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim() || null;

// Social links render as hrefs for other hackers (teammate finder), so only
// allow real web URLs — no javascript: links.
function webUrl(formData: FormData, key: string) {
  const value = text(formData, key);
  if (value && !/^https?:\/\/[^\s]+$/i.test(value)) throw new Error(`${key.replace("_url", "")} link must start with https://`);
  return value;
}

export async function saveProfile(formData: FormData) {
  const { supabase, user } = await requireUser();
  try {
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: text(formData, "full_name"),
        school: text(formData, "school"),
        linkedin_url: webUrl(formData, "linkedin_url"),
        github_url: webUrl(formData, "github_url"),
        instagram_url: webUrl(formData, "instagram_url"),
        looking_for_team: formData.get("looking_for_team") === "on",
      })
      .eq("id", user.id);
    if (error) return error.message;
  } catch (error) {
    return error instanceof Error ? error.message : "Could not save";
  }
  revalidatePath("/dashboard");
  return "Saved.";
}

export async function saveEmergencyInfo(formData: FormData) {
  const { supabase, user } = await requireUser();
  const contact_name = text(formData, "contact_name");
  const contact_phone = text(formData, "contact_phone");
  if (!contact_name || !contact_phone) return "Contact name and phone are required.";

  const { error } = await supabase.from("emergency_info").upsert({
    user_id: user.id,
    contact_name,
    contact_phone,
    relationship: text(formData, "relationship"),
    medical_notes: text(formData, "medical_notes"),
  });
  if (error) return error.message;
  revalidatePath("/dashboard");
  return "Saved.";
}

// The browser uploads to Storage itself (RLS keeps hackers in their own
// folder); this just records the URL, and only if it's in that folder.
export async function saveAvatarUrl(avatarUrl: string) {
  const { supabase, user } = await requireUser();
  if (!avatarUrl.includes(`/storage/v1/object/public/avatars/${user.id}/`)) {
    throw new Error("That image does not belong to your account.");
  }
  const { error } = await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}
