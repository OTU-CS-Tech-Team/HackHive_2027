import { beforeEach, describe, expect, it, vi } from 'vitest';

const ID = '11111111-1111-1111-1111-111111111111';
const CUTOFF = '2026-11-19T12:00:00.123456+00:00';
const appId = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

type Call = { table: string; op: string; values?: unknown; options?: unknown; filters: string[]; single?: boolean };
type Result = { data?: unknown; error?: { message: string } | null; count?: number | null };

const { state, client, sendDecisionEmail, revalidatePath } = vi.hoisted(() => {
  const state = {
    isAdmin: true,
    calls: [] as Call[],
    rpcCalls: [] as { name: string; args: unknown }[],
    // What a query returns; the default is an empty success.
    respond: (() => ({ data: [], error: null })) as (call: Call) => Result,
    rpc: (() => ({ data: null, error: null })) as (name: string, args: Record<string, unknown>) => Result,
  };

  const builder = (table: string) => {
    const call: Call = { table, op: 'select', filters: [] };
    const finish = () => {
      if (table === 'admin_users') return { data: state.isAdmin ? { user_id: 'admin-1' } : null, error: null };
      state.calls.push(call);
      return state.respond(call);
    };
    const query = {
      select: () => query,
      insert: (values: unknown) => Object.assign(call, { op: 'insert', values }) && query,
      upsert: (values: unknown, options: unknown) => Object.assign(call, { op: 'upsert', values, options }) && query,
      update: (values: unknown) => Object.assign(call, { op: 'update', values }) && query,
      delete: () => Object.assign(call, { op: 'delete' }) && query,
      eq: (column: string, value: unknown) => (call.filters.push(`${column}=${value}`), query),
      gt: (column: string, value: unknown) => (call.filters.push(`${column}>${value}`), query),
      is: (column: string, value: unknown) => (call.filters.push(`${column} is ${value}`), query),
      order: () => query,
      limit: () => query,
      maybeSingle: async () => {
        call.single = true;
        return finish();
      },
      then: (resolve: (value: unknown) => void, reject: (error: unknown) => void) => {
        try {
          resolve(finish());
        } catch (error) {
          reject(error);
        }
      },
    };
    return query;
  };

  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'admin-1' } } }) },
    from: (table: string) => builder(table),
    rpc: async (name: string, args: Record<string, unknown>) => {
      state.rpcCalls.push({ name, args });
      return state.rpc(name, args);
    },
  };

  return { state, client, sendDecisionEmail: vi.fn(), revalidatePath: vi.fn() };
});

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath, updateTag: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => client, createServiceClient: () => ({}) }));
vi.mock('@/lib/application/decision-email', () => ({ sendDecisionEmail }));

const actions = () => import('../src/app/admin/decisions/actions');
const writes = (table: string) => state.calls.filter((call) => call.table === table && call.op !== 'select');

beforeEach(() => {
  state.isAdmin = true;
  state.calls = [];
  state.rpcCalls = [];
  state.respond = () => ({ data: [], error: null });
  state.rpc = () => ({ data: null, error: null });
  sendDecisionEmail.mockReset();
  sendDecisionEmail.mockResolvedValue({ sent: true });
  revalidatePath.mockClear();
});

