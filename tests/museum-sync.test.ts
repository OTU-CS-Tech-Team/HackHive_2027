import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseMuseumSource, SOURCE_REPOSITORY, syncMuseum } from '../scripts/sync-museum.mjs';

const commit = 'a'.repeat(40);
const project = {
  id: 'shared-project', title: 'Shared project', description: 'A demo from CS Club.',
  year: 2026, thumbnail: '/projects/shared-project.png', youtubeId: 'TcK3JO73CKs',
  rotation: -4.5, attachment: 'pin', annotation: { text: 'Winner', ink: 'red' },
};

function source(projects = [project], years = [2026]) {
  return `import type { HackHiveProject } from '@/types/hackhive';
    export const ARCHIVE_YEARS = ${JSON.stringify(years)} as const;
    export const hackhiveProjects: HackHiveProject[] = ${JSON.stringify(projects)};`;
}

const directories: string[] = [];
async function testDirectory() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'hackhive-museum-test-'));
  directories.push(directory);
  return directory;
}

afterEach(async () => {
  for (const directory of directories.splice(0)) {
    if (!path.resolve(directory).startsWith(path.join(os.tmpdir(), 'hackhive-museum-test-'))) {
      throw new Error('Unexpected museum test cleanup path.');
    }
    await rm(directory, { recursive: true, force: true });
  }
});

describe('CS Club museum content', () => {
  it('shares content while excluding CS Club presentation fields', () => {
    const content = parseMuseumSource(source());
    expect(content.projects[0]).toEqual({
      id: project.id, title: project.title, description: project.description,
      year: 2026, thumbnail: project.thumbnail, youtubeId: project.youtubeId,
    });
  });

  it('picks up new source projects and years without a local data edit', () => {
    const content = parseMuseumSource(source([
      project, { ...project, id: 'new-project', title: 'New project', year: 2027 },
    ], [2026, 2027]));
    expect(content.years).toEqual([2027, 2026]);
    expect(content.projects.map((entry) => entry.title)).toEqual(['Shared project', 'New project']);
  });

  it('does not evaluate executable expressions in remote source', () => {
    expect(() => parseMuseumSource(source().replace(JSON.stringify([project]), 'runRemoteCode()')))
      .toThrow(/literal values/);
  });

  it('rejects malformed data and asset paths outside the project directory', () => {
    expect(() => parseMuseumSource(source([{ ...project, title: '' }]))).toThrow();
    expect(() => parseMuseumSource(source([{ ...project, thumbnail: '/projects/../../secret.png' }]))).toThrow();
    expect(() => parseMuseumSource('export const ARCHIVE_YEARS = [')).toThrow(/invalid TypeScript/);
  });

  it('rejects ambiguous or inconsistent collections', () => {
    expect(() => parseMuseumSource(source([project, project]))).toThrow(/Duplicate project/);
    expect(() => parseMuseumSource(source([project], [2026, 2026]))).toThrow(/Duplicate archive/);
    expect(() => parseMuseumSource(source([project], [2025]))).toThrow(/missing from ARCHIVE_YEARS/);
  });

  it('syncs content and images from the same upstream commit into generated files', async () => {
    const root = await testDirectory();
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/commits/main')) return Response.json({ sha: commit });
      if (url.endsWith('/src/data/hackhive.ts')) return new Response(source());
      if (url.endsWith('/public/projects/shared-project.png')) return new Response('test-image');
      throw new Error(`Unexpected URL: ${url}`);
    });
    await syncMuseum({ root, fetcher });
    const content = JSON.parse(await readFile(path.join(root, 'src/data/generated/hackhive.json'), 'utf8'));
    expect(content.source).toEqual({ repository: SOURCE_REPOSITORY, commit, path: 'src/data/hackhive.ts' });
    expect(content.projects[0].thumbnail).toBe('/museum/projects/shared-project.png');
    expect(await readFile(path.join(root, 'public/museum/projects/shared-project.png'), 'utf8')).toBe('test-image');
    expect(fetcher.mock.calls.slice(1).map(([url]) => String(url)))
      .toEqual([
        `https://raw.githubusercontent.com/${SOURCE_REPOSITORY}/${commit}/src/data/hackhive.ts`,
        `https://raw.githubusercontent.com/${SOURCE_REPOSITORY}/${commit}/public/projects/shared-project.png`,
      ]);
  });

  it('fails on missing upstream assets without replacing the previous dataset', async () => {
    const root = await testDirectory();
    const generated = path.join(root, 'src/data/generated');
    await mkdir(generated, { recursive: true });
    await writeFile(path.join(generated, 'hackhive.json'), 'last good dataset');
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/commits/main')) return Response.json({ sha: commit });
      if (url.endsWith('/src/data/hackhive.ts')) return new Response(source());
      return new Response('missing', { status: 404 });
    });
    await expect(syncMuseum({ root, fetcher })).rejects.toThrow(/404/);
    expect(await readFile(path.join(generated, 'hackhive.json'), 'utf8')).toBe('last good dataset');
  });
});
