/** Published Wordle record importer. Deliberately no network scraping. */
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const TIME_ZONE = 'America/New_York';
const FIRST_DATE = '2021-06-19';
const RIGHTS = new Set(['public-domain', 'CC0-1.0', 'permission-granted', 'manual-public-fact']);
export function editionDate(now = new Date()) {
  if (!Number.isFinite(now.getTime())) throw new Error('Invalid clock');
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now).map(({type, value}) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function publicUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.') ||
      /^(localhost|127\.|0\.)/.test(url.hostname) || url.hostname.endsWith('.local')) {
    throw new Error('A public HTTPS provenance URL without credentials is required');
  }
  return url.href;
}
function validDate(date, today) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      new Date(`${date}T12:00:00Z`).toISOString().slice(0,10) !== date || date < FIRST_DATE) {
    throw new Error(`Invalid edition date: ${date}`);
  }
  if (date > today) throw new Error(`Future edition rejected: ${date}`);
}
function validateEntry(entry, today) {
  validDate(entry.date, today);
  if (typeof entry.answer !== 'string' || !/^[a-z]{5}$/.test(entry.answer)) throw new Error('Answer must be five lowercase ASCII letters');
  if (entry.id !== null && (!Number.isSafeInteger(entry.id) || entry.id < 0)) throw new Error('Invalid puzzle id');
  publicUrl(entry.sourceUrl);
  if (!RIGHTS.has(entry.rights)) throw new Error('Record requires explicit permitted provenance');
  publicUrl(entry.rightsEvidenceUrl);
  if (!Number.isFinite(Date.parse(entry.retrievedAt))) throw new Error('Invalid retrieved timestamp');
}
export function emptyArchive() {
  return {schemaVersion: 1, kind: 'published-wordle-records', timeZone: TIME_ZONE,
    updatedAt: null, coverage: {from: null, to: null, count: 0, complete: false}, editions: []};
}
export function mergePublishedRecords(cache, incoming = null, now = new Date()) {
  const today = editionDate(now);
  if (cache.schemaVersion !== 1 || cache.timeZone !== TIME_ZONE || !Array.isArray(cache.editions)) throw new Error('Unsupported archive schema');
  const entries = new Map();
  for (const entry of cache.editions) {
    validateEntry(entry, today);
    if (entries.has(entry.date)) throw new Error('Duplicate cached edition date');
    entries.set(entry.date, {...entry});
  }
  let changed = false;
  if (incoming) {
    const source = incoming.source;
    if (!source || !RIGHTS.has(source.rights) || !Array.isArray(incoming.editions)) throw new Error('Import needs source rights and editions');
    const sourceUrl = publicUrl(source.url);
    const rightsEvidenceUrl = publicUrl(source.evidenceUrl);
    // Manual fact entry is intentionally bounded; it is not an archive-copying route.
    if (source.rights === 'manual-public-fact' && incoming.editions.length > 7) throw new Error('Manual factual imports are limited to seven records');
    for (const item of incoming.editions) {
      const entry = {date: item.date, answer: item.answer, id: item.id ?? null,
        sourceUrl, rights: source.rights, rightsEvidenceUrl, retrievedAt: now.toISOString()};
      validateEntry(entry, today);
      const previous = entries.get(entry.date);
      if (previous && (previous.answer !== entry.answer || previous.id !== entry.id)) throw new Error(`Conflicting edition: ${entry.date}`);
      if (!previous) {entries.set(entry.date, entry); changed = true;}
    }
  }
  const editions = [...entries.values()].sort((a,b) => a.date.localeCompare(b.date));
  return {...emptyArchive(), updatedAt: changed ? now.toISOString() : cache.updatedAt,
    coverage: {from: editions[0]?.date ?? null, to: editions.at(-1)?.date ?? null, count: editions.length, complete: false}, editions};
}
export async function syncDaily({archivePath, importPath, now = new Date()} = {}) {
  archivePath ??= fileURLToPath(new URL('../data/daily.json', import.meta.url));
  const readJson = async path => {
    const text = await readFile(path, 'utf8');
    if (Buffer.byteLength(text) > 2_000_000) throw new Error('Input exceeds 2 MB limit');
    return JSON.parse(text);
  };
  let cache;
  try {cache = await readJson(archivePath);} catch (error) {
    if (error.code !== 'ENOENT') throw error;
    cache = emptyArchive();
  }
  const output = mergePublishedRecords(cache, importPath ? await readJson(importPath) : null, now);
  const serialized = JSON.stringify(output, null, 2) + '\n';
  await mkdir(dirname(archivePath), {recursive: true});
  // All validation precedes a write. A failing import preserves the last good cache.
  const temporary = `${archivePath}.${process.pid}.tmp`;
  await writeFile(temporary, serialized, {flag: 'wx'});
  await rename(temporary, archivePath);
  return output;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--import')) {
    console.error('Usage: node scripts/sync-daily.mjs [--import permitted-records.json]');
    process.exitCode = 1;
  } else {
    try {
      const archive = await syncDaily({importPath: args[1]});
      console.log(`Validated ${archive.coverage.count} published records. No external source contacted. Automatic NYT acquisition is not configured.`);
    } catch (error) {console.error(error.message); process.exitCode = 1;}
  }
}
