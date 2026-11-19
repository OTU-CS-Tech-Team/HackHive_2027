import { describe, expect, it } from 'vitest';
import { REMOVED, makeScrubber } from '@/lib/review/scrub';

const scrub = makeScrubber({
  names: ['Jane', 'Doe', 'Janie'],
  email: 'jane.doe42@gmail.com',
  phone: '+1 (905) 555-0100',
  school: 'Ontario Tech University',
  program: 'Computer Science',
  city: 'Oshawa',
  links: ['https://github.com/janedoe-dev', 'https://www.linkedin.com/in/jane-doe-123/', 'https://janedoe.dev'],
});

describe('makeScrubber', () => {
  it("removes the applicant's own name, email and phone", () => {
    const out = scrub('Hi, I am Jane Doe (Janie to friends). Email jane.doe42@gmail.com or call 905-555-0100.');
    expect(out).not.toMatch(/Jane|Doe|Janie|gmail|555/);
    expect(out).toContain(REMOVED);
    expect(out).toContain('Hi, I am [removed] (');
  });

  it('removes names regardless of case but keeps other words containing them', () => {
    expect(scrub('JANE built Janeway, doe-eyed')).toBe(`${REMOVED} built Janeway, ${REMOVED}-eyed`);
  });

  it('removes any email, phone or link, not just theirs', () => {
    const out = scrub(
      'Ask bob@example.org, ring (416) 555-1234 or +44 20 7946 0958, see https://foo.bar/x, www.site.ca, github.com/someone and me.github.io',
    );
    expect(out).not.toMatch(/bob|example|416|7946|foo\.bar|site\.ca|someone|github/);
  });

  it('keeps tech names, years and big numbers that look like links or phones', () => {
    const text = 'Used Node.js, Socket.io and ASP.NET from 2019-2023, serving 1,000,000 users and 12345678 requests.';
    expect(scrub(text)).toBe(text);
  });

  it('removes their school, program, city and link handles', () => {
    const out = scrub('A Computer Science student in Oshawa at Ontario Tech University. Code at janedoe-dev.');
    expect(out).not.toMatch(/Computer Science|Oshawa|Ontario Tech|janedoe/);
  });

  it('removes every listed school name and nickname', () => {
    const out = scrub(
      'Friends from the University of Toronto, U of T, UofT, UTSC, Waterloo, TMU (Ryerson), McGill, Queen’s, Queens University, UBC and MIT.',
    );
    for (const school of ['Toronto', 'U of T', 'UofT', 'UTSC', 'Waterloo', 'TMU', 'Ryerson', 'McGill', 'Queen', 'UBC', 'MIT']) {
      expect(out).not.toContain(school);
    }
  });

  it('matches schools without accents and by initials', () => {
    const out = scrub('Exchange at Universite de Montreal, then SFU and NYU.');
    expect(out).not.toMatch(/Montreal|SFU|NYU/);
  });

  it('leaves short acronyms alone in lowercase words', () => {
    expect(scrub('the mit license, ut enim')).toBe('the mit license, ut enim');
  });

  it('merges neighbouring removals into one', () => {
    expect(scrub('By Jane Doe.')).toBe(`By ${REMOVED}.`);
  });

  it('handles empty input and identities with junk values', () => {
    expect(scrub(null)).toBe('');
    const loose = makeScrubber({ names: ['-', '', null], email: null, links: ['not a url'] });
    expect(loose('Plain text stays.')).toBe('Plain text stays.');
  });
});