describe('stageDecision', () => {
  const applicant = (fields: Record<string, unknown>) => {
    state.respond = (call) => (call.table === 'applications' ? { data: fields, error: null } : { data: [], error: null });
  };

  it('stages the decision without emailing anyone', async () => {
    applicant({ status: 'submitted', decision: null });
    const { stageDecision } = await actions();

    const result = await stageDecision(ID, 'accepted');

    expect(result).toEqual({ ok: true, message: 'Staged: Accept. It goes out with the next wave.' });
    expect(writes('staged_decisions')).toMatchObject([
      { op: 'upsert', values: { application_id: ID, decision: 'accepted', staged_by: 'admin-1' }, options: { onConflict: 'application_id' } },
    ]);
    expect(writes('applications')).toEqual([]);
    expect(sendDecisionEmail).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith('/admin', 'layout');
  });

  it('unstages with null', async () => {
    const { stageDecision } = await actions();

    const result = await stageDecision(ID, null);

    expect(result.ok).toBe(true);
    expect(writes('staged_decisions')).toMatchObject([{ op: 'delete', filters: [`application_id=${ID}`] }]);
    expect(sendDecisionEmail).not.toHaveBeenCalled();
  });

  it('drops the staged row when they already have that decision', async () => {
    applicant({ status: 'submitted', decision: 'waitlisted' });
    const { stageDecision } = await actions();

    const result = await stageDecision(ID, 'waitlisted');

    expect(result).toEqual({ ok: true, message: 'They already have that decision. Nothing is staged.' });
    expect(writes('staged_decisions')).toMatchObject([{ op: 'delete' }]);
  });

  it('only stages submitted applications', async () => {
    applicant({ status: 'draft', decision: null });
    const { stageDecision } = await actions();

    expect((await stageDecision(ID, 'accepted')).ok).toBe(false);
    expect(writes('staged_decisions')).toEqual([]);
  });

  it('shows a failed save', async () => {
    state.respond = (call) =>
      call.table === 'applications' ? { data: { status: 'submitted', decision: null }, error: null } : { error: { message: 'nope' } };
    const { stageDecision } = await actions();

    expect(await stageDecision(ID, 'rejected')).toEqual({ ok: false, message: 'nope' });
  });

  it('rejects anything that is not a decision or a uuid', async () => {
    const { stageDecision } = await actions();

    expect((await stageDecision(ID, 'admitted-by-curl' as never)).ok).toBe(false);
    expect((await stageDecision('1 or 1=1', 'accepted')).ok).toBe(false);
    expect(state.calls).toEqual([]);
  });

  it('blocks people who are not admins', async () => {
    state.isAdmin = false;
    const { stageDecision } = await actions();

    await expect(stageDecision(ID, 'accepted')).rejects.toThrow('Admins only');
    expect(state.calls).toEqual([]);
  });
});

describe('releaseWave', () => {
  it('releases what was staged up to the cutoff and returns the wave', async () => {
    state.rpc = () => ({ data: [{ wave_id: 3, released: 5 }], error: null });
    const { releaseWave } = await actions();

    const result = await releaseWave(true, CUTOFF);

    expect(result).toMatchObject({ ok: true, waveId: 3, released: 5 });
    expect(state.rpcCalls).toEqual([{ name: 'release_wave', args: { p_include_rejections: true, p_staged_before: CUTOFF } }]);
    expect(sendDecisionEmail).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalled();
  });

  it('explains an empty release', async () => {
    state.rpc = () => ({ data: null, error: { message: 'Nothing to release' } });
    const { releaseWave } = await actions();

    expect(await releaseWave(false, CUTOFF)).toEqual({ ok: false, message: 'Nothing is staged to release.' });
  });

  it('asks to wait while an earlier wave is still sending', async () => {
    state.rpc = () => ({ data: null, error: { message: 'Emails are still sending' } });
    const { releaseWave } = await actions();

    const result = await releaseWave(false, CUTOFF);

    expect(result.ok).toBe(false);
    expect(result.message).toContain('still sending');
  });

  it('needs a valid cutoff', async () => {
    const { releaseWave } = await actions();

    expect((await releaseWave(false, 'not a date')).ok).toBe(false);
    expect((await releaseWave(false, undefined as never)).ok).toBe(false);
    expect(state.rpcCalls).toEqual([]);
  });

  it('rejects a non-boolean', async () => {
    const { releaseWave } = await actions();

    expect((await releaseWave('yes' as never, CUTOFF)).ok).toBe(false);
    expect(state.rpcCalls).toEqual([]);
  });

  it('blocks people who are not admins', async () => {
    state.isAdmin = false;
    const { releaseWave } = await actions();

    await expect(releaseWave(false, CUTOFF)).rejects.toThrow('Admins only');
    expect(state.rpcCalls).toEqual([]);
  });
});

