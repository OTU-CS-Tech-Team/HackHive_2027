import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Resend } from 'resend';

// Sends HackHive's own emails (application and item request updates) through Resend, the same way
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
const HONEY = '#f5b83d';
const INK = '#14110b';
const CREAM = '#fff6e0';
const MUTED = '#9c8b6c';

const HTML_ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

// Names, notes and item names come from users, so escape them before putting them in HTML.
export function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (char) => HTML_ENTITIES[char]);
}

// Building blocks for email bodies. Email clients drop stylesheets, so every style is inline.
export const emailDivider = `<div style="height:3px;line-height:3px;font-size:0;margin:28px 0;background:${HONEY};background-image:linear-gradient(90deg,${HONEY},#b0aee3);border-radius:2px;">&nbsp;</div>`;

export const emailParagraph = (html: string) => `<p style="margin:0 0 14px;">${html}</p>`;

export const emailHeading = (html: string) =>
  `<h2 style="margin:0 0 12px;font-size:19px;line-height:1.3;font-weight:700;color:#ffffff;">${html}</h2>`;

export const emailHighlight = (html: string) => `<strong style="color:${HONEY};">${html}</strong>`;

export function emailButton(href: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px auto;border-collapse:separate;">
  <tr><td style="background:${HONEY};border-radius:8px;"><a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:700;color:${INK};text-decoration:none;">${label}</a></td></tr>
</table>`;
}

// The logos travel inside each email as inline attachments, which the shell shows with
// cid: links, so they appear without the site being deployed. next.config.ts bundles
// public/email/ into the server build so readFile finds them.
const LOGOS = [
  { filename: 'hackhive.png', contentId: 'hackhive-logo' },
  { filename: 'cs-club.png', contentId: 'cs-club-logo' },
];

let logos: Promise<{ filename: string; contentId: string; content: Buffer }[]> | null = null;

// A missing logo should never stop an email going out, so on failure send without them (alt text shows).
export function emailLogos() {
  logos ??= Promise.all(
    LOGOS.map(async (logo) => ({ ...logo, content: await readFile(path.join(process.cwd(), 'public/email', logo.filename)) })),
  ).catch((error) => {
    console.error('Email logos could not be read, sending without them:', error);
    return [];
  });
  return logos;
}

// The one place the branded shell lives, so every HackHive email looks the same.
export function emailShell(bodyHtml: string) {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '') ?? '';
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${INK}" style="background:${INK};font-family:${FONT};">
  <tr><td style="padding:32px 12px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;margin:0 auto;">
      <tr><td bgcolor="${CREAM}" style="padding:28px 24px 24px;background:${CREAM};border-radius:12px;text-align:center;">
        <img src="cid:hackhive-logo" width="56" height="64" alt="HackHive" style="display:inline-block;vertical-align:middle;margin:0 10px;border:0;">
        <img src="cid:cs-club-logo" width="80" height="64" alt="OTU Computer Science Club" style="display:inline-block;vertical-align:middle;margin:0 10px;border:0;">
        <p style="margin:16px 0 0;font-size:26px;line-height:1.2;font-weight:800;color:${INK};">HackHive 2027</p>
        <p style="margin:6px 0 0;font-size:13px;font-weight:600;color:#7a6040;">Hosted by the OTU Computer Science Club</p>
      </td></tr>
      <tr><td style="padding:32px 28px 0;color:${CREAM};font-size:15px;line-height:1.65;">
        ${bodyHtml}
        ${emailDivider}
        <p style="margin:0;font-size:12px;line-height:1.6;color:${MUTED};">HackHive 2027 · OTU Computer Science Club${
          site ? `<br><a href="${site}" style="color:${MUTED};">${site.replace(/^https?:\/\//, '')}</a>` : ''
        }</p>
      </td></tr>
    </table>
  </td></tr>
</table>`;
}

type Item = { name: string; quantity: number };

// Where accepted requests are picked up. Shown in the "accepted" email.
// TODO: fill in before the event.
const PICKUP = {
  person: 'PERSON',
  location: 'LOCATION',
  slackContact: 'PERSON',
};

// One item per line:
//   2 × Arduino Uno
//   1 × Breadboard
//   1 × Toothbrush
function itemLines(items: Item[]) {
  return items.map((item) => `${item.quantity} × ${item.name}`);
}

function itemsHtml(items: Item[]) {
  return `<p style="margin:0 0 14px;padding-left:12px;border-left:3px solid ${HONEY};color:#ffffff;">${itemLines(items)
    .map(escapeHtml)
    .join('<br>')}</p>`;
}

function itemsText(items: Item[]) {
  return itemLines(items).join('\n');
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string,
  attachments?: { filename: string; content: Uint8Array }[],
): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY not set — skipping email:', subject);
    return { sent: false, error: 'RESEND_API_KEY is not set.' };
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: resolveFrom(),
      to,
      subject,
      html: emailShell(html),
      text,
      attachments: [...(await emailLogos()), ...(attachments ?? [])],
    });
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

// Sent when a hacker submits their application, with the indemnification form they signed attached.
export function sendApplicationReceivedEmail(to: string, { firstName, pdf }: { firstName: string; pdf: Uint8Array }) {
  const body = "Thanks for applying to HackHive 2027! Your application is in, and we'll email you once a decision has been made.";
  const attached = 'A copy of the indemnification form you signed is attached for your records.';
  return sendEmail(
    to,
    'We got your HackHive application',
    `${emailParagraph(`<strong style="color:#ffffff;">Hi ${escapeHtml(firstName)}! 👋</strong>`)}
${emailParagraph(`Thanks for applying to HackHive 2027! ${emailHighlight('Your application is in')}, and we'll email you once a decision has been made.`)}
${emailDivider}
${emailHeading('Your indemnification form 📎')}
${emailParagraph(attached)}`,
    `Hi ${firstName},\n\n${body}\n\n${attached}`,
    [{ filename: 'HackHive-2027-Indemnification-Form.pdf', content: pdf }],
  );
}

// Sent when a hacker submits an item request.
export function sendItemRequestReceivedEmail(to: string, { items }: { items: Item[] }) {
  return sendEmail(
    to,
    'We got your HackHive item request',
    `${emailParagraph('You requested:')}
${itemsHtml(items)}
${emailParagraph('The executives have your request and will review it at their earliest convenience.')}`,
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
    `${emailParagraph('Your request for:')}
${itemsHtml(items)}
${emailParagraph(`has been <strong style="color:${accepted ? '#4ade80' : '#f87171'};">${decision}</strong>.`)}
${note ? `<p style="margin:0 0 14px;padding:12px 16px;background:#2a1e12;border-left:3px solid ${HONEY};"><strong style="color:#ffffff;">Note from the executives:</strong> ${escapeHtml(note)}</p>` : ''}
${emailParagraph(escapeHtml(next))}`,
    `Your request for:\n\n${itemsText(items)}\n\nhas been ${decision}.${note ? `\n\nNote from the executives: ${note}` : ''}\n\n${next}`,
  );
}
