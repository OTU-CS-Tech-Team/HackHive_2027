import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { saveAvatar, saveBee } from '@/app/dashboard/actions';
import { DEFAULT_AVATAR } from '@/lib/avatar';

// A session whose profiles.update(...).eq(...) resolves to { error }.
function setup({ user = { id: 'self' } as { id: string } | null, hub = true, error = null as { message: string } | null } = {}) {
  const query = {
    update: vi.fn(() => query),
    eq: vi.fn(async () => ({ error })),
  };
  const session = {
    from: vi.fn(() => query),
    rpc: vi.fn(async () => ({ data: hub, error: null })),
    auth: { getUser: vi.fn(async () => ({ data: { user } })) },
  };
  vi.mocked(createClient).mockResolvedValue(session as unknown as Awaited<ReturnType<typeof createClient>>);
  return { query };
}

beforeEach(() => vi.clearAllMocks());

describe('saving the bee', () => {
  it('lets any signed-in applicant save their bee and its name', async () => {
    const { query } = setup({ hub: false });
    expect(await saveBee(DEFAULT_AVATAR, '  Buzz ')).toBe(true);
    expect(query.update).toHaveBeenCalledWith({ avatar: { ...DEFAULT_AVATAR, name: 'Buzz' } });
    expect(query.eq).toHaveBeenCalledWith('id', 'self');
  });

  it('saves nothing when signed out or when the bee is not from the wardrobe', async () => {
    const signedOut = setup({ user: null });
    expect(await saveBee(DEFAULT_AVATAR, 'Buzz')).toBe(false);
    expect(signedOut.query.update).not.toHaveBeenCalled();
    const { query } = setup();
    expect(await saveBee({ ...DEFAULT_AVATAR, top: { item: 'cape', color: 'red' } }, 'Buzz')).toBe(false);
    expect(query.update).not.toHaveBeenCalled();
  });

  it('reports a failed write as false instead of throwing', async () => {
    setup({ error: { message: 'column "avatar" does not exist' } });
    expect(await saveBee(DEFAULT_AVATAR, 'Buzz')).toBe(false);
  });

  it('keeps the name when an accepted hacker saves in the wardrobe', async () => {
    const { query } = setup();
    await saveAvatar(DEFAULT_AVATAR, 'Buzz');
    expect(query.update).toHaveBeenCalledWith({ avatar: { ...DEFAULT_AVATAR, name: 'Buzz' } });
    expect(redirect).toHaveBeenCalledWith('/dashboard?tab=passport');
  });

  it('still keeps the wardrobe save to accepted hackers', async () => {
    setup({ hub: false });
    await expect(saveAvatar(DEFAULT_AVATAR, 'Buzz')).rejects.toThrow('Only accepted hackers');
  });
});