describe('sendWaveEmails', () => {
  const claimed = [
    { application_id: appId(1), decision: 'accepted', email: 'one@test.com', first_name: 'One' },
    { application_id: appId(2), decision: 'waitlisted', email: 'two@test.com', first_name: null },
  ];

  beforeEach(() => {
    state.rpc = () => ({ data: claimed, error: null });
    // An update hands back the row it saved, as .select() does.
    state.respond = (call) => (call.op === 'select' ? { data: null, error: null, count: 4 } : { data: [{ application_id: 'x' }], error: null });
  });

  it('sends each claimed email and records the result', async () => {
    sendDecisionEmail.mockResolvedValueOnce({ sent: true }).mockResolvedValueOnce({ sent: false, error: 'bounced' });
    const { sendWaveEmails } = await actions();

    const result = await sendWaveEmails(7);

    expect(state.rpcCalls).toEqual([{ name: 'claim_wave_emails', args: { p_wave_id: 7, p_limit: 25 } }]);
    expect(sendDecisionEmail.mock.calls).toEqual([
      [{ to: 'one@test.com', firstName: 'One', decision: 'accepted', idempotencyKey: `wave-7-${appId(1)}` }],
      [{ to: 'two@test.com', firstName: null, decision: 'waitlisted', idempotencyKey: `wave-7-${appId(2)}` }],
    ]);
    expect(result).toMatchObject({ ok: false, sent: 1, failed: 1, remaining: 4 });
    expect(result.message).toContain('bounced');
    const updates = writes('wave_emails');
    expect(updates[0]).toMatchObject({ values: { error: null, claimed_at: null }, filters: ['wave_id=7', `application_id=${appId(1)}`] });
    expect((updates[0].values as { sent_at: string }).sent_at).toBeTruthy();
    expect(updates[1]).toMatchObject({ values: { error: 'bounced', claimed_at: null }, filters: ['wave_id=7', `application_id=${appId(2)}`] });
    expect(state.calls.at(-1)).toMatchObject({ table: 'wave_emails', op: 'select', filters: ['wave_id=7', 'sent_at is null'] });
  });

  it('says when a result could not be saved because the email was no longer due', async () => {
    state.respond = (call) => (call.op === 'select' ? { data: null, error: null, count: 0 } : { data: [], error: null });
    const { sendWaveEmails } = await actions();

    const result = await sendWaveEmails(7);

    expect(result.message).toContain('no longer due');
  });

  it('spaces sends out for the rate limit', async () => {
    const times: number[] = [];
    sendDecisionEmail.mockImplementation(async () => {
      times.push(Date.now());
      return { sent: true };
    });
    const { sendWaveEmails } = await actions();

    await sendWaveEmails(7);

    expect(times[1] - times[0]).toBeGreaterThanOrEqual(500);
  });

  it('sends nothing when nothing is claimed', async () => {
    state.rpc = () => ({ data: [], error: null });
    state.respond = () => ({ data: null, error: null, count: 0 });
    const { sendWaveEmails } = await actions();

    expect(await sendWaveEmails(7)).toMatchObject({ ok: true, sent: 0, failed: 0, remaining: 0 });
    expect(sendDecisionEmail).not.toHaveBeenCalled();
  });

  it('rejects a bad wave id', async () => {
    const { sendWaveEmails } = await actions();

    expect((await sendWaveEmails(-1)).ok).toBe(false);
    expect((await sendWaveEmails('1' as never)).ok).toBe(false);
    expect(state.rpcCalls).toEqual([]);
  });

  it('blocks people who are not admins', async () => {
    state.isAdmin = false;
    const { sendWaveEmails } = await actions();

    await expect(sendWaveEmails(7)).rejects.toThrow('Admins only');
    expect(sendDecisionEmail).not.toHaveBeenCalled();
  });
});

