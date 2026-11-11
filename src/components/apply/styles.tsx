// Shared looks for the application form, so every control matches.

const controlBase =
  "block w-full rounded-[10px] border bg-hive-field px-4 text-sm font-medium text-hive-ink placeholder:font-normal placeholder:text-hive-placeholder outline-none transition-[border-color,box-shadow] focus:border-hive-ink focus:ring-4 focus:ring-hive-honey/25 disabled:cursor-not-allowed disabled:opacity-60";

const borderFor = (error?: unknown) => (error ? "border-red-500" : "border-hive-line hover:border-[#d9cfb8]");

export const inputClass = (error?: unknown) => `${controlBase} h-11 ${borderFor(error)}`;

export const textareaClass = (error?: unknown) => `${controlBase} resize-y py-3 leading-relaxed ${borderFor(error)}`;

export const labelClass = "block text-sm font-semibold text-hive-ink";

export const hintClass = "text-[13px] text-hive-muted";

export const errorClass = "text-[13px] font-medium text-red-600";

export const linkClass =
  "font-semibold text-hive-ink underline decoration-hive-honey decoration-2 underline-offset-4 hover:decoration-hive-ink disabled:cursor-not-allowed disabled:opacity-50";

export const iconButtonClass =
  "flex size-11 shrink-0 items-center justify-center rounded-[10px] border border-hive-line text-hive-muted transition-colors hover:border-hive-ink hover:text-hive-ink disabled:cursor-not-allowed disabled:opacity-50";

export function Optional() {
  return <span className="ml-1 font-normal text-hive-muted">(optional)</span>;
}
