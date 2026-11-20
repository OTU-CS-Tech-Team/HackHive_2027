import { Suspense } from "react";
import Link from "next/link";
import { avatarOf } from "@/lib/avatar";
import { requireTeamAccess } from "@/lib/team/access";
import { AvatarPicker } from "./AvatarPicker";
import styles from "./avatar.module.css";

export const metadata = { title: "Your avatar | HackHive 2027" };

export default function AvatarPage() {
  return (
    <main className={styles.page}>
      <Suspense fallback={<p role="status">Opening your wardrobe…</p>}>
        <Wardrobe />
      </Suspense>
    </main>
  );
}

async function Wardrobe() {
  // Same accepted-hacker gate as the rest of the hub.
  const access = await requireTeamAccess("/dashboard/avatar");
  const { data, error } = access.ok
    ? await access.session.from("profiles").select("avatar").eq("id", access.user.id).maybeSingle()
    : { data: null, error: true };
  if (error) {
    return (
      <p role="alert">
        Your wardrobe couldn&apos;t be loaded.{" "}
        <Link href="/dashboard?tab=passport" className="underline">
          Back to your passport
        </Link>
      </p>
    );
  }
  return <AvatarPicker saved={avatarOf(data?.avatar)} />;
}
