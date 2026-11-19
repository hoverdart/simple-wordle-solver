import {scoreGuess} from './engine.mjs';

const form=document.getElementById('challenge-form');
const input=document.getElementById('challenge-guess');
const submit=form.querySelector('button');
const status=document.getElementById('challenge-status');
const board=document.getElementById('challenge-rows');
const colors=['gray','yellow','green'];
Promise.all(['challenge','words'].map(async name=>{
  const response=await fetch(new URL('./data/'+name+'.json',import.meta.url));
  if(!response.ok) throw new Error('Challenge unavailable');
  return response.json();
})).then(([challenge,words])=>{
  const edition=challenge.editions.at(-1);
  if(!edition || !/^[a-z]{5}$/.test(edition.answer)) throw new Error('Invalid challenge');
  const allowed=new Set([...words.guesses, edition.answer]);let moves=0;const used=new Set();
  status.textContent='You have six guesses.';
  submit.disabled=false;
  form.addEventListener('submit',event=>{
    event.preventDefault();
    if(submit.disabled)return;
    const guess=input.value.trim().toLowerCase();
    if(!allowed.has(guess)){status.textContent='That word is not in this challenge’s guess list.';return;}
    if(used.has(guess)){status.textContent='You already tried that word.';return;}
    used.add(guess);moves++;
    const pattern=scoreGuess(guess,edition.answer);
    const row=document.createElement('li'),tiles=document.createElement('span');
    tiles.className='replay-tiles';
    tiles.setAttribute('role','img');
    tiles.setAttribute('aria-label',[...guess].map((c,i)=>c.toUpperCase()+' '+colors[+pattern[i]]).join(', '));
    for(let i=0;i<5;i++){
      const tile=document.createElement('span');
      tile.className='replay-tile s'+pattern[i];
      tile.setAttribute('aria-hidden','true');
      tile.textContent=guess[i].toUpperCase();tiles.append(tile);
    }
    row.append(tiles);board.append(row);
    input.value='';
    if(pattern==='22222'||moves===6){
      submit.disabled=true;input.disabled=true;
      status.textContent=pattern==='22222'?'Solved in '+moves+' '+(moves===1?'guess.':'guesses.'):'Six guesses used. You can reveal the answer below.';
    }else{status.textContent=(6-moves)+' guesses left.';input.focus();}
  });
}).catch(()=>{status.textContent='Interactive challenge unavailable. You can still read the hints below.';});
