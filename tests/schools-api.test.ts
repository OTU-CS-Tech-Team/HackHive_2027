import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('server-only', () => ({}));
import { GET } from '@/app/api/schools/route';

async function call(query: string) {
  const res = await GET(new NextRequest(`http://localhost/api/schools?${query}`));
  return { res, body: (await res.json()) as { schools: string[] } };
}

describe('GET /api/schools', () => {
  it('returns the best matches, curated schools first', async () => {
    const { res, body } = await call('q=toronto');
    expect(res.status).toBe(200);
    expect(body.schools.slice(0, 2)).toEqual(['University of Toronto', 'Toronto Metropolitan University']);
    expect(body.schools.length).toBeLessThanOrEqual(8);
  });

  it('resolves aliases to the exact MLH name', async () => {
    expect((await call('q=uoit')).body.schools[0]).toBe('Ontario Tech University');
    expect((await call('q=Ryerson')).body.schools[0]).toBe('Toronto Metropolitan University');
  });

  it('answers exact lookups for "Did you mean"', async () => {
    expect((await call('q=U.O.I.T.&mode=exact')).body.schools).toEqual(['Ontario Tech University']);
    expect((await call('q=Ontario%20Tech%20Univeristy&mode=exact')).body.schools).toEqual([]);
  });

  it('returns an empty list for a missing or blank query', async () => {
    expect((await call('')).body.schools).toEqual([]);
    expect((await call('q=%20%20')).body.schools).toEqual([]);
  });

  it('never returns the whole list', async () => {
    expect((await call('q=a')).body.schools).toHaveLength(8);
  });

  it('lets browsers cache answers', async () => {
    expect((await call('q=waterloo')).res.headers.get('cache-control')).toContain('max-age');
  });
});
