/** Pure Wordle engine. Uniform prior over supplied candidates; not an NYT oracle.
 * Patterns are five digits: 0 absent, 1 misplaced, 2 exact.
 */
export function normalizeWord(word) {
  if (typeof word !== 'string' || !/^[a-z]{5}$/i.test(word.trim())) {
    throw new TypeError('Words must contain exactly five ASCII letters.');
  }
  return word.trim().toLowerCase();
}
function words(input) {
  if (!Array.isArray(input)) throw new TypeError('Expected a word array.');
  return [...new Set(input.map(normalizeWord))].sort();
}
function pattern(value) {
  if (typeof value !== 'string' || !/^[012]{5}$/.test(value)) {
    throw new TypeError('Feedback must be five digits using 0, 1, and 2.');
  }
  return value;
}
// Green positions consume copies first; yellow copies are consumed left to right.
function score(guess, answer) {
  const result = [0, 0, 0, 0, 0];
  const remaining = {};
  for (let i = 0; i < 5; i++) {
    if (guess[i] === answer[i]) result[i] = 2;
    else remaining[answer[i]] = (remaining[answer[i]] || 0) + 1;
  }
  for (let i = 0; i < 5; i++) {
    if (!result[i] && remaining[guess[i]] > 0) {
      result[i] = 1;
      remaining[guess[i]]--;
    }
  }
  return result.join('');
}
export function scoreGuess(guess, answer) {
  return score(normalizeWord(guess), normalizeWord(answer));
}
export function filterCandidates(candidates, history = []) {
  if (!Array.isArray(history)) throw new TypeError('History must be an array.');
  const rows = history.map(row => ({guess: normalizeWord(row.guess), pattern: pattern(row.pattern)}));
  return words(candidates).filter(answer => rows.every(row => score(row.guess, answer) === row.pattern));
}
/** Exact one-step entropy, not a proof of minimum total guesses.
 * Candidate preference breaks entropy ties only. Allowed guesses are never expanded.
 */
export function rankGuesses(candidates, allowedGuesses = candidates, {limit = 10, preferAnswers = true} = {}) {
  if (!Number.isInteger(limit) || limit < 0) throw new RangeError('limit must be a nonnegative integer.');
  const answers = words(candidates), guesses = words(allowedGuesses);
  if (!answers.length || !limit) return [];
  const candidateSet = new Set(answers), n = answers.length;
  return guesses.map(word => {
    const buckets = new Map();
    for (const answer of answers) {
      const key = score(word, answer);
      buckets.set(key, (buckets.get(key) || 0) + 1);
    }
    let entropy = 0, expectedRemaining = 0, worstCase = 0;
    for (const size of buckets.values()) {
      entropy -= size / n * Math.log2(size / n);
      expectedRemaining += size * size / n;
      worstCase = Math.max(worstCase, size);
    }
    return {word, entropy, expectedRemaining, worstCase, isCandidate: candidateSet.has(word)};
  }).sort((a, b) => b.entropy - a.entropy ||
    (preferAnswers ? Number(b.isCandidate) - Number(a.isCandidate) : 0) ||
    a.expectedRemaining - b.expectedRemaining || (a.word < b.word ? -1 : a.word > b.word ? 1 : 0)).slice(0, limit);
}
function runSolve(answer, answers, guesses, firstGuess, maxTurns, cache) {
  let remaining = answers;
  const history = [], used = new Set();
  if (!answers.includes(answer)) return {answer, solved:false, turns:0, history, remaining, reason:'answer-not-in-corpus'};
  for (let turn = 0; turn < maxTurns; turn++) {
    let guess = turn === 0 ? firstGuess : undefined;
    if (!guess) {
      const allowed = guesses.filter(word => !used.has(word));
      const key = JSON.stringify([remaining, [...used].sort()]);
      guess = cache.get(key);
      if (!guess) {
        guess = rankGuesses(remaining, allowed, {limit:1})[0]?.word;
        if (guess) cache.set(key, guess);
      }
    }
    if (!guess) return {answer, solved:false, turns:history.length, history, remaining, reason:'no-allowed-guesses'};
    const feedback = score(guess, answer);
    used.add(guess);
    remaining = remaining.filter(candidate => score(guess, candidate) === feedback);
    history.push({guess, pattern:feedback, remaining:remaining.length});
    if (feedback === '22222') return {answer, solved:true, turns:history.length, history, remaining, reason:'solved'};
  }
  return {answer, solved:false, turns:history.length, history, remaining, reason:'turn-limit'};
}
function settings(options) {
  const answers = words(options.answers), guesses = words(options.guesses ?? answers);
  const firstGuess = options.firstGuess == null ? undefined : normalizeWord(options.firstGuess);
  const maxTurns = options.maxTurns ?? 6;
  if (!Number.isInteger(maxTurns) || maxTurns < 1) throw new RangeError('maxTurns must be a positive integer.');
  if (firstGuess && !guesses.includes(firstGuess)) throw new RangeError('firstGuess must belong to allowed guesses.');
  return {answers, guesses, firstGuess, maxTurns};
}
export function solve(answer, options = {}) {
  const s = settings(options);
  return runSolve(normalizeWord(answer), s.answers, s.guesses, s.firstGuess, s.maxTurns, new Map());
}
/** Evaluates every supplied target, retaining failures. Corpus membership is not
 * inferred from the target. Empty or all-failure averages are null, not zero.
 */
export function evaluate(targets, options = {}) {
  const corpus = words(targets), s = settings({...options, answers:options.answers ?? corpus});
  const cache = new Map();
  const results = corpus.map(answer => runSolve(answer, s.answers, s.guesses, s.firstGuess, s.maxTurns, cache));
  const wins = results.filter(result => result.solved);
  return {total:results.length, solved:wins.length, failed:results.length-wins.length,
    successRate:results.length ? wins.length/results.length : null,
    averageGuessesSolved:wins.length ? wins.reduce((sum, result) => sum+result.turns,0)/wins.length : null,
    results};
}
