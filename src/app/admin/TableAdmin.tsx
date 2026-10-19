"use client";

import { useRef, useState, useTransition } from "react";
import { ActionForm } from "@/components/ActionForm";
import { createClient } from "@/lib/supabase/client";
import { deleteRow, saveRow } from "./actions";
import { TABLES, type Field, type Row, type TableName } from "./tables";

const card = "rounded-lg border border-neutral-200 p-5";
const input = "w-full rounded border border-neutral-300 px-3 py-2";

// Uploads to the public "media" bucket (admin-only writes) and drops the URL
// into the field; pasting a URL works too.
function ImageInput({ field, table, value }: { field: Field; table: TableName; value: unknown }) {
  const urlRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");

  async function upload(file: File) {
    setStatus("Uploading…");
    const supabase = createClient();
    const path = `${table}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from("media").upload(path, file, { contentType: file.type });
    if (error) return setStatus(error.message);
    urlRef.current!.value = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
    setStatus("Uploaded. Save to keep it.");
  }

  return (
    <div className="sm:col-span-2">
      <label>
        {field.label}
        <input ref={urlRef} name={field.name} type="url" defaultValue={(value as string) ?? ""} placeholder="https://…" className={input} />
      </label>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/svg+xml"
        className="mt-1 text-sm"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void upload(file);
        }}
      />
      {status && <p className="text-sm">{status}</p>}
    </div>
  );
}

function Fields({ table, row }: { table: TableName; row?: Row }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {row && <input type="hidden" name="id" value={row.id} />}
      {TABLES[table].fields.map((field: Field) => {
        const value = row?.[field.name];
        if (field.type === "image") return <ImageInput key={field.name} field={field} table={table} value={value} />;
        if (field.type === "checkbox") {
          return (
            <label key={field.name} className="flex items-center gap-2">
              <input type="checkbox" name={field.name} defaultChecked={(value as boolean) ?? true} />
              {field.label}
            </label>
          );
        }
        return (
          <label key={field.name} className={field.type === "textarea" ? "sm:col-span-2" : ""}>
            {field.label}
            {field.options ? (
              <select name={field.name} required={field.required} defaultValue={(value as string) ?? ""} className={input}>
                <option value="" disabled>
                  Pick one
                </option>
                {Object.entries(field.options).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            ) : field.type === "textarea" ? (
              <textarea name={field.name} rows={3} defaultValue={(value as string) ?? ""} className={input} />
            ) : (
              <input
                name={field.name}
                type={field.type ?? "text"}
                required={field.required}
                min={field.type === "number" ? (field.min ?? 0) : undefined}
                step={field.type === "number" ? 1 : undefined}
                defaultValue={(value as string | number | null) ?? ""}
                className={input}
              />
            )}
          </label>
        );
      })}
    </div>
  );
}

function DeleteButton({ table, row }: { table: TableName; row: Row }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="self-start text-sm text-red-700 underline disabled:opacity-50"
      onClick={() => {
        if (!confirm(`Delete "${row.name}"?`)) return;
        startTransition(async () => {
          const message = await deleteRow(table, row.id);
          if (message !== "Deleted.") alert(message);
        });
      }}
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}

export function TableAdmin({ table, rows }: { table: TableName; rows: Row[] }) {
  const config = TABLES[table];
  const save = saveRow.bind(null, table);
  return (
    <section id={table} className={`${card} scroll-mt-20`}>
      <h2 className="mb-4 text-lg font-semibold">
        {config.heading} ({rows.length})
      </h2>
      <details className="mb-4 rounded border border-dashed p-3">
        <summary className="cursor-pointer font-medium">Add {config.noun}</summary>
        <div className="mt-3">
          <ActionForm action={save} submitLabel={`Add ${config.noun}`}>
            <Fields table={table} />
          </ActionForm>
        </div>
      </details>
      <ol className="flex flex-col divide-y">
        {rows.map((row) => (
          <li key={row.id} className="py-3">
            <p className="font-semibold">{String(row.name)}</p>
            <p className="text-sm text-neutral-600">{config.summary(row)}</p>
            <details className="mt-2">
              <summary className="cursor-pointer text-sm underline">Edit</summary>
              <div className="mt-3 flex flex-col gap-3">
                <ActionForm action={save} submitLabel="Save changes">
                  <Fields table={table} row={row} />
                </ActionForm>
                <DeleteButton table={table} row={row} />
              </div>
            </details>
          </li>
        ))}
      </ol>
    </section>
  );
}
