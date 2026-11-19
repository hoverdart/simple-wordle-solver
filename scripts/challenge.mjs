import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

export const zone = 'America/New_York';
export const launch = '2026-11-19';
export function dateInZone(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {timeZone:zone, year:'numeric', month:'2-digit', day:'2-digit'}).format(now);
}
export function dayNumber(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Expected YYYY-MM-DD');
  const value = new Date(date+'T00:00:00.000Z');
  if (!Number.isFinite(+value) || value.toISOString().slice(0,10) !== date) throw new Error('Invalid calendar date');
  return +value / 86400000;
}
export const bank = Object.freeze(readFileSync(new URL('../data/challenge-bank.txt', import.meta.url),'utf8').trim().split(/\s+/));
if (bank.length < 100 || new Set(bank).size !== bank.length || bank.some(w=>!(/^[a-z]{5}$/.test(w)))) throw new Error('Invalid challenge bank');
const ordered = Object.freeze(bank.map(answer=>({answer, hash:createHash('sha256').update('simple-word-puzzle-v1:'+answer).digest('hex')}))
  .sort((a,b)=>a.hash.localeCompare(b.hash)).map(row=>row.answer));
export function challengeThrough(date, now = new Date()) {
  const end=dayNumber(date), start=dayNumber(launch);
  if (end>dayNumber(dateInZone(now))) throw new Error('Refusing to publish future editions');
  return Array.from({length:Math.max(0,end-start+1)},(_,i)=>({
    date:new Date((start+i)*86400000).toISOString().slice(0,10), id:i+1, answer:ordered[i%ordered.length]
  }));
}
