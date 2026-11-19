import { PDFDocument, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { cleanResumeText, extractPdfText, headingOf, removeEducation } from '@/lib/review/resume-text';
import { makeScrubber } from '@/lib/review/scrub';

const filler = (label: string) =>
  `${label}: built a realtime dashboard in React and Go that handled thousands of events per second for a logistics client.`;

const RESUME = [
  'Jane Doe',
  'jane.doe42@gmail.com | 905-555-0100 | github.com/janedoe-dev',
  'EDUCATION',
  'Ontario Tech University, Oshawa',
  'Bachelor of Science, Computer Science',
  'Relevant coursework: Algorithms, Operating Systems',
  'Experience',
  'Software Developer Intern, Acme Corp (May 2025 - Aug 2025)',
  filler('Acme'),
  'Teaching assistant while maintaining a 3.9 GPA',
  'Projects',
  filler('HiveTracker'),
  filler('Pollen'),
  'Skills',
  'TypeScript, Go, PostgreSQL, Docker',
].join('\n');

const scrub = makeScrubber({ names: ['Jane', 'Doe'], email: 'jane.doe42@gmail.com', phone: '905-555-0100', school: 'Ontario Tech University', city: 'Oshawa' });

describe('headingOf', () => {
  it('recognises headings in any case, with punctuation', () => {
    expect(headingOf('EDUCATION')).toBe('education');
    expect(headingOf('  Work Experience:  ')).toBe('work experience');
    expect(headingOf('Education — ')).toBe('education');
    expect(headingOf('I have experience with React')).toBeNull();
  });
});

describe('removeEducation', () => {
  it('drops the Education section up to the next heading, and GPA/degree lines elsewhere', () => {
    const out = removeEducation(RESUME);
    expect(out).not.toMatch(/Ontario Tech|Bachelor|coursework|GPA|EDUCATION/);
    expect(out).toContain('Experience');
    expect(out).toContain('Software Developer Intern');
    expect(out).toContain('TypeScript, Go');
  });

  it('works when Education is the last section', () => {
    expect(removeEducation('Skills\nGo\nEducation\nSome College\nB.Sc. 2027')).toBe('Skills\nGo');
  });
});

describe('cleanResumeText', () => {
  it('removes education and identifying details', () => {
    const result = cleanResumeText(RESUME, scrub);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.text).not.toMatch(/Jane|Doe|gmail|555|janedoe|Ontario Tech|Oshawa|Bachelor|GPA/);
    expect(result.text).toContain('HiveTracker');
  });

  it('treats empty or nearly empty text as a failure', () => {
    expect(cleanResumeText('', scrub)).toMatchObject({ ok: false });
    expect(cleanResumeText('   \n  Jane Doe \n', scrub)).toMatchObject({ ok: false });
  });

  it('fails when almost everything left was identifying', () => {
    const onlyEducation = ['Education', ...Array.from({ length: 20 }, () => filler('School'))].join('\n');
    expect(cleanResumeText(onlyEducation, scrub)).toMatchObject({ ok: false });
  });
});

describe('extractPdfText', () => {
  it('reads the text of a PDF line by line', async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const page = pdf.addPage();
    ['Jane Doe', 'Experience', 'Built HiveTracker'].forEach((line, i) => page.drawText(line, { x: 50, y: 700 - i * 20, size: 12, font }));
    const text = await extractPdfText(await pdf.save());
    expect(text.split('\n').map((line) => line.trim())).toEqual(['Jane Doe', 'Experience', 'Built HiveTracker']);
  });

  it('throws on something that is not a PDF', async () => {
    await expect(extractPdfText(new TextEncoder().encode('not a pdf'))).rejects.toThrow();
  });
});
