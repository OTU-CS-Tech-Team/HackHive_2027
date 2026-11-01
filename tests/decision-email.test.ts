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

    expect(sent).toEqual({ sent: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers.Authorization).toBe('Bearer test-key');
    const body = JSON.parse(init.body);
    expect(body.to).toEqual(['sam@test.com']);
    expect(body.from).toBe('HackHive <hello@test.dev>');
    expect(body.text).toContain('https://hackhive.test/dashboard');
  });

  // Hosts keep quotes pasted from an env file, and Resend rejects them.
  it('strips quotes pasted around the sender', async () => {
    vi.stubEnv('RESEND_FROM_EMAIL', '"HackHive <hello@test.dev>"');
    fetchMock.mockResolvedValue(new Response('{"id":"1"}', { status: 200 }));
    const { sendDecisionEmail } = await import('../src/lib/application/decision-email');

    await sendDecisionEmail({ to: 'sam@test.com', firstName: 'Sam', decision: 'accepted', siteUrl: SITE });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).from).toBe('HackHive <hello@test.dev>');
  });

  it('passes on the reason Resend rejected the email', async () => {
    fetchMock.mockResolvedValue(new Response('{"message":"domain not verified"}', { status: 403 }));
    const { sendDecisionEmail } = await import('../src/lib/application/decision-email');

    const sent = await sendDecisionEmail({ to: 'sam@test.com', firstName: 'Sam', decision: 'accepted', siteUrl: SITE });

    expect(sent).toEqual({ sent: false, error: 'domain not verified' });
  });

  it('still reports a rejection when Resend sends no readable reason', async () => {
    fetchMock.mockResolvedValue(new Response('<html>bad gateway</html>', { status: 502 }));
    const { sendDecisionEmail } = await import('../src/lib/application/decision-email');

    const sent = await sendDecisionEmail({ to: 'sam@test.com', firstName: 'Sam', decision: 'accepted', siteUrl: SITE });

    expect(sent).toEqual({ sent: false, error: 'Resend returned status 502' });
  });

  it('passes on the reason when the request itself dies', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    const { sendDecisionEmail } = await import('../src/lib/application/decision-email');

    const sent = await sendDecisionEmail({ to: 'sam@test.com', firstName: 'Sam', decision: 'accepted', siteUrl: SITE });

    expect(sent).toEqual({ sent: false, error: 'network down' });
  });

  it.each(['RESEND_API_KEY', 'RESEND_FROM_EMAIL'])('names %s without calling Resend when it is missing', async (name) => {
    vi.stubEnv(name, '');
    const { sendDecisionEmail } = await import('../src/lib/application/decision-email');

    const sent = await sendDecisionEmail({ to: 'sam@test.com', firstName: 'Sam', decision: 'accepted', siteUrl: SITE });

    expect(sent).toEqual({ sent: false, error: `${name} is not set` });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
