import {readFile,writeFile} from 'node:fs/promises';
import {challengeThrough,dateInZone} from './challenge.mjs';
const date=dateInZone();
challengeThrough(date);
const file=new URL('../data/challenge-published.json',import.meta.url);
let previous;
try { previous=JSON.parse(await readFile(file,'utf8')).through; } catch(error) { if(error.code!=='ENOENT') throw error; }
if(previous && previous>date) throw new Error('Refusing to move an existing release backwards');
await writeFile(file, JSON.stringify({through:date},null,2)+'\n');
console.log('Challenge archive through '+date);
