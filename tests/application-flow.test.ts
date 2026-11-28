import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { calls, serviceClient, userClient, revalidatePath } = vi.hoisted(() => {
  const calls: string[] = [];
  const state = {
    rpcError: null as { message: string } | null,
    draftCreatedAt: null as string | null,
    selected: '',
    rateLimitChecks: 0,
    resumeMissing: false,
    upsertError: null as { message: string } | null,
    ownStatus: null as string | null,
    open: true,
    // Rate limit checks, uploads and RPCs in the order they happened.
    order: [] as string[],
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
    from: () => lookup,
    storage: {
      from: () => ({
        upload: async () => {
          state.order.push('upload');
          return { error: null };
        },
      }),
    },
    rpc: async (name: string) => {
      state.order.push(name);
      if (name === 'reg_check_rate_limit') {
        state.rateLimitChecks++;
        return { data: true, error: null };
      }
      calls.push(name);
      return state.rpcError
        ? { data: null, error: state.rpcError }
        : { data: { ok: true, application_id: 'app-1', submitted_at: '2026-10-31T00:00:00Z' }, error: null };
    },
  };

  const settings = {
    select: () => settings,
    eq: () => settings,
    single: async () => ({ data: { applications_open: state.open, deadline: null } }),
    maybeSingle: async () => ({ data: state.ownStatus ? { status: state.ownStatus } : null }),
    upsert: async () => ({ error: state.upsertError }),
  };

  const userClient = {
    from: () => settings,
    storage: {
      from: () => ({
        list: async () => ({
          data: state.resumeMissing ? [] : [{ name: 'resume-1.pdf', metadata: { mimetype: 'application/pdf', size: 100 } }],
          error: null,
        }),
      }),
    },
  };

  return { calls, serviceClient, userClient, revalidatePath: vi.fn() };
});

vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('next/server', () => ({ after: vi.fn() }));
vi.mock('@/lib/email', () => ({ sendApplicationReceivedEmail: vi.fn() }));
vi.mock('@/lib/hive/openai', () => ({ scoreInBackground: vi.fn() }));
vi.mock('@/lib/auth/helpers', () => ({
  getVerifiedUser: async () => ({ id: 'user-1', email: 'Hacker@Test.com' }),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => userClient,
  createServiceClient: () => serviceClient,
}));
vi.mock('@/lib/indemnification', () => ({ previewFilledForm: async () => new Uint8Array() }));

// Puts back the console.error spies; the vi.fn() mocks above aren't spies, so they stay.
afterEach(() => {
  vi.restoreAllMocks();
});

const validFields = {
  first_name: 'Test',
  last_name: 'User',
  phone: '1234567890',
  age: 21,
  city: 'Oshawa',
  country: 'Canada',
  university: 'Ontario Tech',
  program: 'CS',
  level_of_study: 'undergrad',
  year_of_study: '3',
  grad_date: '2027-05-01',
  resume_path: 'user-1/resume-1.pdf',
  q_proud: 'Something I built',
  q_hack: 'Something I hacked',
  team_status: 'solo',
  tshirt_size: 'M',
  gender: 'woman',
  ethnicity: 'asian',
  consent_coc: true,
  consent_privacy: true,
  consent_indemnification: true,
  consent_esignature: true,
  consent_mlh_coc: true,
  consent_mlh_share: true,
};

async function submit(startedAt = Date.now() - 60_000) {
  const { submitApplication } = await import('../src/app/actions/applications');
  return submitApplication({
    fields: validFields,
    turnstileToken: 'token',
    startedAt,
    submissionId: '22222222-2222-4222-8222-222222222222',
  });
}

describe('submitApplication', () => {
  beforeEach(() => {
    calls.length = 0;
    serviceClient.state.rpcError = null;
    serviceClient.state.draftCreatedAt = null;
    serviceClient.state.rateLimitChecks = 0;
    serviceClient.state.resumeMissing = false;
    serviceClient.state.open = true;
    serviceClient.state.order = [];
    revalidatePath.mockClear();
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key');
    vi.stubEnv('RATE_LIMIT_HASH_SECRET', 'test-secret');
    vi.stubEnv('TURNSTILE_SECRET_KEY', '1x0000000000000000000000000000000AA');
  });

  // The reason is logged server-side; the browser only gets a generic message.
  it('keeps the database reason out of the response when the submit call fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    serviceClient.state.rpcError = { message: 'permission denied for function is_admin' };

    const result = await submit();

    expect(result).toEqual({ ok: false, code: 'server', error: 'Failed to submit application' });
  });

  // The RPC inserts the row itself (on conflict, draft only), so no saved draft is needed.
  it('submits when autosave never saved a draft', async () => {
    const result = await submit();

    expect(result.ok).toBe(true);
    expect(calls).toEqual(['reg_submit_application']);
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

  // Fixable mistakes shouldn't use up one of the five attempts an hour.
  it('does not count a missing resume against the rate limit', async () => {
    serviceClient.state.resumeMissing = true;

    const result = await submit();

    expect(result).toMatchObject({ ok: false, code: 'validation' });
    expect(serviceClient.state.rateLimitChecks).toBe(0);
  });

  it('checks the rate limit before a real submit', async () => {
    await submit();

    expect(serviceClient.state.rateLimitChecks).toBe(2);
    expect(serviceClient.state.order).toEqual(['reg_check_rate_limit', 'reg_check_rate_limit', 'upload', 'reg_submit_application']);
  });
});

describe('saveDraft', () => {
  beforeEach(() => {
    serviceClient.state.upsertError = null;
    serviceClient.state.ownStatus = null;
    serviceClient.state.open = true;
  });

  async function save() {
    const { saveDraft } = await import('../src/app/actions/applications');
    return saveDraft({ first_name: 'Test' });
  }

  // e.g. autosave from a tab left open after submitting: RLS refuses it with a generic error.
  it('says the application is already submitted when the row is submitted', async () => {
    serviceClient.state.upsertError = { message: 'new row violates row-level security policy for table "applications"' };
    serviceClient.state.ownStatus = 'submitted';

    expect(await save()).toMatchObject({ ok: false, code: 'already_submitted' });
  });

  it('still reports a real failure on a draft as a server error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    serviceClient.state.upsertError = { message: 'boom' };
    serviceClient.state.ownStatus = 'draft';

    expect(await save()).toMatchObject({ ok: false, code: 'server' });
  });

  // A tab left open past the deadline after submitting still goes to their status.
  it('says the application is already submitted once closed, if the row is submitted', async () => {
    serviceClient.state.open = false;
    serviceClient.state.ownStatus = 'submitted';

    expect(await save()).toMatchObject({ ok: false, code: 'already_submitted' });
  });

  it('says applications are closed once closed, if the row is a draft', async () => {
    serviceClient.state.open = false;
    serviceClient.state.ownStatus = 'draft';

    expect(await save()).toMatchObject({ ok: false, code: 'locked' });
  });
});