describe('promoteFromWaitlist', () => {
  const score = (id: string, tier: string, experience: number) => ({
    application_id: id,
    status: 'scored',
    suggested_tier: tier,
    tier_override: null,
    experience,
    creativity: 3,
    quality: 3,
    flags: [],
  });

  beforeEach(() => {
    state.respond = (call) => {
      if (call.op !== 'select') return { data: null, error: null };
      if (call.filters.some((filter) => filter.includes('>'))) return { data: [], error: null }; // second page
      if (call.table === 'applications') {
        return {
          data: [1, 2, 3, 4].map((n) => ({ id: appId(n), submitted_at: `2026-11-0${n}T00:00:00Z`, hackathons_count: 0 })),
          error: null,
        };
      }
      if (call.table === 'staged_decisions') return { data: [{ application_id: appId(4), decision: 'rejected' }], error: null };
      if (call.table === 'hive_scores') return { data: [score(appId(1), 'larva', 1), score(appId(2), 'queen', 5), score(appId(3), 'worker', 3)], error: null };
      return { data: [], error: null };
    };
  });

  it('stages accepts for the top of the waitlist by Hive rank, skipping anyone staged', async () => {
    const { promoteFromWaitlist } = await actions();

    const result = await promoteFromWaitlist(2);

    expect(result.ok).toBe(true);
    expect(state.calls.find((call) => call.table === 'applications')?.filters).toEqual(['status=submitted', 'decision=waitlisted']);
    const [upsert] = writes('staged_decisions');
    expect((upsert.values as { application_id: string; decision: string }[]).map((row) => [row.application_id, row.decision])).toEqual([
      [appId(2), 'accepted'],
      [appId(3), 'accepted'],
    ]);
    expect(sendDecisionEmail).not.toHaveBeenCalled();
  });

  it("puts blind review's waitlist first, in its order, ahead of Hive rank", async () => {
    const respond = state.respond;
    state.respond = (call) =>
      call.table === 'review_outcomes' && !call.filters.some((filter) => filter.includes('>'))
        ? {
            data: [
              { application_id: appId(3), outcome: 'waitlisted', pool: null, waitlist_position: 2, decided_at: '2026-11-10T00:00:00Z' },
              { application_id: appId(1), outcome: 'waitlisted', pool: null, waitlist_position: 1, decided_at: '2026-11-11T00:00:00Z' },
            ],
            error: null,
          }
        : respond(call);
    const { promoteFromWaitlist } = await actions();

    await promoteFromWaitlist(3);

    const [upsert] = writes('staged_decisions');
    expect((upsert.values as { application_id: string }[]).map((row) => row.application_id)).toEqual([appId(1), appId(3), appId(2)]);
  });

  it("never overwrites someone another admin staged meanwhile, and says so", async () => {
    const respond = state.respond;
    // Only app 2 actually went in: app 3 was staged by someone else after the page loaded.
    state.respond = (call) => (call.op === 'upsert' ? { data: [{ application_id: appId(2) }], error: null } : respond(call));
    const { promoteFromWaitlist } = await actions();

    const result = await promoteFromWaitlist(2);

    const [upsert] = writes('staged_decisions');
    expect(upsert.options).toEqual({ onConflict: 'application_id', ignoreDuplicates: true });
    expect(result.message).toContain('Staged 1 accept from the waitlist');
    expect(result.message).toContain('1 person had just been staged by someone else');
  });

  it('leaves staged_at to the database clock', async () => {
    const { promoteFromWaitlist } = await actions();

    await promoteFromWaitlist(2);

    const [upsert] = writes('staged_decisions');
    expect((upsert.values as Record<string, unknown>[]).every((row) => !('staged_at' in row))).toBe(true);
  });

  it('says when fewer are left than asked for', async () => {
    const { promoteFromWaitlist } = await actions();

    const result = await promoteFromWaitlist(10);

    expect(result.message).toContain('only 3 left');
  });

  it('validates the count', async () => {
    const { promoteFromWaitlist } = await actions();

    for (const count of [0, 501, 1.5, NaN]) expect((await promoteFromWaitlist(count)).ok).toBe(false);
    expect(state.calls).toEqual([]);
  });

  it('blocks people who are not admins', async () => {
    state.isAdmin = false;
    const { promoteFromWaitlist } = await actions();

    await expect(promoteFromWaitlist(1)).rejects.toThrow('Admins only');
  });
});

