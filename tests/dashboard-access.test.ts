import { beforeEach, describe, expect, it, vi } from 'vitest';

const { client, updates } = vi.hoisted(() => {
  const updates: unknown[] = [];
  const state = { hasHubAccess: false };
  const client = {
    state,
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
    rpc: async (name: string) => ({ data: name === 'has_hub_access' ? state.hasHubAccess : null, error: null }),
    from: () => ({
      update: (fields: unknown) => {
        updates.push(fields);
        return { eq: async () => ({ error: null }) };
      },
    }),
  };
  return { client, updates };
});

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('qrcode', () => ({ default: { toDataURL: async () => 'data:' } }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => client }));

function profileForm() {
  const form = new FormData();
  form.set('full_name', 'Test User');
  return form;
}

describe('dashboard actions', () => {
  beforeEach(() => {
    updates.length = 0;
  });

  it('rejects applicants who were not accepted', async () => {
    client.state.hasHubAccess = false;
    const { saveProfile } = await import('../src/app/dashboard/actions');

    await expect(saveProfile(profileForm())).rejects.toThrow();
    expect(updates).toHaveLength(0);
  });

  it('lets accepted hackers through', async () => {
    client.state.hasHubAccess = true;
    const { saveProfile } = await import('../src/app/dashboard/actions');

    await expect(saveProfile(profileForm())).resolves.toBe('Saved.');
    expect(updates).toHaveLength(1);
  });
});
