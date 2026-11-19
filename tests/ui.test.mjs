import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {filterCandidates} from '../engine.mjs';
class Element {
 constructor(){this.children=[];this.attrs={};this.events={};this.value='';this.textContent='';this.disabled=false;this.hidden=false;this.parts={};this.className='';this.classList={toggle:()=>{}};}
 append(...items){this.children.push(...items);} replaceChildren(...items){this.children=items;}
 setAttribute(k,v){this.attrs[k]=v;} addEventListener(k,fn){this.events[k]=fn;}
 querySelector(tag){return this.parts[tag]??=new Element();}
 set innerHTML(v){this.html=v;this.children=[];}get innerHTML(){return this.html;}
 focus(){} scrollIntoView(){} click(){this.events.click?.({preventDefault(){}});}
}
async function fixture({fail=false,challenge=false}={}){
 const elements=new Map();const get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};get('daily-answer').hidden=true;
 const words=['apple','allee','ample','angle','crane','slate','trace','arise','roast'];
 const context=vm.createContext({document:{getElementById:get,createElement:()=>new Element()},filterCandidates,Intl,Date,Set,Array,Number,String,Math,Error,location:{href:'https://example.test/'},matchMedia:()=>({matches:true}),URL,Blob,Worker:class{constructor(){throw Error('worker blocked');}},fetch:async url=>{if(url.includes('challenge'))return challenge?{ok:true,json:async()=>({timeZone:'America/New_York',editions:[{date:new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),answer:'apple'}]})}:{ok:false};if(fail)throw Error('offline');return {ok:true,json:async()=>({answers:words,guesses:words})};}});
 const source=fs.readFileSync(new URL('../app.mjs',import.meta.url),'utf8').replace(/^import .*?;\n/,'');vm.runInContext(source,context);await new Promise(r=>setImmediate(r));
 function submit(guess,pattern){get('guess').value=guess;get('guess').events.input();for(let i=0;i<5;i++)for(let j=0;j<Number(pattern[i]);j++)get('feedback').children[i].click();get('guess-form').events.submit({preventDefault(){}});}
 return {get,submit,words};
}
test('initial load is honest, no spoilers, tiles are labeled',async()=>{const {get}=await fixture();assert.equal(get('candidate-count').textContent,'9');assert.equal(get('apply').disabled,false);assert.match(get('feedback').children[0].attrs['aria-label'],/empty, Absent/);assert.equal(get('daily-answer').hidden,true);assert.match(get('daily-meta').textContent,/unavailable/);});
test('cumulative duplicates filter correctly; undo restores clue and reset recovers',async()=>{const {get,submit}=await fixture();submit('allee','21002');assert.equal(get('candidate-count').textContent,'3');submit('ample','20222');assert.equal(get('candidate-count').textContent,'1');assert.equal(get('history').children.length,2);get('undo').click();assert.equal(get('candidate-count').textContent,'3');assert.equal(get('guess').value,'AMPLE');assert.match(get('feedback').children[1].attrs['aria-label'],/Absent/);get('reset').click();assert.equal(get('candidate-count').textContent,'9');assert.equal(get('guess').value,'');assert.equal(get('undo').disabled,true);});
test('contradictory all-green clues produce zero, never silently discard history',async()=>{const {get,submit}=await fixture();submit('apple','22222');submit('crane','22222');assert.equal(get('candidate-count').textContent,'0');assert.match(get('suggestions').innerHTML,/No matching words/);get('undo').click();assert.equal(get('candidate-count').textContent,'1');});
test('feedback cycles absent-present-correct-absent, invalid guess does not append',async()=>{const {get,submit}=await fixture();const tile=get('feedback').children[0];tile.click();assert.match(tile.attrs['aria-label'],/Wrong spot/);tile.click();assert.match(tile.attrs['aria-label'],/Right spot/);tile.click();assert.match(tile.attrs['aria-label'],/Absent/);submit('cat','00000');assert.match(get('message').textContent,/exactly five/);assert.equal(get('candidate-count').textContent,'9');});
test('dictionary failure has explicit fallback and no fake counts',async()=>{const {get}=await fixture({fail:true});assert.equal(get('data-status').textContent,'UNAVAILABLE');assert.equal(get('candidate-count').textContent,'—');assert.match(get('message').textContent,/could not load/);});

test('original daily challenge is spoiler-gated and isolated from manual board',async()=>{const {get}=await fixture({challenge:true});assert.equal(get('daily-answer').hidden,true);assert.equal(get('daily-answer').textContent,'');get('reveal').click();assert.equal(get('daily-answer').textContent,'APPLE');assert.equal(get('daily-answer').hidden,false);assert.equal(get('candidate-count').textContent,'9');get('reveal').click();assert.equal(get('daily-answer').hidden,true);assert.equal(get('daily-answer').textContent,'');});

test('homepage uses ruled editorial layout, local serif type, and form-first reading order',()=>{
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const css=fs.readFileSync(new URL('../styles.css',import.meta.url),'utf8');
 assert.match(html,/class="masthead"/);assert.match(html,/>Wordle Solver<\/h1>/);
 assert.ok(html.indexOf('id="guess-form"')<html.indexOf('id="results-title"'));
 assert.match(html,/<tbody id="candidates">/);
 assert.match(html,/aria-current="page"/);
 assert.doesNotMatch(html,/eyebrow|title-slab|crystal ball|Make your next|A FRESH CHALLENGE/);
 assert.doesNotMatch(css,/@import|url\(["']?https?:|linear-gradient/);
 assert.match(css,/--paper: #f8f6ef/);
 assert.match(css,/assets\/literata-latin\.woff2/);
 assert.match(css,/@media \(max-width: 670px\)/);
 assert.match(css,/grid-template-columns: minmax\(0, 1fr\)/);
});
test('candidate table rows retain accessible word actions',async()=>{
 const {get,submit}=await fixture();submit('allee','21002');submit('ample','20222');
 const rows=get('candidates').children;assert.equal(rows.length,1);
 assert.equal(rows[0].children[0].attrs.scope,'row');
 const button=rows[0].children[1].children[0];assert.equal(button.textContent,'APPLE');
 button.click();assert.equal(get('guess').value,'APPLE');assert.equal(get('candidate-count').textContent,'1');
});
