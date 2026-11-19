/** Reproduce the licensed five-letter dictionary from pinned, locally downloaded Moby inputs. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const revision='b84076e29e6a4c686e36c259df5ffe10bafbdaed';
const hashes={common:'c7aa03c522e9e28bba1db692372119f21c73c646671af24b53a840e2d6f84fa7',crosswd:'b134e7aba7aaeb79bbc1db45d13ddcd0b9399b780b74fbe9a81c0949575a3ce7'};
if (process.argv.length!==4) {
  console.error('Usage: node scripts/build-lexicon.mjs /path/common.txt /path/crosswd.txt');
  process.exitCode=1;
} else {
  const lists={};
  for (const [index,name] of ['common','crosswd'].entries()) {
    const bytes=await readFile(process.argv[index+2]);
    if(createHash('sha256').update(bytes).digest('hex')!==hashes[name]) throw new Error(`Unexpected ${name} source hash. Review provenance before updating the pinned input.`);
    // Exclude uppercase proper names rather than silently turning them into guesses.
    lists[name]=[...new Set(bytes.toString('utf8').split(/\r?\n/).map(w=>w.trim()).filter(w=>/^[a-z]{5}$/.test(w)))].sort();
  }
  const output={schemaVersion:1,answers:lists.common,guesses:[...new Set([...lists.common,...lists.crosswd])].sort(),officialAnswerList:false,
    source:{name:'Grady Ward, Moby Words II',url:'https://www.gutenberg.org/files/3201/3201-h/3201-h.htm',license:'Public domain (author grant; USA)',
      mirror:'https://github.com/fordsfords/moby_words_2',revision,inputSha256:hashes},
    description:'Candidates from common dictionary words; guesses additionally include crossword words. Not the NYT solution or accepted-guess lists. Rare or outdated vocabulary may occur.'};
  await writeFile(fileURLToPath(new URL('../data/words.json',import.meta.url)),JSON.stringify(output,null,2)+'\n');
  console.log(`${output.answers.length} candidates; ${output.guesses.length} guesses`);
}
