import 'server-only';
import type { Application } from '@/lib/application/schema';
import { emailButton, emailDivider, emailHeading, emailHighlight, emailLogos, emailParagraph, emailShell, escapeHtml } from '@/lib/email';

export type Decision = NonNullable<Application['decision']>;

// `mark` emphasises a phrase: honey bold in HTML, plain in the text version.
// The copy is fixed (no user input), so it goes into the HTML as is.
type Mark = (text: string) => string;

const CONTENT: Record<Decision, { subject: string; paragraphs: (mark: Mark) => string[] }> = {
  accepted: {
    subject: "You're in! Welcome to HackHive 2027 🎉",
    paragraphs: (mark) => [
      'The results are in. 👀',
      `After reviewing this year's applications, we're excited to share that ${mark("you've been accepted to HackHive 2027")}. Congratulations! 🥳`,
    ],
  },
  waitlisted: {
    subject: "You're on the HackHive 2027 waitlist",
    paragraphs: (mark) => [
      `Thanks for applying to HackHive 2027. ${mark("You're on our waitlist for now.")}`,
      "We'll email you if a spot opens up.",
    ],
  },
  rejected: {
    subject: 'Your HackHive 2027 application',
    paragraphs: (mark) => [
      `Thanks for applying to HackHive 2027. Unfortunately, ${mark("we couldn't offer you a spot this year")}.`,
      'We hope to see you next time.',
    ],
  },
};

const DASHBOARD_HEADING = 'Your dashboard is unlocked 🔓';
const DASHBOARD_BODY = 'Your hacker dashboard now has the schedule, your check-in pass, teammates, hardware and points.';

// Returns the body only; sendDecisionEmail wraps it in the branded shell.
export function decisionEmail(decision: Decision, firstName: string | null, siteUrl: string) {
  const { subject, paragraphs } = CONTENT[decision];
  const name = firstName?.trim() || 'there';
  const dashboardUrl = decision === 'accepted' ? `${siteUrl}/dashboard` : null;

  const text = [
    `Hi ${name},`,
    ...paragraphs((t) => t),
    ...(dashboardUrl ? [DASHBOARD_BODY, `Click this link to access your dashboard: ${dashboardUrl}`] : []),
    'The HackHive team',
  ].join('\n\n');

  const html = [
    emailParagraph(`<strong style="color:#ffffff;">Hi ${escapeHtml(name)}! 👋</strong>`),
    ...paragraphs(emailHighlight).map(emailParagraph),
    ...(dashboardUrl
      ? [emailDivider, emailHeading(DASHBOARD_HEADING), emailParagraph(DASHBOARD_BODY), emailButton(dashboardUrl, 'Go to your dashboard')]
      : []),
    emailParagraph('The HackHive team'),
  ].join('\n');

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

  const { subject, text, html } = decisionEmail(decision, firstName, siteUrl);
  // The REST API takes attachment bytes as base64 and the inline id as content_id.
  const attachments = (await emailLogos()).map((logo) => ({
    filename: logo.filename,
    content: logo.content.toString('base64'),
    content_id: logo.contentId,
  }));
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, text, html: emailShell(html), attachments }),
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
