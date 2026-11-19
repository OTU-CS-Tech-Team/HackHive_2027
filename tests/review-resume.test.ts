import { PDFDocument, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { cleanResumeText, extractPdfText, extractSections, headingOf } from '@/lib/review/resume-text';

const RESUME = [
  'Jane Doe',
  'jane.doe42@gmail.com | 905-555-0100 | github.com/janedoe-dev',
  'EDUCATION',
  'Ontario Tech University, Oshawa',
  'Bachelor of Science, Computer Science',
  'Experience',
  'Software Developer Intern, Acme Corp (May 2025 - Aug 2025)',
  'Built a realtime dashboard in React and Go for a logistics client.',
  'Research Assistant, University of Toronto',
  'Projects',
  'HiveTracker: beehive monitoring app https://github.com/janedoe/hivetracker',
  'Skills',
  'TypeScript, Go, PostgreSQL, Docker',
].join('\n');

describe('headingOf', () => {
  it('recognises headings in any case, with punctuation', () => {
    expect(headingOf('PROJECTS')).toBe('projects');
    expect(headingOf('  Work Experience:  ')).toBe('experience');
    expect(headingOf('Education — ')).toBe('other');
    expect(headingOf('I have experience with React')).toBeNull();
  });
});

describe('extractSections', () => {
  it('keeps only Experience and Projects, without the header, Education or Skills', () => {
    const { experience, projects } = extractSections(RESUME);
    expect(experience).toContain('Software Developer Intern');
    expect(experience).toContain('University of Toronto'); // schools inside experience are fine
    expect(projects).toContain('HiveTracker: beehive monitoring app');
    const all = experience + projects;
    expect(all).not.toMatch(/Jane Doe|gmail|555|Ontario Tech|Bachelor|TypeScript|github|\[removed\]/);
  });

  it('works when a section is missing', () => {
    expect(extractSections('Projects\nPollen, a bee game\nSkills\nGo')).toEqual({ experience: '', projects: 'Pollen, a bee game' });
  });
});

describe('cleanResumeText', () => {
  it('returns both sections', () => {
    expect(cleanResumeText(RESUME)).toMatchObject({ ok: true, projects: expect.stringContaining('HiveTracker') });
  });

  it('fails when neither section can be found', () => {
    expect(cleanResumeText('')).toMatchObject({ ok: false });
    expect(cleanResumeText('Jane Doe\nEducation\nSome College\nSkills\nGo')).toMatchObject({ ok: false });
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
