import { z } from 'zod';

// Total across every item in one request.
export const MAX_ITEMS = 5;

// Requests one hacker can have waiting in the queue at once. The database enforces
// it too, in supabase/migrations/20261019000000_item_requests.sql.
export const MAX_PENDING_REQUESTS = 3;

const itemSchema = z.object({
  category: z.enum(['hardware', 'toiletries', 'other']),
  name: z.string().trim().min(1).max(100),
  quantity: z.number().int().min(1).max(MAX_ITEMS),
});

export const itemRequestSchema = z.object({
  items: z
    .array(itemSchema)
    .min(1, 'Pick at least one item.')
    .refine((items) => items.reduce((sum, item) => sum + item.quantity, 0) <= MAX_ITEMS, {
      message: `You can request up to ${MAX_ITEMS} items in total.`,
    }),
  // One name per line in the form.
  teamMembers: z
    .string()
    .max(1000)
    .transform((text) => text.split('\n').map((name) => name.trim()).filter(Boolean))
    .pipe(z.array(z.string().max(100)).max(10, 'List up to 10 team members.')),
  details: z
    .string()
    .trim()
    .max(1000, 'Keep the extra details under 1000 characters.')
    .transform((text) => text || null),
});

export type ItemRequestInput = z.input<typeof itemRequestSchema>;
