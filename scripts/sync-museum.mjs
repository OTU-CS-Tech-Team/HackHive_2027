import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import { z } from 'zod';

export const SOURCE_REPOSITORY = 'OTU-CS-Tech-Team/CS_Club_Website-2027';
const SOURCE_PATH = 'src/data/hackhive.ts';
const RAW_ROOT = `https://raw.githubusercontent.com/${SOURCE_REPOSITORY}`;

const projectSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(1),
  description: z.string().min(1),
  year: z.number().int().min(1900).max(3000),
  youtubeId: z.string().regex(/^[\w-]{11}$/).optional(),
  thumbnail: z.string().regex(/^\/projects\/[\w-]+\.(?:png|jpe?g|webp|avif)$/).optional(),
  award: z.string().optional(),
  team: z.string().optional(),
  techStack: z.array(z.string()).optional(),
  githubUrl: z.url({ protocol: /^https$/ }).optional(),
  devpostUrl: z.url({ protocol: /^https$/ }).optional(),
  category: z.string().optional(),
});

// Read literal data only. Never execute code downloaded from the source repo.
function readLiteral(node) {
  if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node)) {
    return readLiteral(node.expression);
  }
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(node.operand)) {
    return -Number(node.operand.text);
  }
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(readLiteral);
  if (ts.isObjectLiteralExpression(node)) {
    return Object.fromEntries(node.properties.map((property) => {
      if (!ts.isPropertyAssignment(property) ||
          !(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))) {
        throw new Error('Museum data must contain only literal object properties.');
      }
      return [property.name.text, readLiteral(property.initializer)];
    }));
  }
  throw new Error('Museum data must contain only literal values, not executable expressions.');
}

export function parseMuseumSource(source) {
  const file = ts.createSourceFile(SOURCE_PATH, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (file.parseDiagnostics.length) throw new Error('CS Club museum data contains invalid TypeScript.');
  const exports = new Map();
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement) ||
        !statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.initializer &&
          ['ARCHIVE_YEARS', 'hackhiveProjects'].includes(declaration.name.text)) {
        exports.set(declaration.name.text, readLiteral(declaration.initializer));
      }
    }
  }
  const years = z.array(z.number().int().min(1900).max(3000)).min(1).parse(exports.get('ARCHIVE_YEARS'));
  const projects = z.array(projectSchema).min(1).parse(exports.get('hackhiveProjects'));
  if (new Set(years).size !== years.length) throw new Error('Duplicate archive year in CS Club data.');
  if (new Set(projects.map((project) => project.id)).size !== projects.length) {
    throw new Error('Duplicate project ID in CS Club data.');
  }
  if (projects.some((project) => !years.includes(project.year))) {
    throw new Error('A project year is missing from ARCHIVE_YEARS in CS Club data.');
  }
  return { years: years.sort((a, b) => b - a), projects };
}

export async function syncMuseum({ root = fileURLToPath(new URL('../', import.meta.url)), fetcher = fetch } = {}) {
  async function request(url) {
    const response = await fetcher(url, {
      signal: AbortSignal.timeout(30_000),
      headers: { 'User-Agent': 'HackHive-museum-sync', Accept: 'application/vnd.github+json' },
    });
    if (!response.ok) throw new Error(`Museum sync failed (${response.status}): ${url}`);
    return response;
  }

  const revision = await (await request(`https://api.github.com/repos/${SOURCE_REPOSITORY}/commits/main`)).json();
  const commit = z.string().regex(/^[a-f0-9]{40}$/).parse(revision.sha);
  const dataUrl = `${RAW_ROOT}/${commit}/${SOURCE_PATH}`;
  const { years, projects } = parseMuseumSource(await (await request(dataUrl)).text());
  const thumbnails = [...new Set(projects.flatMap((project) => project.thumbnail ? [project.thumbnail] : []))];
  // Fetch everything from one commit before replacing the local generated content.
  const assets = await Promise.all(thumbnails.map(async (thumbnail) => ({
    name: path.posix.basename(thumbnail),
    bytes: Buffer.from(await (await request(`${RAW_ROOT}/${commit}/public${thumbnail}`)).arrayBuffer()),
  })));
  const content = {
    source: { repository: SOURCE_REPOSITORY, commit, path: SOURCE_PATH },
    years,
    projects: projects.map((project) => ({
      ...project,
      ...(project.thumbnail ? { thumbnail: `/museum/projects/${path.posix.basename(project.thumbnail)}` } : {}),
    })),
  };
  await mkdir(path.join(root, 'public/museum/projects'), { recursive: true });
  await mkdir(path.join(root, 'src/data/generated'), { recursive: true });
  await Promise.all(assets.map((asset) => writeFile(path.join(root, 'public/museum/projects', asset.name), asset.bytes)));
  await writeFile(path.join(root, 'src/data/generated/hackhive.json'), `${JSON.stringify(content, null, 2)}\n`);
  return content;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const content = await syncMuseum();
    console.log(`Synced ${content.projects.length} museum projects from ${SOURCE_REPOSITORY}@${content.source.commit.slice(0, 7)}.`);
  } catch (error) {
    console.error('Museum sync failed. Check the network and the CS Club source data.', error);
    process.exitCode = 1;
  }
}
