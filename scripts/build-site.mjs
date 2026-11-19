import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile, rm, copyFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {evaluate} from '../engine.mjs';
import {bank,challengeThrough,zone} from './challenge.mjs';

const root=new URL('../',import.meta.url), out=new URL('dist/',root);
const base=new URL(process.env.SITE_URL ?? 'https://wordle.shauryav.com/');
if(base.protocol!=='https:' || base.username || base.password || base.search || base.hash || !base.pathname.endsWith('/')) throw new Error('SITE_URL must be an HTTPS site root ending in /');
const read=async path=>readFile(new URL(path,root),'utf8');
const put=async(path,contents)=>{
  const target=new URL(path,out);
  await mkdir(fileURLToPath(new URL('.',target)),{recursive:true});
  await writeFile(target,contents);
};
const json=async(path)=>JSON.parse(await read(path));
const e=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const url=path=>new URL(path.replace(/^\//,''),base).href;
const href=path=>new URL(url(path)).pathname;
const link=(path,label)=>'<a href="'+e(href(path))+'">'+e(label)+'</a>';
const dateFormat=new Intl.DateTimeFormat('en-US',{dateStyle:'long',timeZone:'UTC'});
const dated=date=>dateFormat.format(new Date(date+'T00:00:00Z'));
const {through}=await json('data/challenge-published.json');
const editions=challengeThrough(through);
if (!editions.length) throw new Error('No original challenge edition to publish');
const {answers,guesses}=await json('data/words.json');
const summary=evaluate(bank,{answers:bank,guesses:bank,firstGuess:'slate'});
const trace=new Map(summary.results.map(row=>[row.answer,row]));
const official=await json('data/daily.json');
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
for(const file of ['styles.css','assets/literata-latin.woff2','assets/literata-ofl.txt','app.mjs','play.mjs','engine.mjs','data/words.json','data/daily.json','data/challenge-bank.txt']) {
  const dest=new URL(file,out);await mkdir(fileURLToPath(new URL('.',dest)),{recursive:true});
  await copyFile(new URL(file,root),dest);
}
// Roll HTML, CSS and the entry script together even for visitors with a warm cache.
const versioned = {};
for (const file of ['styles.css','pages.css','app.mjs','play.mjs']) {
  const contents=await readFile(new URL(file,root));
  const digest=createHash('sha256').update(contents).digest('hex').slice(0,12);
  const stem=file.slice(0,file.lastIndexOf('.')), extension=file.slice(file.lastIndexOf('.'));
  const name=stem+'.'+digest+extension;
  await put(name,contents);
  versioned[file]='/'+name;
}
const newest=editions.at(-1);
await put('data/challenge.json',JSON.stringify({schemaVersion:1,timeZone:zone,editions},null,2)+'\n');
await put('data/benchmark.json',JSON.stringify({
  model:'Uniform-prior greedy entropy, common challenge bank, fixed SLATE opener',
  corpus:summary.total,solved:summary.solved,failed:summary.failed,averageGuessesSolved:summary.averageGuessesSolved,
  turnLimit:6,failures:summary.results.filter(r=>!r.solved).map(r=>({answer:r.answer,reason:r.reason}))
},null,2)+'\n');

const nav=[['/','Solver'],['/today/','Daily challenge'],['/archive/','Archive'],['/method/','Algorithm']];
function shell({path,title,description,heading,body,noindex=false}) {
  return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8">'+
  '<meta name="viewport" content="width=device-width,initial-scale=1">'+
  '<title>'+e(title)+'</title><meta name="description" content="'+e(description)+'">'+
  '<link rel="canonical" href="'+e(url(path))+'">'+
  '<meta property="og:type" content="website"><meta property="og:title" content="'+e(title)+'">'+
  '<meta property="og:description" content="'+e(description)+'"><meta property="og:url" content="'+e(url(path))+'">'+
  (noindex?'<meta name="robots" content="noindex,follow">':'')+
  '<link rel="icon" href="'+href('/favicon.svg')+'" type="image/svg+xml">'+
  '<link rel="stylesheet" href="'+href(versioned['styles.css'])+'"><link rel="stylesheet" href="'+href(versioned['pages.css'])+'">'+
  '</head><body><a class="skip" href="#page-content">Skip to content</a><div class="edition"><header class="edition-nav">'+link('/','Wordle Solver')+
  '<nav aria-label="Main">'+nav.map(([p,label])=>'<a href="'+e(href(p))+'"'+(p===path?' aria-current="page"':'')+'>'+e(label)+'</a>').join('')+'</nav></header>'+
  '<main class="edition-main" id="page-content"><h1>'+e(heading)+'</h1>'+body+
  '</main><footer class="edition-footer">An independent tool by Shaurya Verma. Not affiliated with The New York Times. '+link('/method/','Sources & method')+
  '</footer></div></body></html>\n';
}
function tiles(row){
  return '<span class="replay-tiles" role="img" aria-label="'+e([...row.guess].map((c,i)=>c.toUpperCase()+' '+['gray','yellow','green'][Number(row.pattern[i])]).join(', '))+'">'+
    [...row.guess].map((c,i)=>'<span class="replay-tile s'+row.pattern[i]+'" aria-hidden="true">'+e(c.toUpperCase())+'</span>').join('')+'</span>';
}
function spoiler(edition) {
  const result=trace.get(edition.answer);
  return '<details class="edition-section" data-nosnippet><summary>Reveal answer and walkthrough</summary>'+
    '<p class="answer-word">'+e(edition.answer.toUpperCase())+'</p><p>'+
    (result.solved?'The solver reached this word in '+result.turns+' guesses.':'The solver did not solve this edition within six guesses.')+
    ' It started with SLATE and used only feedback to choose later guesses.</p>'+
    '<ol class="replay-rows">'+result.history.map(row=>'<li>'+tiles(row)+' <span>'+row.remaining+' '+(row.remaining===1?'candidate':'candidates')+' left</span></li>').join('')+'</ol></details>';
}
function shape(answer) {
  const vowels=[...answer].filter(c=>'aeiou'.includes(c)).length;
  return '<div class="edition-section"><h2>Hints, no answer</h2><ul><li>'+vowels+' vowel '+(vowels===1?'tile':'tiles')+' (A, E, I, O, U).</li><li>'+ (new Set(answer).size===5?'No repeated letters.':'At least one letter repeats.')+'</li></ul></div>';
}
const dailyPath=d=>'/archive/'+d.date+'/';
const list=arr=>'<ol class="archive-list">'+arr.map(row=>'<li>'+link(dailyPath(row),dated(row.date))+'<span>Edition '+row.id+'</span></li>').join('')+'</ol>';
const sitePages=['/','/today/','/archive/','/method/'];
const writePage=async (path,options)=>put(path.replace(/^\//,'')+'index.html',shell({path,...options}));
await writePage('/today/',{
  title:'Today’s Daily Word Challenge | Simple Wordle Solver',
  description:'Get spoiler-free hints for the latest independent daily word challenge, then reveal the answer and an algorithmic solution walkthrough.',
  heading:'Today’s word challenge',
  body:'<p class="edition-lede">Latest posted edition: <strong>'+e(dated(newest.date))+'</strong>. This is our own five-letter daily puzzle, not the NYT Wordle answer. Editions are dated in New York time.</p>'+
    '<section class="edition-section"><h2>Play this edition</h2><form id="challenge-form"><label for="challenge-guess">Five-letter guess</label> <input id="challenge-guess" maxlength="5" pattern="[A-Za-z]{5}" autocomplete="off" autocapitalize="characters" required> <button type="submit" disabled>Guess</button></form><p id="challenge-status" role="status">Loading challenge…</p><ol class="replay-rows" id="challenge-rows"></ol></section>'+
    '<script type="module" src="'+href(versioned['play.mjs'])+'"></script>'+shape(newest.answer)+spoiler(newest)+'<p>'+link(dailyPath(newest),'Permanent link for this edition')+' · '+link('/archive/','Browse the archive')+'</p>'
});
await writePage('/archive/',{
  title:'Daily Word Challenge Archive | Simple Wordle Solver',
  description:'Browse every published edition of this independent five-letter daily challenge, with spoiler-free clues and replayable solver feedback.',
  heading:'Challenge archive',
  body:'<p class="edition-lede">Browse the original daily puzzles published here since '+e(dated(editions[0].date))+'. The index never displays answers.</p>'+
    list([...editions].reverse())+
    '<p>This is not the NYT archive. '+link('/wordle-answer/','See our separate index of selected NYT editions')+' or <a href="https://www.nytimes.com/games/wordle/index.html">visit NYT Wordle</a>.</p>'
});
for(let i=0;i<editions.length;i++) {
  const row=editions[i], path=dailyPath(row);
  const previous=editions[i-1], next=editions[i+1];
  sitePages.push(path);
  await writePage(path,{
    title:'Daily Word Challenge '+dated(row.date)+' | Edition '+row.id,
    description:'Hints, an optional answer reveal, and a verified letter-by-letter solver walkthrough for the original daily word challenge dated '+dated(row.date)+'.',
    heading:dated(row.date),
    body:'<p class="edition-lede">Independent five-letter puzzle. No answer is shown until you reveal it below.</p>'+
      shape(row.answer)+spoiler(row)+'<nav class="edition-pager" aria-label="Neighboring editions">'+
      (previous?link(dailyPath(previous),'Previous edition'):'')+link('/archive/','All editions')+
      (next?link(dailyPath(next),'Next edition'):'')+'</nav>'
  });
}
sitePages.push('/wordle-answer/');
await writePage('/wordle-answer/',{
  title:'NYT Wordle Answers | Selected Published Editions',
  description:'Find selected, independently sourced NYT Wordle answers by edition date. This is a partial editorial index, not an automated NYT feed.',
  heading:'NYT Wordle answers',
  body:'<p class="edition-lede">Only editions we have independently sourced are listed here. This is not a complete or automatically updated NYT archive. No answers are shown on the index.</p>'+
  '<ol class="archive-list">'+[...official.editions].reverse().map(row=>'<li>'+link('/wordle-answer/'+row.date+'/',dated(row.date))+
    '<span>'+ (row.id?'Puzzle #'+row.id:'Published edition')+'</span></li>').join('')+'</ol>'+
    '<p><a href="https://www.nytimes.com/games/wordle/index.html">Play the official game</a> · '+link('/today/','Play our separate daily challenge')+'</p>'
});
for(const row of official.editions){
  const path='/wordle-answer/'+row.date+'/';
  sitePages.push(path);
  await writePage(path,{
    title:'NYT Wordle Answer for '+dated(row.date)+(row.id?' (#'+row.id+')':''),
    description:'A sourced, spoiler-gated answer for the NYT Wordle edition of '+dated(row.date)+'. Free browser solver for your own feedback.',
    heading:'Wordle answer for '+dated(row.date),
    body:'<p class="edition-lede">Use the solver if you want help without seeing the answer.</p>'+
      shape(row.answer)+'<details class="edition-section" data-nosnippet><summary>Reveal the published answer</summary><p class="answer-word">'+e(row.answer.toUpperCase())+'</p></details>'+
      '<p>Source: <a href="'+e(row.sourceUrl)+'">published reporting</a>. '+link('/wordle-answer/','See selected editions')+' · '+link('/','Open the solver')+'</p>'
  });
}
await writePage('/method/',{
  title:'How the Wordle Solver Works: Feedback, Duplicates & Entropy',
  description:'Learn how the solver preserves green and yellow clues, handles duplicate letters, and ranks guesses using information gain.',
  heading:'How the solver works',
  body:'<p class="edition-lede">The solver keeps only words that would give the exact colors you entered.</p>'+
    '<section class="edition-section"><h2>1. Score greens before yellows</h2><p>First reserve the letters that match exactly. Then count the remaining unmatched copies in the answer. A misplaced copy can only turn yellow if an unused copy is still available.</p>'+
    '<p>For example, guess <strong>ALLEY</strong> against <strong>APPLE</strong>. A is green, the first L is yellow, the second L is gray, E is yellow, and Y is gray. A gray duplicate does not mean the letter is absent.</p></section>'+
    '<section class="edition-section"><h2>2. Replay every row</h2><p>A candidate survives only if scoring it against all previous guesses reproduces every tile. That preserves earlier greens and prevents a yellow letter from returning to the same column.</p></section>'+
    '<section class="edition-section"><h2>3. Split the candidates</h2><p>For each considered guess, partition the remaining words by feedback pattern. We prefer guesses with greater Shannon entropy under a uniform prior. Related metrics show the expected remaining count and the largest bucket. An information guess is sometimes useful even when it cannot itself be the answer.</p>'+
    '<p>The interactive worker evaluates a bounded set of guesses for speed. The candidate filter itself checks every candidate in the loaded lexicon.</p></section>'+
    '<section class="edition-section"><h2>What the benchmark means</h2><p><strong>'+summary.solved.toLocaleString('en-US')+' / '+summary.total.toLocaleString('en-US')+
    '</strong> in six guesses on our frozen original challenge bank; '+summary.failed+' unsolved. '+
    (summary.averageGuessesSolved==null?'':'Mean among solved: '+summary.averageGuessesSolved.toFixed(2)+' guesses. ')+
    'All runs began with SLATE and then ranked the full challenge bank by entropy while respecting prior guesses. The actual hidden target was used only to score guesses. This is a self-defined benchmark, not a guarantee over NYT Wordle, and not a proof of shortest play.</p></section>'+
    '<section class="edition-section"><h2>Sources and limits</h2><p>The default word list includes '+answers.length.toLocaleString('en-US')+
    ' candidate answers and '+guesses.length.toLocaleString('en-US')+
    ' allowed suggestions from the public-domain <a href="https://www.gutenberg.org/ebooks/3201">Moby word lists</a>. The NYT vocabulary is not distributed here; a valid NYT word may be missing, and the site may suggest words NYT does not accept.</p>'+
    '<p>Our original challenge uses a frozen editorial word bank. Only editions dated today or earlier are emitted. The separately sourced official-answer cache currently has '+e(official.editions?.length??0)+' entries and is not a comprehensive history.</p>'+
    '<p><a href="https://github.com/hoverdart/simple-wordle-solver">Source and reproducible tests</a></p></section>'
});
await writePage('/waffle/',{
  title:'Waffle Helper | Simple Wordle Solver', description:'Information about the legacy experimental Waffle helper.',
  heading:'Waffle helper',
  body:'<p class="edition-lede">The experimental Waffle helper was part of the old Flask project and is not served by this static Wordle rebuild.</p><p><a href="https://wafflegame.net/">Play Waffle</a> · <a href="https://github.com/hoverdart/simple-wordle-solver/tree/3e5fae45b9d4f4c92d836239561be308138e9476">Original source</a></p>',noindex:true
});
let home=await read('index.html');
for(const file of ['styles.css','app.mjs'])home=home.replaceAll('"/'+file+'"','"'+versioned[file]+'"');
// The repository default is the project's Vercel root; allow portable static hosting.
home=home.replaceAll('https://wordle.shauryav.com/',base.href);
if(base.pathname!=='/')home=home.replace(/(href|src)="\/(?!\/)/g,'$1="'+base.pathname);
await put('index.html',home);
const pagesCss=await read('pages.css');
await put('pages.css',pagesCss);
await put('favicon.svg','<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#191d21"/><path d="M11 18h12v12H11zm15 0h12v12H26zm15 0h12v12H41zM11 33h12v12H11zm15 0h12v12H26zm15 0h12v12H41z" fill="#62706f"/><path d="M26 18h12v12H26z" fill="#e9b857"/><path d="M41 33h12v12H41z" fill="#70cc9a"/></svg>\n');
await put('robots.txt','User-agent: *\nAllow: /\nSitemap: '+url('/sitemap.xml')+'\n');
await put('sitemap.xml','<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+sitePages.map(p=>'  <url><loc>'+e(url(p))+'</loc></url>').join('\n')+'\n</urlset>\n');
console.log('Built '+sitePages.length+' indexable pages; challenge editions '+editions.length+'; benchmark '+summary.solved+'/'+summary.total);
