import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const SITE = 'https://hackhive.test';

describe('decisionEmail', () => {
  it('gives accepted hackers a link to their dashboard', async () => {
    const { decisionEmail } = await import('../src/lib/application/decision-email');

    const email = decisionEmail('accepted', 'Sam', SITE);

    expect(email.text).toContain('https://hackhive.test/dashboard');
    expect(email.html).toContain('href="https://hackhive.test/dashboard"');
  });

  it.each(['waitlisted', 'rejected'] as const)('does not offer %s applicants the dashboard', async (decision) => {
    const { decisionEmail } = await import('../src/lib/application/decision-email');

    const email = decisionEmail(decision, 'Sam', SITE);

    expect(email.text).not.toContain('/dashboard');
    expect(email.html).not.toContain('/dashboard');
  });

  it('gives each decision its own subject', async () => {
    const { decisionEmail } = await import('../src/lib/application/decision-email');

    const subjects = (['accepted', 'waitlisted', 'rejected'] as const).map((d) => decisionEmail(d, 'Sam', SITE).subject);

    expect(new Set(subjects).size).toBe(3);
  });

  it('escapes the name in the HTML version', async () => {
    const { decisionEmail } = await import('../src/lib/application/decision-email');

    const email = decisionEmail('rejected', '<img src=x onerror=alert(1)>', SITE);

    expect(email.html).not.toContain('<img');
    expect(email.html).toContain('&lt;img');
  });

  it('still greets someone with no first name', async () => {
    const { decisionEmail } = await import('../src/lib/application/decision-email');

    const email = decisionEmail('accepted', null, SITE);

    expect(email.text).not.toMatch(/null|undefined/);
    expect(email.html).not.toMatch(/null|undefined/);
  });
});

describe('sendDecisionEmail', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    vi.stubEnv('RESEND_FROM_EMAIL', 'HackHive <hello@test.dev>');
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('sends to the applicant from the configured sender', async () => {
    fetchMock.mockResolvedValue(new Response('{"id":"1"}', { status: 200 }));
    const { sendDecisionEmail } = await import('../src/lib/application/decision-email');

    const sent = await sendDecisionEmail({ to: 'sam@test.com', firstName: 'Sam', decision: 'accepted', siteUrl: SITE });

    expect(sent).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers.Authorization).toBe('Bearer test-key');
    const body = JSON.parse(init.body);
    expect(body.to).toEqual(['sam@test.com']);
    expect(body.from).toBe('HackHive <hello@test.dev>');
    expect(body.text).toContain('https://hackhive.test/dashboard');
  });

  it('reports failure when Resend rejects the email', async () => {
    fetchMock.mockResolvedValue(new Response('{"message":"domain not verified"}', { status: 403 }));
    const { sendDecisionEmail } = await import('../src/lib/application/decision-email');

    const sent = await sendDecisionEmail({ to: 'sam@test.com', firstName: 'Sam', decision: 'accepted', siteUrl: SITE });

    expect(sent).toBe(false);
  });

  it('reports failure when the request itself dies', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    const { sendDecisionEmail } = await import('../src/lib/application/decision-email');

    const sent = await sendDecisionEmail({ to: 'sam@test.com', firstName: 'Sam', decision: 'accepted', siteUrl: SITE });

    expect(sent).toBe(false);
  });

  it('reports failure without calling Resend when the key is missing', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    const { sendDecisionEmail } = await import('../src/lib/application/decision-email');

    const sent = await sendDecisionEmail({ to: 'sam@test.com', firstName: 'Sam', decision: 'accepted', siteUrl: SITE });

    expect(sent).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
