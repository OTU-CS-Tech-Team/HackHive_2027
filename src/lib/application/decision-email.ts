import 'server-only';
import type { Application } from '@/lib/application/schema';

export type Decision = NonNullable<Application['decision']>;

const HTML_ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ENTITIES[char]);
}

const CONTENT: Record<Decision, { subject: string; paragraphs: string[] }> = {
  accepted: {
    subject: "You're in! Welcome to HackHive 2027",
    paragraphs: [
      "Congratulations, you've been accepted to HackHive 2027!",
      'Your hacker dashboard is now unlocked, with the schedule, your check-in pass, teammates, hardware and points.',
    ],
  },
  waitlisted: {
    subject: "You're on the HackHive 2027 waitlist",
    paragraphs: [
      "Thanks for applying to HackHive 2027. You're on our waitlist for now.",
      "We'll email you if a spot opens up.",
    ],
  },
  rejected: {
    subject: 'Your HackHive 2027 application',
    paragraphs: [
      "Thanks for applying to HackHive 2027. Unfortunately, we couldn't offer you a spot this year.",
      'We hope to see you next time.',
    ],
  },
};

export function decisionEmail(decision: Decision, firstName: string | null, siteUrl: string) {
  const { subject, paragraphs } = CONTENT[decision];
  const greeting = `Hi ${firstName?.trim() || 'there'},`;
  const dashboardUrl = decision === 'accepted' ? `${siteUrl}/dashboard` : null;

  const text = [
    greeting,
    ...paragraphs,
    ...(dashboardUrl ? [`Click this link to access your dashboard: ${dashboardUrl}`] : []),
    'The HackHive team',
  ].join('\n\n');

  const html = [
    ...[greeting, ...paragraphs].map((line) => `<p>${escapeHtml(line)}</p>`),
    ...(dashboardUrl
      ? [`<p><a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;padding:12px 20px;border-radius:6px;background:#171717;color:#ffffff;text-decoration:none;font-weight:600">Go to your dashboard</a></p>`]
      : []),
    '<p>The HackHive team</p>',
  ].join('');

  return { subject, text, html };
}

export async function sendDecisionEmail({ to, firstName, decision }: {
  to: string;
  firstName: string | null;
  decision: Decision;
}): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  // Hosts keep quotes pasted from an env file, and Resend rejects them.
  const from = process.env.RESEND_FROM_EMAIL?.trim().replace(/^["']|["']$/g, '');
  // Fixed rather than read from the request, so a spoofed Host can't change the link.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '');
  if (!apiKey || !from || !siteUrl) {
    const missing = !apiKey ? 'RESEND_API_KEY' : !from ? 'RESEND_FROM_EMAIL' : 'NEXT_PUBLIC_SITE_URL';
    console.error(`${missing} is not set`);
    return { sent: false, error: `${missing} is not set` };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], ...decisionEmail(decision, firstName, siteUrl) }),
      signal: AbortSignal.timeout(10_000),
    });
    if (response.ok) return { sent: true };
    const body = await response.text();
    console.error('Decision email rejected:', response.status, body);
    return { sent: false, error: resendMessage(body) ?? `Resend returned status ${response.status}` };
  } catch (error) {
    console.error('Decision email failed:', error);
    return { sent: false, error: error instanceof Error ? error.message : 'The request failed' };
  }
}

function resendMessage(body: string): string | null {
  try {
    return JSON.parse(body).message ?? null;
  } catch {
    return null;
  }
}
