"use server";

import { revalidatePath } from "next/cache";
import { requireTeamAccess } from "@/lib/team/access";

export async function setTeamListing(listed: boolean) {
  const access = await requireTeamAccess();
  if (!access.ok) return { ok: false, message: "Couldn't verify access. Refresh and try again." };
  if (typeof listed !== "boolean") return { ok: false, message: "Choose whether to show your profile." };
  const { data, error } = await access.session.from("profiles")
    .update({ looking_for_team: listed }).eq("id", access.user.id).select("id").maybeSingle();
  if (error || !data) return { ok: false, message: "Your listing couldn't be saved. Refresh and try again." };
  revalidatePath("/dashboard/team");
  revalidatePath("/dashboard");
  return { ok: true, message: listed ? "You're now discoverable to other eligible hackers." : "Your profile is hidden from the teammate directory." };
}
