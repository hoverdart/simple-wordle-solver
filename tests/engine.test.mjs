import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreGuess, filterCandidates, rankGuesses, solve, evaluate} from '../engine.mjs';

test('scoring is exact, normalized, and counts duplicate copies', () => {
  assert.equal(scoreGuess('APPLE', 'apple'), '22222');
  assert.equal(scoreGuess('allee', 'apple'), '21002');
  assert.equal(scoreGuess('eerie', 'serve'), '02202');
  assert.equal(scoreGuess('aaaaa', 'cacao'), '02020');
  assert.equal(scoreGuess('llama', 'apple'), '10100');
});
test('greens consume available copies before yellows', () => {
  assert.equal(scoreGuess('aabcd', 'eafgh'), '02000');
});
test('cumulative feedback is replayed, not flattened into letter bans', () => {
  const pool = ['apple', 'ample', 'apply', 'addle'];
  const history = [{guess:'allee',pattern:scoreGuess('allee','apple')}, {guess:'ample',pattern:scoreGuess('ample','apple')}];
  assert.deepEqual(filterCandidates(pool,history),['apple']);
  assert.deepEqual(filterCandidates(pool,[{guess:'apple',pattern:'22222'},{guess:'apple',pattern:'00000'}]),[]);
  assert.deepEqual(filterCandidates(['APPLE','apple','ample']),['ample','apple']);
});
test('rank metrics and deterministic ties', () => {
  const rows = rankGuesses(['apple','ample'],['zzzzz','apple','ample']);
  assert.equal(rows[0].word,'ample');
  assert.equal(rows[0].entropy,1);
  assert.equal(rows[0].expectedRemaining,1);
  assert.equal(rows[0].worstCase,1);
  assert.equal(rows[2].entropy,0);
  assert.equal(rows[2].expectedRemaining,2);
  assert.deepEqual(rankGuesses([],['apple']),[]);
  assert.equal(rankGuesses(['apple'],['aaaaa','apple'])[0].word,'apple');
  assert.equal(rankGuesses(['apple'],['aaaaa','apple'],{preferAnswers:false})[0].word,'aaaaa');
});
test('solve does not select hidden answer or invent legal guesses', () => {
  const options={answers:['apple','ample','addle'],guesses:['apple','ample','addle','arise']};
  const a=solve('apple',options), b=solve('ample',options);
  assert.equal(a.history[0].guess,b.history[0].guess);
  assert.equal(a.solved,true);
  assert.equal(a.history.at(-1).pattern,'22222');
  assert.equal(solve('apple',{answers:['apple'],guesses:['zzzzz']}).reason,'no-allowed-guesses');
  assert.equal(solve('cacao',options).reason,'answer-not-in-corpus');
});
test('evaluation retains failures and labels conditional averages', () => {
  const result=evaluate(['apple','ample'],{maxTurns:1});
  assert.equal(result.total,2); assert.equal(result.solved,1); assert.equal(result.failed,1);
  assert.equal(result.successRate,0.5); assert.equal(result.averageGuessesSolved,1);
  assert.equal(result.results.length,2);
  assert.equal(evaluate([]).successRate,null);
  assert.equal(evaluate(['apple'],{guesses:['zzzzz'],maxTurns:1}).averageGuessesSolved,null);
});
test('bad words, feedback, limits, and illegal opener are rejected', () => {
  assert.throws(()=>scoreGuess('sixsix','apple'));
  assert.throws(()=>filterCandidates(['apple'],[{guess:'apple',pattern:'ggggg'}]));
  assert.throws(()=>rankGuesses(['apple'],['apple'],{limit:-1}));
  assert.throws(()=>solve('apple',{answers:['apple'],maxTurns:0}));
  assert.throws(()=>solve('apple',{answers:['apple'],firstGuess:'arise'}));
});
test('exhaustive binary words preserve green positions and letter multiplicity', () => {
  const corpus=Array.from({length:32},(_,n)=>n.toString(2).padStart(5,'0').replaceAll('0','a').replaceAll('1','b'));
  for(const guess of corpus) for(const answer of corpus) {
    const p=scoreGuess(guess,answer);
    for(let i=0;i<5;i++) assert.equal(p[i]==='2',guess[i]===answer[i]);
    for(const c of ['a','b']) {
      const marked=[...guess].filter((letter,i)=>letter===c && p[i]!=='0').length;
      assert.equal(marked,Math.min([...guess].filter(x=>x===c).length,[...answer].filter(x=>x===c).length));
    }
    assert.ok(filterCandidates(corpus,[{guess,pattern:p}]).includes(answer));
  }
});
