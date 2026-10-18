"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { saveAvatarUrl } from "./actions";

// Phone photos are megabytes; avatars render small. Square-crop and shrink to
// a 512px webp in the browser so each hacker stores one ~50 KB file.
const AVATAR_PX = 512;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

async function downscale(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.min(AVATAR_PX, side);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not process that image.");
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not process that image."))), "image/webp", 0.82),
  );
}

export function AvatarUpload() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);

  async function handleFile(file: File) {
    if (!ACCEPTED.includes(file.type)) return setStatus("Use a JPG, PNG, or WebP image.");
    if (file.size > 15 * 1024 * 1024) return setStatus("Pick an image under 15 MB.");

    setStatus("");
    setPending(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Your session expired. Sign in again.");

      const path = `${user.id}/avatar.webp`;
      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, await downscale(file), { upsert: true, contentType: "image/webp" });
      if (error) throw new Error(error.message);

      const { publicUrl } = supabase.storage.from("avatars").getPublicUrl(path).data;
      // Cache-buster, or a replaced photo keeps showing the old one.
      await saveAvatarUrl(`${publicUrl}?v=${Date.now()}`);
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not upload that photo.");
    }
    setPending(false);
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void handleFile(file);
        }}
      />
      <button type="button" className="text-sm underline" onClick={() => inputRef.current?.click()} disabled={pending}>
        {pending ? "Uploading…" : "Change photo"}
      </button>
      {status && <p className="text-sm text-red-600">{status}</p>}
    </div>
  );
}
