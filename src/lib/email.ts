import 'server-only';
import { Resend } from 'resend';

// Sends HackHive's own emails (item request updates) through Resend, the same way
// the CS Club website does. Supabase only sends its fixed sign-in emails, not these.
// Needs RESEND_API_KEY and RESEND_FROM_EMAIL in the environment; without a key,
// emails are skipped and logged so nothing else breaks.

function resolveFrom() {
  const raw = process.env.RESEND_FROM_EMAIL ?? 'HackHive <onboarding@resend.dev>';
  const address = raw.match(/<([^>]+)>/)?.[1]?.trim() || raw.trim();
  // Resend wants a normal display name; bare "domain <email>" is easy to misparse.
  return `HackHive <${address}>`;
}

const FONT = '-apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif';

// Names, notes and item names come from users, so escape them before putting them in HTML.
function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

// Email clients need inline styles, not a stylesheet. This is the one place the
// branded shell lives, so every HackHive email looks the same.
function emailShell(bodyHtml: string) {
  return `
<div style="background:#f4f4f5;padding:32px 16px;font-family:${FONT};">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:8px;border:1px solid #e5e5e5;overflow:hidden;">
    <div style="background:#1b003f;padding:18px 28px;">
      <span style="color:#fff29c;font-size:15px;font-weight:700;letter-spacing:0.03em;">HACKHIVE 2027</span>
    </div>
    <div style="padding:28px;color:#111111;font-size:15px;line-height:1.6;">
      ${bodyHtml}
    </div>
    <div style="padding:14px 28px;background:#fafafa;border-top:1px solid #e5e5e5;">
      <p style="margin:0;font-size:12px;color:#999999;">HackHive 2027 · OTU Computer Science Club</p>
    </div>
  </div>
</div>`;
}

type Item = { name: string; quantity: number };

// Where accepted requests are picked up. Shown in the "accepted" email.
// TODO: fill in before the event.
const PICKUP = {
  person: 'PERSON',
  location: 'LOCATION',
  slackContact: 'PERSON',
};

// One item per line, with the last two joined by "and":
//   2 × Arduino Uno
//   1 × Breadboard
//   1 × Toothbrush and 1 × Towel
function itemLines(items: Item[]) {
  const lines = items.map((item) => `${item.quantity} × ${item.name}`);
  if (lines.length < 2) return lines;
  return [...lines.slice(0, -2), `${lines.at(-2)} and ${lines.at(-1)}`];
}

function itemsHtml(items: Item[]) {
  return `<p style="margin:0 0 16px;padding-left:12px;border-left:3px solid #fff29c;">${itemLines(items)
    .map(escapeHtml)
    .join('<br>')}</p>`;
}

function itemsText(items: Item[]) {
  return itemLines(items).join('\n');
}

async function sendEmail(to: string, subject: string, html: string, text: string): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY not set — skipping email:', subject);
    return { sent: false, error: 'RESEND_API_KEY is not set.' };
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({ from: resolveFrom(), to, subject, html: emailShell(html), text });
    if (error) {
      console.error('Resend error:', error);
      return { sent: false, error: error.message || 'Resend rejected the email.' };
    }
    return { sent: true };
  } catch (error) {
    console.error('Failed to send email:', error);
    return { sent: false, error: error instanceof Error ? error.message : 'Failed to send email.' };
  }
}

// Sent when a hacker submits an item request.
export function sendItemRequestReceivedEmail(to: string, { items }: { items: Item[] }) {
  return sendEmail(
    to,
    'We got your HackHive item request',
    `<p style="margin:0 0 12px;">You requested:</p>
${itemsHtml(items)}
<p style="margin:0;">The executives have your request and will review it at their earliest convenience.</p>`,
    `You requested:\n\n${itemsText(items)}\n\nThe executives have your request and will review it at their earliest convenience.`,
  );
}

// Sent when an organizer accepts or rejects an item request.
export function sendItemRequestReviewedEmail(
  to: string,
  { items, decision, note }: { items: Item[]; decision: 'accepted' | 'rejected'; note?: string | null },
) {
  const accepted = decision === 'accepted';
  const pickup = `Please see ${PICKUP.person} at ${PICKUP.location}, or reach out to ${PICKUP.slackContact} on Slack.`;
  const next = accepted ? pickup : 'You can send another request from your dashboard any time.';
  return sendEmail(
    to,
    accepted ? 'Your HackHive item request was accepted' : 'Your HackHive item request was rejected',
    `<p style="margin:0 0 12px;">Your request for:</p>
${itemsHtml(items)}
<p style="margin:0 0 16px;">has been <strong style="color:${accepted ? '#15803d' : '#b91c1c'};">${decision}</strong>.</p>
${note ? `<p style="margin:0 0 16px;padding:12px 16px;background:#fafafa;border-left:3px solid #1b003f;"><strong>Note from the executives:</strong> ${escapeHtml(note)}</p>` : ''}
<p style="margin:0;">${escapeHtml(next)}</p>`,
    `Your request for:\n\n${itemsText(items)}\n\nhas been ${decision}.${note ? `\n\nNote from the executives: ${note}` : ''}\n\n${next}`,
  );
}
