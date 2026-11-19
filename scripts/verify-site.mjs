import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {posix} from 'node:path';
import {scoreGuess,solve} from '../engine.mjs';
import {bank,dateInZone} from './challenge.mjs';

const dist=new URL('../dist/',import.meta.url);
const read=path=>readFile(new URL(path,dist),'utf8');
const sitemap=await read('sitemap.xml');
const urls=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(x=>new URL(x[1]));
assert(urls.length>=5,'Sitemap contains solver, daily, archive, method, and dated editions');
assert.equal(new Set(urls.map(x=>x.href)).size,urls.length);
const base=urls[0];
const toFile=pathname=> {
  assert(pathname.startsWith(base.pathname),'Local output URL must stay inside its site base');
  const relative=pathname.slice(base.pathname.length);
  return relative.endsWith('/') || !relative ? relative+'index.html' : relative;
};
for(const url of urls) {
  const html=await read(toFile(url.pathname));
  assert(html.includes('rel="canonical" href="'+url.href+'"'));
  assert(!html.includes('noindex') || !/<meta name="robots" content="noindex/.test(html));
  assert(/<title>[^<]+<\/title>/.test(html));
  assert(/<h1[ >]/.test(html));
  assert(!/class="[^"]*\b(?:eyebrow|edition-kicker)\b/.test(html), 'No decorative eyebrow text');
  assert(!/make your next guess count|a little logic|one word\. a new way in/i.test(html), 'No decorative taglines');
  assert(/<meta name="description" content="[^"]+"/.test(html));
  for(const [,href] of html.matchAll(/(?:href|src)="(\/[^"]*)"/g)) {
    const linked=toFile(new URL(href,url).pathname);
    assert(!posix.isAbsolute(linked));
    assert((await stat(new URL(linked,dist))).isFile(),linked+' missing');
  }
}
const challenge=JSON.parse(await read('data/challenge.json'));
assert.equal(challenge.timeZone,'America/New_York');
for(const row of challenge.editions){
  assert(row.date<=dateInZone());
  const html=await read('archive/'+row.date+'/index.html');
  assert(html.includes('data-nosnippet'));
  assert(html.includes(row.answer.toUpperCase()));
  const result=solve(row.answer,{answers:bank,guesses:bank,firstGuess:'slate'});
  result.history.forEach(step=>assert.equal(scoreGuess(step.guess,row.answer),step.pattern));
}
assert.match(await read('index.html'),/\/styles\.[a-f0-9]{12}\.css"/);
assert.match(await read('index.html'),/\/app\.[a-f0-9]{12}\.mjs"/);
assert.match(await read('today/index.html'),/\/pages\.[a-f0-9]{12}\.css"/);
assert.match(await read('today/index.html'),/\/play\.[a-f0-9]{12}\.mjs"/);
const published=JSON.parse(await read('data/daily.json'));
for(const row of published.editions){
  const html=await read('wordle-answer/'+row.date+'/index.html');
  assert(html.includes('data-nosnippet'));
  assert(html.includes(row.answer.toUpperCase()));
  assert(row.date<=dateInZone());
}
assert((await read('robots.txt')).includes(new URL('sitemap.xml',base).href));
const method=await read('method/index.html');
assert(method.includes('not a guarantee over NYT Wordle'));
console.log('Verified '+urls.length+' canonical pages, internal links, spoiler markup, and published edition dates.');
