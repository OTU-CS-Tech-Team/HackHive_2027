// The simple content tables /admin edits. One config drives the form, the
// list, and the server-side validation, so they can't drift apart.
// (Events have their own form: they need Toronto-time date handling.)

export type Field = {
  name: string;
  label: string;
  type?: "text" | "textarea" | "number" | "url" | "image" | "checkbox";
  options?: Record<string, string>; // renders a <select>
  required?: boolean;
  min?: number; // numbers; default 0
  nullable?: boolean; // numbers: blank saves null instead of 0
};

export type Row = Record<string, unknown> & { id: string };

type TableConfig = {
  heading: string;
  noun: string;
  cacheTag?: string; // matches cacheTag() in lib/content.ts
  fields: Field[];
  summary: (row: Row) => string;
};

const SPONSOR_TIERS = { gold: "Gold", silver: "Silver", bronze: "Bronze" };
const ROLES = { speaker: "Keynote speaker", judge: "Judge" };

export const TABLES = {
  sponsors: {
    heading: "Sponsors",
    noun: "sponsor",
    cacheTag: "sponsors",
    fields: [
      { name: "name", label: "Name", required: true },
      { name: "tier", label: "Tier", options: SPONSOR_TIERS, required: true },
      { name: "website_url", label: "Website", type: "url" },
      { name: "sort_order", label: "Order (lower shows first)", type: "number" },
      { name: "logo_url", label: "Logo", type: "image" },
    ],
    summary: (row) => SPONSOR_TIERS[row.tier as keyof typeof SPONSOR_TIERS],
  },
  speakers_judges: {
    heading: "Speakers & judges",
    noun: "person",
    cacheTag: "people",
    fields: [
      { name: "name", label: "Name", required: true },
      { name: "role", label: "Role", options: ROLES, required: true },
      { name: "title", label: "Job title" },
      { name: "company", label: "Company" },
      { name: "linkedin_url", label: "LinkedIn", type: "url" },
      { name: "sort_order", label: "Order (lower shows first)", type: "number" },
      { name: "photo_url", label: "Photo", type: "image" },
      { name: "bio", label: "Bio", type: "textarea" },
    ],
    summary: (row) => [ROLES[row.role as keyof typeof ROLES], row.company].filter(Boolean).join(" · "),
  },
  shop_items: {
    heading: "Points shop",
    noun: "item",
    fields: [
      { name: "name", label: "Name", required: true },
      { name: "cost", label: "Cost (points)", type: "number", required: true, min: 1 },
      { name: "stock", label: "Stock (blank = unlimited)", type: "number", nullable: true },
      { name: "sort_order", label: "Order (lower shows first)", type: "number" },
      { name: "active", label: "Show in shop", type: "checkbox" },
      { name: "image_url", label: "Image", type: "image" },
      { name: "description", label: "Description", type: "textarea" },
    ],
    summary: (row) =>
      [`${row.cost} pts`, row.stock === null ? "unlimited" : `${row.stock} left`, !row.active && "hidden"].filter(Boolean).join(" · "),
  },
} satisfies Record<string, TableConfig>;

export type TableName = keyof typeof TABLES;
