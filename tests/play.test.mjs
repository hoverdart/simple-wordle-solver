import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {scoreGuess} from '../engine.mjs';
class Element {
  constructor(){this.children=[];this.attrs={};this.disabled=false;this.value='';this.events={};}
  append(child){this.children.push(child);}
  addEventListener(name,listener){this.events[name]=listener;}
  setAttribute(key,value){this.attrs[key]=value;}
  focus(){}
}
test('playable daily keeps answer hidden, scores repeats, and ends after a win',async()=>{
  const button=new Element(), form=new Element();form.querySelector=()=>button;
  const input=new Element(),status=new Element(),board=new Element();
  button.disabled=true;
  const nodes={'challenge-form':form,'challenge-guess':input,'challenge-status':status,'challenge-rows':board};
  const script=(await readFile(new URL('../play.mjs',import.meta.url),'utf8'))
    .replace(/^import .*?;\n/,'').replaceAll('import.meta.url','"https://example.com/play.mjs"');
  const fixture=vm.createContext({scoreGuess,URL,document:{getElementById:name=>nodes[name],createElement:()=>new Element()},
    fetch:async url=>({ok:true,json:async()=>String(url).includes('challenge')?{editions:[{answer:'apple'}]}:{guesses:['alley','apple']}})});
  vm.runInContext(script,fixture);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(status.textContent,'You have six guesses.');
  const guess=value=>{input.value=value;form.events.submit({preventDefault(){}});};
  guess('xxxxx');assert.equal(board.children.length,0);
  guess('alley');assert.equal(board.children.length,1);
  assert.match(board.children[0].children[0].attrs['aria-label'],/A green, L yellow, L gray, E yellow, Y gray/);
  guess('alley');assert.equal(board.children.length,1);
  guess('apple');assert.equal(board.children.length,2);
  assert.equal(status.textContent,'Solved in 2 guesses.');assert.equal(button.disabled,true);
});
