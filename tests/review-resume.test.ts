import { PDFDocument, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { cleanResumeText, extractPdfPages, extractPdfText, extractSections, headingOf, pageLines, splitEntries } from '@/lib/review/resume-text';

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
    const flat = (entries: string[][]) => entries.flat().join(' ');
    expect(flat(experience)).toContain('Software Developer Intern');
    expect(flat(experience)).toContain('University of Toronto'); // schools inside experience are fine
    expect(flat(projects)).toContain('HiveTracker: beehive monitoring app');
    const all = flat(experience) + flat(projects);
    expect(all).not.toMatch(/Jane Doe|gmail|555|Ontario Tech|Bachelor|TypeScript|github|\[removed\]/);
  });

  it('works when a section is missing', () => {
    expect(extractSections('Projects\nPollen, a bee game\nSkills\nGo')).toEqual({ experience: [], projects: [['Pollen, a bee game']] });
  });
});

describe('splitEntries', () => {
  it('starts a new entry at each title after bullets, and drops bullet markers', () => {
    expect(
      splitEntries([
        'Software Developer Intern, Acme Corp',
        'May 2025 - Aug 2025',
        '• Built a realtime dashboard in React and Go for a',
        'logistics client.',
        '• Cut page load time by 40%.',
        'Research Assistant, University of Toronto',
        'Sep 2024 - Apr 2025',
        '- Trained models on bee audio.',
      ]),
    ).toEqual([
      ['Software Developer Intern, Acme Corp', 'May 2025 - Aug 2025', 'Built a realtime dashboard in React and Go for a', 'logistics client.', 'Cut page load time by 40%.'],
      ['Research Assistant, University of Toronto', 'Sep 2024 - Apr 2025', 'Trained models on bee audio.'],
    ]);
  });

  it('splits on dates when there are no bullets, keeping each title with its date', () => {
    expect(splitEntries(['HiveTracker', '2025 - Present', 'Beehive monitoring app.', 'Pollen', 'Summer 2024', 'A bee game.'])).toEqual([
      ['HiveTracker', '2025 - Present', 'Beehive monitoring app.'],
      ['Pollen', 'Summer 2024', 'A bee game.'],
    ]);
  });

  it('keeps an undated, unbulleted section as one entry', () => {
    expect(splitEntries(['Pollen, a bee game', 'Made with Godot'])).toEqual([['Pollen, a bee game', 'Made with Godot']]);
  });
});

describe('cleanResumeText', () => {
  it('returns both sections', () => {
    expect(cleanResumeText(RESUME)).toMatchObject({ ok: true, projects: [[expect.stringContaining('HiveTracker')]] });
  });

  it('drops phone numbers, page headers/footers and lines naming the applicant', () => {
    const page1 = ['Jane Doe', 'Experience', 'Developer, Acme Corp (call 905-555-0100)', 'Worked with Jane Doe on the billing team.', 'Built a realtime dashboard in React.', 'jane.doe42 | Page footer text'].join('\n');
    const page2 = ['Projects', 'HiveTracker, a beehive monitoring app', 'jane.doe42 | Page footer text'].join('\n');
    const result = cleanResumeText([page1, page2], { firstNames: ['Jane'], lastName: 'Doe', email: 'jane.doe42@gmail.com' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const all = [...result.experience, ...result.projects].flat().join('\n');
    expect(all).not.toMatch(/Jane|Doe|555|footer/);
    expect(all).toContain('Developer, Acme Corp');
    expect(all).toContain('HiveTracker');
  });

  it("keeps a date even when the applicant's first name is a month", () => {
    const result = cleanResumeText('Experience\nIntern, Acme\nMay 2025 - Aug 2025\nBuilt a realtime dashboard in React and Go.', { firstNames: ['May'], lastName: 'Chen' });
    expect(result).toMatchObject({ ok: true, experience: [['Intern, Acme', 'May 2025 - Aug 2025', 'Built a realtime dashboard in React and Go.']] });
  });

  it('fails when neither section can be found', () => {
    expect(cleanResumeText('')).toMatchObject({ ok: false });
    expect(cleanResumeText('Jane Doe\nEducation\nSome College\nSkills\nGo')).toMatchObject({ ok: false });
  });
});

describe('pageLines', () => {
  const item = (str: string, x: number, y: number, width = str.length * 5) => ({ str, transform: [1, 0, 0, 1, x, y], width });

  it('reads a two-column layout one column at a time', () => {
    const items = [
      item('Jane Doe', 40, 760), item('Experience', 220, 760),
      item('University of Toronto', 40, 740), item('Intern, Acme Corp', 220, 740),
      item('BSc CS 2027', 40, 720), item('Built a dashboard', 220, 720),
      item('Projects', 220, 700),
    ];
    expect(pageLines(items, 600)).toEqual(['Jane Doe', 'University of Toronto', 'BSc CS 2027', 'Experience', 'Intern, Acme Corp', 'Built a dashboard', 'Projects']);
  });

  it('keeps a single-column line with a right-aligned date together', () => {
    const items = [item('Intern, Acme Corp', 40, 760), item('May 2025 - Aug 2025', 480, 760), item('Built a dashboard', 40, 740)];
    expect(pageLines(items, 600)).toEqual(['Intern, Acme Corp  May 2025 - Aug 2025', 'Built a dashboard']);
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

  it('returns one string per page', async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    pdf.addPage().drawText('Page one', { x: 50, y: 700, size: 12, font });
    pdf.addPage().drawText('Page two', { x: 50, y: 700, size: 12, font });
    expect((await extractPdfPages(await pdf.save())).map((page) => page.trim())).toEqual(['Page one', 'Page two']);
  });

  it('throws on something that is not a PDF', async () => {
    await expect(extractPdfText(new TextEncoder().encode('not a pdf'))).rejects.toThrow();
  });
});
