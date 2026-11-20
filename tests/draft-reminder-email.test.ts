import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const APPLY = 'https://hackhive.test/apply';

describe('draftReminderEmail', () => {
  it('greets the hacker and links back to their application', async () => {
    const { draftReminderEmail } = await import('../src/lib/email');

    const email = draftReminderEmail('Sam', APPLY);

    expect(email.text).toContain('Hi Sam,');
    expect(email.text).toContain("We noticed you haven't submitted your HackHive 2027 application yet.");
    expect(email.text).toContain(`Finish your application: ${APPLY}`);
    expect(email.html).toContain(`href="${APPLY}"`);
    expect(email.text).toContain('The HackHive team');
  });

  it('keeps tags and escaped characters out of the plain-text version', async () => {
    const { draftReminderEmail } = await import('../src/lib/email');

    const { text } = draftReminderEmail('Sam', APPLY);

    expect(text).not.toMatch(/<[^>]+>|&#39;|&amp;/);
  });

  it('mentions the deadline only when there is one', async () => {
    const { draftReminderEmail } = await import('../src/lib/email');

    expect(draftReminderEmail('Sam', APPLY, '2027-01-31T04:59:00Z').text).toContain('Applications close');
    expect(draftReminderEmail('Sam', APPLY, null).text).not.toContain('Applications close');
  });

  it('escapes the name in the HTML version', async () => {
    const { draftReminderEmail } = await import('../src/lib/email');

    const { html } = draftReminderEmail('<img src=x onerror=alert(1)>', APPLY);

    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img');
  });

  it('still greets someone with no first name', async () => {
    const { draftReminderEmail } = await import('../src/lib/email');

    const email = draftReminderEmail(null, APPLY);

    expect(email.text).toContain('Hi there,');
    expect(email.text).not.toMatch(/null|undefined/);
  });
});

describe('firstNameOf', () => {
  it('takes the first word of a full name', async () => {
    const { firstNameOf } = await import('../src/lib/email');

    expect(firstNameOf('  Ada  Lovelace ')).toBe('Ada');
    expect(firstNameOf('')).toBeNull();
    expect(firstNameOf(null)).toBeNull();
  });
});

describe('reminder cooldown', () => {
  it('opens the next reminder one cooldown after the last one started', async () => {
    const { nextReminderAt, REMINDER_COOLDOWN_MS } = await import('../src/lib/admin/draft-reminders');

    expect(nextReminderAt('2026-11-19T15:00:00Z')).toBe(Date.parse('2026-11-19T15:00:00Z') + REMINDER_COOLDOWN_MS);
    expect(nextReminderAt(null)).toBeNull();
    expect(nextReminderAt(undefined)).toBeNull();
  });
});
