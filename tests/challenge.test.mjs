import test from 'node:test';
import assert from 'node:assert/strict';
import {bank,challengeThrough,dateInZone,dayNumber} from '../scripts/challenge.mjs';
test('original edition schedule uses New York day and rejects the future',()=>{
  const before=new Date('2026-11-19T04:59:59Z'),after=new Date('2026-11-19T05:00:00Z');
  assert.equal(dateInZone(before),'2026-11-18');
  assert.equal(dateInZone(after),'2026-11-19');
  assert.throws(()=>challengeThrough('2026-11-19',before),/future/);
  assert.equal(challengeThrough('2026-11-18',before).length,0);
  assert.equal(challengeThrough('2026-11-19',after).length,1);
});
test('published editions remain stable and unique through the bank cycle',()=>{
  const now=new Date('2031-01-01'), rows=challengeThrough('2030-01-01',now);
  assert.equal(new Set(rows.slice(0,bank.length).map(r=>r.answer)).size,bank.length);
  assert.deepEqual(challengeThrough('2026-11-19',now),rows.slice(0,1));
  assert.equal(rows[bank.length].answer,rows[0].answer);
});
test('strict dates reject impossible or ambiguous days',()=>{
  for(const value of ['2026-2-1','2026-02-30','x','2026-14-19']) assert.throws(()=>dayNumber(value));
});
