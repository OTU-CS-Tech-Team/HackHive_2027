import { beforeEach, describe, expect, it, vi } from 'vitest';

const { calls, serviceClient, userClient, revalidatePath } = vi.hoisted(() => {
  const calls: string[] = [];
  const state = {
    rpcError: null as { message: string } | null,
    upsertError: null as { message: string } | null,
    draftCreatedAt: null as string | null,
    selected: '',
  };

  const lookup = {
    select: (columns: string) => {
      state.selected = columns;
      return lookup;
    },
    eq: () => lookup,
    maybeSingle: async () => ({
      data: state.selected === 'created_at' && state.draftCreatedAt ? { created_at: state.draftCreatedAt } : null,
    }),
  };

  const serviceClient = {
    state,
    upsertArgs: [] as unknown[][],
    from: () => ({
      ...lookup,
      upsert: async (...args: unknown[]) => {
        calls.push('upsert');
        serviceClient.upsertArgs.push(args);
        return { error: state.upsertError };
      },
    }),
    rpc: async (name: string) => {
      if (name === 'reg_check_rate_limit') return { data: true, error: null };
      calls.push(name);
      return state.rpcError
        ? { data: null, error: state.rpcError }
        : { data: { ok: true, application_id: 'app-1', submitted_at: '2026-10-31T00:00:00Z' }, error: null };
    },
  };

  const settings = {
    select: () => settings,
    eq: () => settings,
    single: async () => ({ data: { applications_open: true, deadline: null } }),
  };

  const userClient = {
    from: () => settings,
    storage: {
      from: () => ({
        list: async () => ({ data: [{ name: 'resume-1.pdf', metadata: { mimetype: 'application/pdf', size: 100 } }], error: null }),
      }),
    },
  };

  return { calls, serviceClient, userClient, revalidatePath: vi.fn() };
});

vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('@/lib/auth/helpers', () => ({
  getVerifiedUser: async () => ({ id: 'user-1', email: 'Hacker@Test.com' }),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => userClient,
  createServiceClient: () => serviceClient,
}));

const validFields = {
  first_name: 'Test',
  last_name: 'User',
  phone: '1234567890',
  age: 21,
  city: 'Oshawa',
  country: 'Canada',
  university: 'Ontario Tech',
  program: 'CS',
  year_of_study: '3',
  grad_date: '2027-05-01',
  resume_path: 'user-1/resume-1.pdf',
  q_proud: 'Something I built',
  q_hack: 'Something I hacked',
  team_status: 'solo',
  tshirt_size: 'M',
  consent_coc: true,
  consent_privacy: true,
};

async function submit(startedAt = Date.now() - 60_000) {
  const { submitApplication } = await import('../src/app/actions/applications');
  return submitApplication({
    fields: validFields,
    turnstileToken: 'token',
    startedAt,
    submissionId: 'submission-1',
  });
}

describe('submitApplication', () => {
  beforeEach(() => {
    calls.length = 0;
    serviceClient.upsertArgs.length = 0;
    serviceClient.state.rpcError = null;
    serviceClient.state.upsertError = null;
    serviceClient.state.draftCreatedAt = null;
    revalidatePath.mockClear();
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key');
    vi.stubEnv('RATE_LIMIT_HASH_SECRET', 'test-secret');
    vi.stubEnv('TURNSTILE_SECRET_KEY', '1x0000000000000000000000000000000AA');
  });

  it('reports the database reason when creating the draft row fails', async () => {
    serviceClient.state.upsertError = { message: 'Invalid API key' };

    const result = await submit();

    expect(result).toMatchObject({ ok: false, code: 'server', error: "Couldn't prepare application: Invalid API key" });
    expect(calls).toEqual(['upsert']);
  });

  it('reports the database reason when the submit call fails', async () => {
    serviceClient.state.rpcError = { message: 'permission denied for function is_admin' };

    const result = await submit();

    expect(result).toMatchObject({ ok: false, code: 'server', error: 'Failed to submit application: permission denied for function is_admin' });
  });

  it('lets someone finish a saved draft right after reopening the page', async () => {
    serviceClient.state.draftCreatedAt = new Date(Date.now() - 86_400_000).toISOString();

    const result = await submit(Date.now() - 500);

    expect(result.ok).toBe(true);
  });

  it('still stops a brand new submission sent straight after the page loads', async () => {
    const result = await submit(Date.now() - 500);

    expect(result).toMatchObject({ ok: false, code: 'too_fast' });
    expect(calls).toEqual([]);
  });

  it('still stops a draft created moments ago', async () => {
    serviceClient.state.draftCreatedAt = new Date(Date.now() - 500).toISOString();

    const result = await submit(Date.now() - 500);

    expect(result).toMatchObject({ ok: false, code: 'too_fast' });
  });

  it.each(['SUPABASE_SERVICE_ROLE_KEY', 'RATE_LIMIT_HASH_SECRET', 'TURNSTILE_SECRET_KEY'])(
    'names %s when the host is missing it',
    async (name) => {
      vi.stubEnv(name, '');

      const result = await submit();

      expect(result).toMatchObject({ ok: false, code: 'server' });
      expect(result.ok === false && result.error).toContain(name);
      expect(calls).toEqual([]);
    },
  );

  // The RPC updates `where status = 'draft'`, so with no row it returns no_draft_found.
  it('creates the draft row before the RPC when autosave never saved one', async () => {
    const result = await submit();

    expect(result.ok).toBe(true);
    expect(calls).toEqual(['upsert', 'reg_submit_application']);
    expect(serviceClient.upsertArgs[0]).toEqual([
      { user_id: 'user-1', email: 'hacker@test.com' },
      { onConflict: 'user_id', ignoreDuplicates: true },
    ]);
  });

  it('refreshes every page that shows the status once submitted', async () => {
    await submit();

    expect(revalidatePath.mock.calls.flat().sort()).toEqual(['/apply', '/apply/status', '/dashboard']);
  });

  it('does not refresh pages when the submit fails', async () => {
    serviceClient.state.rpcError = { message: 'boom' };

    const result = await submit();

    expect(result.ok).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
