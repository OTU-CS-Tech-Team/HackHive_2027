import { beforeEach, describe, expect, it, vi } from 'vitest';

const ID = '11111111-1111-1111-1111-111111111111';

const { state, client, sendDecisionEmail, revalidatePath } = vi.hoisted(() => {
  const state = {
    isAdmin: true,
    updateRows: [{ email: 'sam@test.com', first_name: 'Sam' }] as { email: string; first_name: string | null }[],
    updateError: null as { message: string } | null,
    lookup: { email: 'sam@test.com', first_name: 'Sam', decision: 'accepted' } as Record<string, unknown> | null,
    updates: [] as unknown[],
    filters: [] as string[],
  };

  const builder = () => {
    const query = {
      select: () => query,
      update: (fields: unknown) => {
        state.updates.push(fields);
        return query;
      },
      eq: (column: string, value: string) => {
        state.filters.push(`${column}=${value}`);
        return query;
      },
      or: (filter: string) => {
        state.filters.push(`or=${filter}`);
        return query;
      },
      not: (column: string, op: string) => {
        state.filters.push(`not=${column}.${op}`);
        return query;
      },
      maybeSingle: async () => ({ data: state.isAdmin ? state.lookup : null }),
      then: (resolve: (value: unknown) => void) => resolve({ data: state.updateRows, error: state.updateError }),
    };
    return query;
  };

  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'admin-1' } } }) },
    from: () => builder(),
  };

  return { state, client, sendDecisionEmail: vi.fn(), revalidatePath: vi.fn() };
});

vi.mock('next/cache', () => ({ revalidatePath, updateTag: vi.fn() }));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ origin: 'https://hackhive.test' }) }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => client }));
vi.mock('@/lib/application/decision-email', () => ({ sendDecisionEmail }));

async function actions() {
  return import('../src/app/admin/actions');
}

beforeEach(() => {
  state.isAdmin = true;
  state.updateRows = [{ email: 'sam@test.com', first_name: 'Sam' }];
  state.updateError = null;
  state.lookup = { email: 'sam@test.com', first_name: 'Sam', decision: 'accepted' };
  state.updates = [];
  state.filters = [];
  sendDecisionEmail.mockReset();
  sendDecisionEmail.mockResolvedValue(true);
  revalidatePath.mockClear();
});

describe('setDecision', () => {
  it('emails the applicant when the decision changes', async () => {
    const { setDecision } = await actions();

    const result = await setDecision(ID, 'accepted');

    expect(result.ok).toBe(true);
    expect(sendDecisionEmail).toHaveBeenCalledTimes(1);
    expect(sendDecisionEmail).toHaveBeenCalledWith({
      to: 'sam@test.com',
      firstName: 'Sam',
      decision: 'accepted',
      siteUrl: 'https://hackhive.test',
    });
  });

  // The filter is what stops a double click emailing twice.
  it('only updates submitted applications that are not already on that decision', async () => {
    const { setDecision } = await actions();

    await setDecision(ID, 'rejected');

    expect(state.updates).toEqual([{ decision: 'rejected' }]);
    expect(state.filters.filter((filter) => !filter.startsWith('user_id='))).toEqual([
      `id=${ID}`,
      'status=submitted',
      'or=decision.is.null,decision.neq.rejected',
    ]);
  });

  it('sends nothing when the decision was already saved', async () => {
    state.updateRows = [];
    const { setDecision } = await actions();

    const result = await setDecision(ID, 'accepted');

    expect(result.ok).toBe(true);
    expect(sendDecisionEmail).not.toHaveBeenCalled();
  });

  it('moves back to pending without emailing anyone', async () => {
    const { setDecision } = await actions();

    const result = await setDecision(ID, null);

    expect(result.ok).toBe(true);
    expect(state.updates).toEqual([{ decision: null }]);
    expect(state.filters).toContain('not=decision.is');
    expect(sendDecisionEmail).not.toHaveBeenCalled();
  });

  it('keeps the decision but warns the admin when the email fails', async () => {
    sendDecisionEmail.mockResolvedValue(false);
    const { setDecision } = await actions();

    const result = await setDecision(ID, 'accepted');

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/email/i);
    expect(revalidatePath).toHaveBeenCalled();
  });

  it('sends nothing when the save fails', async () => {
    state.updateError = { message: 'nope' };
    const { setDecision } = await actions();

    const result = await setDecision(ID, 'accepted');

    expect(result).toEqual({ ok: false, message: 'nope' });
    expect(sendDecisionEmail).not.toHaveBeenCalled();
  });

  it('rejects anything that is not a decision', async () => {
    const { setDecision } = await actions();

    const result = await setDecision(ID, 'admitted-by-curl' as never);

    expect(result.ok).toBe(false);
    expect(state.updates).toHaveLength(0);
  });

  it('rejects an id that is not a uuid', async () => {
    const { setDecision } = await actions();

    const result = await setDecision('1 or 1=1', 'accepted');

    expect(result.ok).toBe(false);
    expect(state.updates).toHaveLength(0);
  });

  it('blocks people who are not admins', async () => {
    state.isAdmin = false;
    const { setDecision } = await actions();

    await expect(setDecision(ID, 'accepted')).rejects.toThrow('Admins only');
    expect(state.updates).toHaveLength(0);
    expect(sendDecisionEmail).not.toHaveBeenCalled();
  });
});

describe('resendDecisionEmail', () => {
  it('resends the saved decision', async () => {
    const { resendDecisionEmail } = await actions();

    const result = await resendDecisionEmail(ID);

    expect(result.ok).toBe(true);
    expect(sendDecisionEmail).toHaveBeenCalledWith({
      to: 'sam@test.com',
      firstName: 'Sam',
      decision: 'accepted',
      siteUrl: 'https://hackhive.test',
    });
  });

  it('has nothing to send for an undecided application', async () => {
    state.lookup = { email: 'sam@test.com', first_name: 'Sam', decision: null };
    const { resendDecisionEmail } = await actions();

    const result = await resendDecisionEmail(ID);

    expect(result.ok).toBe(false);
    expect(sendDecisionEmail).not.toHaveBeenCalled();
  });

  it('blocks people who are not admins', async () => {
    state.isAdmin = false;
    const { resendDecisionEmail } = await actions();

    await expect(resendDecisionEmail(ID)).rejects.toThrow('Admins only');
    expect(sendDecisionEmail).not.toHaveBeenCalled();
  });
});
