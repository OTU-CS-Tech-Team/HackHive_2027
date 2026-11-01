import { beforeEach, describe, expect, it, vi } from 'vitest';

const ID = '11111111-1111-1111-1111-111111111111';

const { state, client, service, sendDecisionEmail, revalidatePath } = vi.hoisted(() => {
  const state = {
    isAdmin: true,
    updateRows: [{ email: 'sam@test.com', first_name: 'Sam' }] as { email: string; first_name: string | null }[],
    updateError: null as { message: string } | null,
    lookup: { user_id: 'target-user', email: 'sam@test.com', first_name: 'Sam', decision: 'accepted' } as Record<string, unknown> | null,
    updates: [] as unknown[],
    filters: [] as string[],
  };

  const service = {
    targetIsAdmin: false,
    adminLookupError: null as { message: string } | null,
    deleteError: null as { message: string } | null,
    removeError: null as { message: string } | null,
    files: {} as Record<string, { name: string }[]>,
    events: [] as string[],
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({
          data: service.targetIsAdmin ? { user_id: 'target-user' } : null,
          error: service.adminLookupError,
        }),
      };
      return query;
    },
    auth: {
      admin: {
        deleteUser: async (id: string) => {
          service.events.push(`delete user ${id}`);
          return { error: service.deleteError };
        },
      },
    },
    storage: {
      from: (bucket: string) => ({
        list: async () => ({ data: service.files[bucket] ?? [], error: null }),
        remove: async (paths: string[]) => {
          service.events.push(`remove ${bucket} ${paths.join(',')}`);
          return { error: service.removeError };
        },
      }),
    },
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

  return { state, client, service, sendDecisionEmail: vi.fn(), revalidatePath: vi.fn() };
});

vi.mock('next/cache', () => ({ revalidatePath, updateTag: vi.fn() }));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ origin: 'https://hackhive.test' }) }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => client, createServiceClient: () => service }));
vi.mock('@/lib/application/decision-email', () => ({ sendDecisionEmail }));

async function actions() {
  return import('../src/app/admin/actions');
}

beforeEach(() => {
  state.isAdmin = true;
  state.updateRows = [{ email: 'sam@test.com', first_name: 'Sam' }];
  state.updateError = null;
  state.lookup = { user_id: 'target-user', email: 'sam@test.com', first_name: 'Sam', decision: 'accepted' };
  state.updates = [];
  state.filters = [];
  service.targetIsAdmin = false;
  service.adminLookupError = null;
  service.deleteError = null;
  service.removeError = null;
  service.files = {};
  service.events = [];
  sendDecisionEmail.mockReset();
  sendDecisionEmail.mockResolvedValue({ sent: true });
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
    sendDecisionEmail.mockResolvedValue({ sent: false, error: 'RESEND_API_KEY is not set' });
    const { setDecision } = await actions();

    const result = await setDecision(ID, 'accepted');

    expect(result.ok).toBe(false);
    expect(result.message).toContain('sam@test.com');
    expect(result.message).toContain('RESEND_API_KEY is not set');
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

  it('shows why the resend failed', async () => {
    sendDecisionEmail.mockResolvedValue({ sent: false, error: 'domain not verified' });
    const { resendDecisionEmail } = await actions();

    const result = await resendDecisionEmail(ID);

    expect(result.ok).toBe(false);
    expect(result.message).toContain('domain not verified');
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

describe('deleteApplicant', () => {
  it('deletes the account, then their files from both buckets', async () => {
    service.files = { resumes: [{ name: 'resume-1.pdf' }], avatars: [{ name: 'me.png' }] };
    const { deleteApplicant } = await actions();

    const result = await deleteApplicant(ID);

    expect(result).toEqual({ ok: true, message: 'Deleted sam@test.com.' });
    expect(service.events).toEqual([
      'delete user target-user',
      'remove resumes target-user/resume-1.pdf',
      'remove avatars target-user/me.png',
    ]);
    expect(revalidatePath).toHaveBeenCalled();
  });

  it('skips storage calls for someone with no files', async () => {
    const { deleteApplicant } = await actions();

    await deleteApplicant(ID);

    expect(service.events).toEqual(['delete user target-user']);
  });

  it('refuses to delete an admin', async () => {
    service.targetIsAdmin = true;
    const { deleteApplicant } = await actions();

    const result = await deleteApplicant(ID);

    expect(result.ok).toBe(false);
    expect(service.events).toEqual([]);
  });

  // A failed lookup must not read as "not an admin".
  it('deletes nothing when it cannot check for an admin', async () => {
    service.adminLookupError = { message: 'boom' };
    const { deleteApplicant } = await actions();

    const result = await deleteApplicant(ID);

    expect(result.ok).toBe(false);
    expect(service.events).toEqual([]);
  });

  it('keeps their files when the account delete fails', async () => {
    service.deleteError = { message: 'Database error deleting user' };
    service.files = { resumes: [{ name: 'resume-1.pdf' }] };
    const { deleteApplicant } = await actions();

    const result = await deleteApplicant(ID);

    expect(result.ok).toBe(false);
    expect(result.message).toContain('Database error deleting user');
    expect(service.events).toEqual(['delete user target-user']);
  });

  it('says so when the account went but files were left behind', async () => {
    service.removeError = { message: 'storage down' };
    service.files = { resumes: [{ name: 'resume-1.pdf' }] };
    const { deleteApplicant } = await actions();

    const result = await deleteApplicant(ID);

    expect(result.ok).toBe(false);
    expect(result.message).toContain('Deleted sam@test.com');
    expect(result.message).toContain('files');
  });

  it('rejects an id that is not a uuid', async () => {
    const { deleteApplicant } = await actions();

    const result = await deleteApplicant('1 or 1=1');

    expect(result.ok).toBe(false);
    expect(service.events).toEqual([]);
  });

  it('reports an applicant who no longer exists', async () => {
    state.lookup = null;
    state.isAdmin = true;
    const lookupOnce = vi.spyOn(client, 'from');
    lookupOnce.mockImplementationOnce(() => {
      lookupOnce.mockRestore();
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { user_id: 'admin-1' } }) }) }) } as never;
    });
    const { deleteApplicant } = await actions();

    const result = await deleteApplicant(ID);

    expect(result.ok).toBe(false);
    expect(service.events).toEqual([]);
  });

  it('blocks people who are not admins', async () => {
    state.isAdmin = false;
    const { deleteApplicant } = await actions();

    await expect(deleteApplicant(ID)).rejects.toThrow('Admins only');
    expect(service.events).toEqual([]);
  });
});