describe('stageReviewOutcomes', () => {
  const outcome = (n: number, result: string, extra: Record<string, unknown> = {}) => ({
    application_id: appId(n),
    outcome: result,
    pool: result === 'accepted' ? 'general' : null,
    waitlist_position: null,
    decided_at: `2026-11-1${n}T00:00:00Z`,
    ...extra,
  });

  beforeEach(() => {
    state.respond = (call) => {
      if (call.op !== 'select') return { data: null, error: null };
      if (call.filters.some((filter) => filter.includes('>'))) return { data: [], error: null }; // second page
      if (call.table === 'review_outcomes') {
        return {
          data: [
            outcome(1, 'rejected'),
            outcome(2, 'waitlisted', { waitlist_position: 2 }),
            outcome(3, 'accepted'),
            outcome(4, 'accepted'), // already decided by hand
            outcome(5, 'accepted'), // already staged
            outcome(6, 'waitlisted', { waitlist_position: 1 }),
            outcome(7, 'accepted'), // withdrawn: not a submitted application
            outcome(8, 'accepted', { decided_at: '2026-11-01T00:00:00Z' }),
          ],
          error: null,
        };
      }
      if (call.table === 'applications') {
        return { data: [1, 2, 3, 4, 5, 6, 8].map((n) => ({ id: appId(n), decision: n === 4 ? 'accepted' : null })), error: null };
      }
      if (call.table === 'staged_decisions') return { data: [{ application_id: appId(5), decision: 'rejected' }], error: null };
      return { data: [], error: null };
    };
  });

  it('stages every undecided, unstaged outcome: accepts in review order, then the waitlist, then rejections', async () => {
    const { stageReviewOutcomes } = await actions();

    const result = await stageReviewOutcomes();

    expect(result.ok).toBe(true);
    expect(result.message).toContain('Staged 2 accepts, 2 waitlists, 1 rejection from blind review');
    const [upsert] = writes('staged_decisions');
    expect((upsert.values as { application_id: string; decision: string }[]).map((row) => [row.application_id, row.decision])).toEqual([
      [appId(8), 'accepted'],
      [appId(3), 'accepted'],
      [appId(6), 'waitlisted'],
      [appId(2), 'waitlisted'],
      [appId(1), 'rejected'],
    ]);
    // Never overwrites something staged by hand in the meantime.
    expect(upsert.options).toEqual({ onConflict: 'application_id', ignoreDuplicates: true });
    expect(sendDecisionEmail).not.toHaveBeenCalled();
    expect(state.rpcCalls).toEqual([]);
  });

  it('says when nothing is left to stage', async () => {
    state.respond = (call) => (call.table === 'review_outcomes' && !call.filters.length ? { data: [outcome(4, 'accepted')], error: null } : { data: [], error: null });
    const { stageReviewOutcomes } = await actions();

    const result = await stageReviewOutcomes();

    expect(result.ok).toBe(false);
    expect(writes('staged_decisions')).toEqual([]);
  });

  it('stages nothing if anything fails to load', async () => {
    const respond = state.respond;
    state.respond = (call) => (call.table === 'staged_decisions' ? { data: null, error: { message: 'boom' } } : respond(call));
    const { stageReviewOutcomes } = await actions();

    expect((await stageReviewOutcomes()).ok).toBe(false);
    expect(writes('staged_decisions')).toEqual([]);
  });

  it('blocks people who are not admins', async () => {
    state.isAdmin = false;
    const { stageReviewOutcomes } = await actions();

    await expect(stageReviewOutcomes()).rejects.toThrow('Admins only');
  });
});
