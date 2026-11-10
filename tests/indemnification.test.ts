import { describe, expect, it, vi } from 'vitest';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

vi.mock('server-only', () => ({}));
import { previewFilledForm, type IndemnificationApplicant } from '@/lib/indemnification';

type Item = { str: string; x: number; y: number };

async function pageItems(bytes: Uint8Array): Promise<Item[][]> {
  const task = getDocument({ data: bytes.slice() });
  const pdf = await task.promise;
  const pages: Item[][] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const content = await (await pdf.getPage(n)).getTextContent();
    pages.push(content.items.flatMap((item) =>
      'str' in item && item.str.trim() ? [{ str: item.str, x: item.transform[4], y: item.transform[5] }] : []));
  }
  await task.destroy();
  return pages;
}

function lineAfter(items: Item[], label: string): string[] {
  const anchor = items.find((i) => i.str.startsWith(label));
  if (!anchor) throw new Error(`label ${label} not found`);
  return items
    .filter((i) => Math.abs(i.y - anchor.y) < 4 && i.x > anchor.x + 10)
    .sort((a, b) => a.x - b.x)
    .map((i) => i.str.trim());
}

const applicant = (university: string): IndemnificationApplicant => ({
  firstName: '  Ada ',
  lastName: ' Lovelace ',
  university,
  linkedinUrl: 'https://linkedin.com/in/ada',
  githubUrl: '',
  portfolioUrl: 'https://ada.dev',
});

const at = new Date('2027-01-02T03:30:00Z');

describe('indemnification form filler', () => {
  it('signs the external guest block for a non Ontario Tech university', async () => {
    const pages = await pageItems(await previewFilledForm(applicant('University of Toronto'), at));
    const signatures = pages[4];

    expect(lineAfter(signatures, 'External Guest Name')).toEqual(['Ada Lovelace', 'Date:', '2027-01-01']);
    expect(lineAfter(signatures, 'External Guest Signature')).toEqual(['Ada Lovelace']);
    expect(lineAfter(signatures, 'Club President Signature')).toEqual([]);
  });

  it.each(['Ontario Tech University', ' ontario  tech. ', 'OTU', 'U.O.I.T.', 'OntarioTechU', 'University of Ontario Institute of Technology'])(
    'leaves the guest block blank for Ontario Tech alias %j',
    async (university) => {
      const pages = await pageItems(await previewFilledForm(applicant(university), at));
      expect(lineAfter(pages[4], 'External Guest Name')).toEqual(['Date:']);
      expect(lineAfter(pages[4], 'External Guest Signature')).toEqual([]);
      expect(pages[4].map((i) => i.str).join(' ')).not.toContain('Ada Lovelace');
    },
  );

  it('treats a blank university as an external guest', async () => {
    const pages = await pageItems(await previewFilledForm(applicant('   '), at));
    expect(lineAfter(pages[4], 'External Guest Signature')).toEqual(['Ada Lovelace']);
  });

  it('fills the applicant blanks and keeps the club and president text', async () => {
    const pages = await pageItems(await previewFilledForm(applicant('University of Toronto'), at));
    const guestInfo = pages[1];

    expect(lineAfter(guestInfo, 'Full Legal Name')).toEqual(['Ada Lovelace']);
    expect(lineAfter(guestInfo, 'Background/Credentials')).toEqual(['University of Toronto']);
    const profileLabel = guestInfo.find((i) => i.str.startsWith('Profile Link(s)'))!;
    expect(guestInfo
      .filter((i) => i.x > profileLabel.x + 10 && i.y < profileLabel.y + 4 && i.y > profileLabel.y - 40)
      .sort((a, b) => b.y - a.y)
      .map((i) => i.str)).toEqual(['https://linkedin.com/in/ada', 'https://ada.dev']);
    expect(lineAfter(guestInfo, 'Nickname(s)')).toEqual([]);

    const all = pages.flat().map((i) => i.str).join('\n');
    expect(all).toContain('OTU Computer Science');
    expect(all).toContain('Hackhive 2027');
    expect(all).toContain('2026-10-18');
    expect(all.match(/Abdul Muqit Afzal/g)).toHaveLength(3);
  });
});
