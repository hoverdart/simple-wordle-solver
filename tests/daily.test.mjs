import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {editionDate, emptyArchive, mergePublishedRecords, syncDaily} from '../scripts/sync-daily.mjs';
const now = new Date('2026-11-19T00:30:00Z');
const source = {url:'https://example.com/published', rights:'permission-granted', evidenceUrl:'https://example.com/license'};
const bundle = (editions) => ({source, editions});
const entry = (date = '2026-11-18', answer = 'crane', id = 1978) => ({date, answer, id});

test('New York date handles UTC rollover and DST', () => {
  assert.equal(editionDate(now), '2026-11-18');
  assert.equal(editionDate(new Date('2026-07-01T03:59:59Z')), '2026-06-30');
  assert.equal(editionDate(new Date('2026-07-01T04:00:00Z')), '2026-07-01');
  assert.equal(editionDate(new Date('2026-11-01T06:30:00Z')), '2026-11-01');
});
test('published dates only; future rejection is atomic', () => {
  assert.throws(() => mergePublishedRecords(emptyArchive(), bundle([entry(), entry('2026-11-19')]), now), /Future/);
  assert.throws(() => mergePublishedRecords(emptyArchive(), bundle([entry('2026-02-30')]), now), /Invalid/);
});
test('coverage is factual and incomplete; idempotent imports do not change retrieval time', () => {
  const cache = mergePublishedRecords(emptyArchive(), bundle([entry('2026-11-18'), entry('2026-11-16','apple',1976)]), now);
  assert.deepEqual(cache.coverage, {from:'2026-11-16', to:'2026-11-18', count:2, complete:false});
  assert.equal(cache.editions[0].answer, 'apple');
  assert.deepEqual(mergePublishedRecords(cache, bundle([entry()]), new Date('2026-11-20T10:00:00Z')), cache);
});
test('conflicts, malformed words, IDs and missing rights fail closed', () => {
  const cache = mergePublishedRecords(emptyArchive(), bundle([entry()]), now);
  assert.throws(() => mergePublishedRecords(cache, bundle([entry('2026-11-18','apple')]), now), /Conflicting/);
  for (const word of ['APPLE','abc','<img>','a1bcd']) assert.throws(() => mergePublishedRecords(emptyArchive(), bundle([entry('2026-11-18',word)]),now));
  assert.throws(() => mergePublishedRecords(emptyArchive(), bundle([entry('2026-11-18','apple',-1)]),now));
  assert.throws(() => mergePublishedRecords(emptyArchive(), {source:{url:source.url},editions:[entry()]},now),/rights/);
  assert.throws(() => mergePublishedRecords(emptyArchive(), {source:{...source,url:'https://name:password@example.com/'},editions:[entry()]},now),/credentials/);
});
test('bounded manual imports cannot become an unlicensed bulk archive', () => {
  assert.throws(() => mergePublishedRecords(emptyArchive(), {source:{...source,rights:'manual-public-fact'}, editions:Array(8).fill(entry())},now),/seven/);
});
test('future or duplicate cached editions fail rather than being served', () => {
  const cache=mergePublishedRecords(emptyArchive(),bundle([entry()]),now);
  assert.throws(()=>mergePublishedRecords({...cache,editions:[...cache.editions,...cache.editions]},null,now),/Duplicate/);
  assert.throws(()=>mergePublishedRecords(cache,null,new Date('2026-11-17T12:00:00Z')),/Future/);
});
test('offline sync works and invalid import preserves last-known-good bytes', async () => {
  const dir=await mkdtemp(join(tmpdir(),'daily-test-'));
  try {
    const archivePath=join(dir,'daily.json'); const importPath=join(dir,'import.json');
    await writeFile(importPath,JSON.stringify(bundle([entry()])));
    const result=await syncDaily({archivePath,importPath,now});
    const saved=await readFile(archivePath,'utf8');
    assert.deepEqual(await syncDaily({archivePath,now}),result);
    await writeFile(importPath,JSON.stringify(bundle([entry('2026-11-19')])));
    await assert.rejects(syncDaily({archivePath,importPath,now}),/Future/);
    assert.equal(await readFile(archivePath,'utf8'),saved);
    const empty=await syncDaily({archivePath:join(dir,'empty.json'),now});
    assert.equal(empty.coverage.count,0); assert.equal(empty.updatedAt,null);
  } finally {await rm(dir,{recursive:true,force:true});}
});

test('shipped lexicon has explicit provenance, valid unique words and candidate inclusion', async () => {
  const lexicon=JSON.parse(await readFile(new URL('../data/words.json',import.meta.url),'utf8'));
  assert.equal(lexicon.schemaVersion,1); assert.equal(lexicon.officialAnswerList,false);
  assert.match(lexicon.source.license,/Public domain/);
  assert.match(lexicon.source.revision,/^[a-f0-9]{40}$/);
  assert.equal(lexicon.answers.length,4060); assert.equal(lexicon.guesses.length,8353);
  for(const list of [lexicon.answers,lexicon.guesses]) {
    assert.equal(new Set(list).size,list.length);
    assert.deepEqual([...list].sort(),list);
    assert.ok(list.every(word=>/^[a-z]{5}$/.test(word)));
  }
  const guesses=new Set(lexicon.guesses);
  assert.ok(lexicon.answers.every(word=>guesses.has(word)));
  for(const word of ['apple','crane','stare','slate']) assert.ok(guesses.has(word));
});

test('shipped published archive never claims a complete or generated history',async()=>{
  const archive=JSON.parse(await readFile(new URL('../data/daily.json',import.meta.url),'utf8'));
  assert.equal(archive.kind,'published-wordle-records');
  assert.equal(archive.coverage.complete,false);
  assert.equal(mergePublishedRecords(archive).editions.length,archive.coverage.count);
});
