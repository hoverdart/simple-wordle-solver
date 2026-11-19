# Data provenance and limitations

## Solver dictionary: `words.json`

Grady Ward's **Moby Words II**, public-domain material by author grant. Primary documentation:
https://www.gutenberg.org/files/3201/3201-h/3201-h.htm
Catalog: https://www.gutenberg.org/ebooks/3201

The catalog identifies public-domain status in the USA. Check applicable law elsewhere. We redistribute only the word data and our metadata, not the Gutenberg-branded ebook. Credit is retained here. No NYT word list was copied.

Gutenberg downloads returned HTTP 503 during preparation. The documented verbatim mirror was used:
https://github.com/fordsfords/moby_words_2
Revision: `b84076e29e6a4c686e36c259df5ffe10bafbdaed`.

Pinned source URLs:
- https://raw.githubusercontent.com/fordsfords/moby_words_2/b84076e29e6a4c686e36c259df5ffe10bafbdaed/common.txt
- https://raw.githubusercontent.com/fordsfords/moby_words_2/b84076e29e6a4c686e36c259df5ffe10bafbdaed/crosswd.txt

Input SHA-256 values are recorded in `words.json` and checked by:

```sh
node scripts/build-lexicon.mjs /path/common.txt /path/crosswd.txt
```

The build uses only lowercase ASCII five-letter input lines, deduplicated and sorted. Candidates: 4,060 common-dictionary words. Guesses: 8,353 common/crossword words. These are **not** the official Wordle answer pool or accepted-guess list. Neither completeness nor acceptance by NYT is claimed. The historic dictionary includes rare/dated vocabulary; do not use the whole list as a family-friendly daily puzzle pool without editorial review.

The legacy `api/words2.txt` is not used by this dataset. DWYL's repository carries an Unlicense but also notes upstream Infochimps copyright, so it was not used as the new dataset's provenance.

## Published Wordle facts: `daily.json`

This is a distinct, initially empty archive of permitted **already published** facts, not generated practice puzzles. No historical coverage is claimed. Empty coverage has null dates and count zero. A nonempty archive states its actual earliest/latest dates, count, and `complete: false` (there may be gaps).

NYT requests tested on 2026-11-19 returned an HTML “Site Unavailable” response, including for the JSON endpoint; HTTP 200 did not establish data availability. The edition schema/date semantics could therefore not be independently verified. Do not use this response as a JSON cache. NYT's terms/robots notices indicate automated collection and redistributed archives require permission. No automated NYT scraper, credentials, CAPTCHA workaround, alternate-agent bypass, or unlicensed mirror is included.

Review current source terms before acquisition:
https://help.nytimes.com/hc/en-us/articles/115014893428-Terms-of-Service
https://www.nytimes.com/robots.txt

`node scripts/sync-daily.mjs` **only validates the local cache**, with no network call. It does not acquire today's answer. This lets the rest of the site build offline without pretending a source updated. To import separately permission-cleared records:

```sh
node scripts/sync-daily.mjs --import /path/permitted-records.json
```

Input shape (illustrative, not a real answer):

```json
{
  "source": {
    "url": "https://example.com/published-record",
    "rights": "permission-granted",
    "evidenceUrl": "https://example.com/permission"
  },
  "editions": [{"date": "2021-06-19", "answer": "abcde", "id": 0}]
}
```

Allowed provenance declarations are `public-domain`, `CC0-1.0`, `permission-granted`, or `manual-public-fact` (maximum seven records per import). A declaration is not a legal authorization or proof of source accuracy: the operator must actually verify the publication and permission before importing. Never use this field to re-label copied bulk archives. Preserve the primary source URL and rights evidence. Do not import private URLs or secrets.

Dates are validated against the current **America/New_York** calendar day, including DST. Future dates fail closed; no upcoming answers are requested, inferred, or bundled. This cutoff is the site's conservative edition policy, not a claim that the unavailable NYT endpoint itself uses that timezone. Conflicting answers for an existing date are rejected and must be investigated, not silently overwritten. Failed imports preserve the previous cache. Source ID is explicit or null, never calculated from dates. A cache outage is not proof of a new answer: display the exact cached date.

Original daily practice puzzles, if generated elsewhere, must stay separately named and labeled **not NYT Wordle**; never merge them into `daily.json`.
