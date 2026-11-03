import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.7' }) }));
vi.mock('@/lib/auth/helpers', () => ({ getVerifiedUser: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(), createServiceClient: vi.fn() }));
vi.mock('@/lib/indemnification', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/indemnification')>();
  return { previewFilledForm: vi.fn(actual.previewFilledForm) };
});

import { getVerifiedUser } from '@/lib/auth/helpers';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { previewFilledForm } from '@/lib/indemnification';
import { previewIndemnification, submitApplication } from '@/app/actions/applications';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const SUBMISSION_ID = '22222222-2222-4222-8222-222222222222';

process.env.RATE_LIMIT_HASH_SECRET = 'test-secret';
process.env.TURNSTILE_SECRET_KEY = '1x0000000000000000000000000000000AA';

function query(result: unknown) {
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'eq']) q[m] = vi.fn(() => q);
  q.maybeSingle = vi.fn(async () => result);
  q.single = vi.fn(async () => result);
  return q;
}

function setup({ submittedRow = null as object | null, uploadError = null as object | null } = {}) {
  const calls: string[] = [];
  const upload = vi.fn(async () => { calls.push('upload'); return { error: uploadError }; });
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    if (name === 'reg_check_rate_limit') return { data: true, error: null };
    calls.push('submit');
    return { data: { ok: true, application_id: 'app-1', submitted_at: args.p_stamped_at }, error: null };
  });
  const service = {
    from: vi.fn(() => query({ data: submittedRow, error: null })),
    rpc,
    storage: { from: vi.fn(() => ({ upload })) },
  };
  const session = {
    from: vi.fn(() => query({ data: { applications_open: true, deadline: null }, error: null })),
    storage: {
      from: vi.fn(() => ({
        list: vi.fn(async () => ({
          data: [{ name: 'resume-1.pdf', metadata: { mimetype: 'application/pdf', size: 1000 } }],
          error: null,
        })),
      })),
    },
  };
  vi.mocked(getVerifiedUser).mockResolvedValue({ id: USER_ID, email: 'Ada@Example.com' } as Awaited<ReturnType<typeof getVerifiedUser>>);
  vi.mocked(createServiceClient).mockReturnValue(service as unknown as ReturnType<typeof createServiceClient>);
  vi.mocked(createClient).mockResolvedValue(session as unknown as Awaited<ReturnType<typeof createClient>>);
  return { calls, upload, rpc, service };
}

const fields = {
  first_name: 'Ada',
  last_name: 'Lovelace',
  phone: '4165550100',
  age: 21,
  city: 'Toronto',
  country: 'Canada',
  university: 'University of Toronto',
  program: 'CS',
  year_of_study: '3',
  grad_date: '2028-05-01',
  linkedin_url: 'https://linkedin.com/in/ada',
  github_url: null,
  portfolio_url: null,
  resume_path: `${USER_ID}/resume-1.pdf`,
  q_proud: 'Built an engine',
  q_hack: 'Hacked a loom',
  team_status: 'solo',
  tshirt_size: 'M',
  consent_coc: true,
  consent_privacy: true,
  consent_indemnification: true,
};

const submit = () => submitApplication({
  fields,
  turnstileToken: 'token',
  startedAt: Date.now() - 60_000,
  submissionId: SUBMISSION_ID,
});

async function guestLine(bytes: Uint8Array): Promise<string> {
  const task = getDocument({ data: bytes.slice() });
  const page = await (await task.promise).getPage(5);
  const items = (await page.getTextContent()).items.flatMap((i) => ('str' in i && i.str.trim() ? [i] : []));
  const label = items.find((i) => i.str.startsWith('External Guest Name'))!;
  const line = items
    .filter((i) => Math.abs(i.transform[5] - label.transform[5]) < 4 && i.transform[4] > label.transform[4] + 10)
    .sort((a, b) => a.transform[4] - b.transform[4])
    .map((i) => i.str.trim())
    .join(' ');
  await task.destroy();
  return line;
}

beforeEach(() => vi.clearAllMocks());

describe('submitApplication with the indemnification form', () => {
  it('uploads the filled form before the submit RPC and records its path', async () => {
    const { calls, upload, rpc } = setup();

    const result = await submit();

    expect(result).toMatchObject({ ok: true, applicationId: 'app-1' });
    expect(calls).toEqual(['upload', 'submit']);
    const [path, bytes, options] = upload.mock.calls[0] as unknown as [string, Uint8Array, object];
    expect(path).toBe(`${USER_ID}/${SUBMISSION_ID}.pdf`);
    expect(options).toMatchObject({ contentType: 'application/pdf' });

    const args = rpc.mock.calls.find(([name]) => name === 'reg_submit_application')![1];
    expect(args).toMatchObject({
      p_consent_indemnification: true,
      p_indemnification_path: path,
      p_email: 'ada@example.com',
      p_user_id: USER_ID,
    });
    const torontoDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' }).format(new Date(args.p_stamped_at as string));
    expect(await guestLine(bytes)).toBe(`Ada Lovelace Date: ${torontoDate}`);
    expect(result.ok && result.submittedAt).toBe(args.p_stamped_at);
  });

  it('returns the original success without rendering or uploading when the path is already set', async () => {
    const { upload, rpc } = setup({
      submittedRow: {
        id: 'app-1',
        submitted_at: '2027-01-02T03:04:05Z',
        indemnification_path: `${USER_ID}/${SUBMISSION_ID}.pdf`,
      },
    });

    const result = await submit();

    expect(result).toEqual({ ok: true, applicationId: 'app-1', submittedAt: '2027-01-02T03:04:05Z' });
    expect(previewFilledForm).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('does not submit when the form cannot be stored', async () => {
    const { calls } = setup({ uploadError: { message: 'storage down' } });

    expect(await submit()).toMatchObject({ ok: false, code: 'server' });
    expect(calls).toEqual(['upload']);
  });

  it('rejects a submit without the indemnification consent before rendering', async () => {
    const { upload } = setup();

    const result = await submitApplication({
      fields: { ...fields, consent_indemnification: false },
      turnstileToken: 'token',
      startedAt: Date.now() - 60_000,
      submissionId: SUBMISSION_ID,
    });

    expect(result).toMatchObject({ ok: false, code: 'validation' });
    expect(result.ok === false && result.fieldErrors?.consent_indemnification).toBeTruthy();
    expect(upload).not.toHaveBeenCalled();
  });
});

describe('previewIndemnification', () => {
  it('returns the filled PDF without exposing the guest role', async () => {
    setup();

    const result = await previewIndemnification({
      first_name: 'Ada',
      last_name: 'Lovelace',
      university: 'Ontario Tech',
      linkedin_url: '',
      github_url: '',
      portfolio_url: '',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result)).toEqual(['ok', 'pdfBase64']);
    expect(await guestLine(new Uint8Array(Buffer.from(result.pdfBase64, 'base64')))).toBe('Date:');
  });
});
