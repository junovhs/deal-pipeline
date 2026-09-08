import assert from 'node:assert/strict';
import { assignCandidateMatrix, parseHQ, resetIds, ingestWebsiteJSON, runFullMatch } from '../src/logic/dedupe.js';

const assign = values => assignCandidateMatrix(values.map(row => row.map(score => ({ score }))), values.length, values[0].length);
assert.deepEqual(assign([[10, 9], [0, -100]]), [[0, 0], [1, -1]], 'A bad deal must not displace a better match');
assert.deepEqual(assign([[-2, -4]]), [[0, -1]], 'All negative candidates remain unmatched');
assert.deepEqual(assign([[0]]), [[0, -1]], 'No evidence does not imply a match');
assert.deepEqual(assign([[10, 9], [9, 1]]), [[0, 1], [1, 0]], 'Keep globally optimal positive assignments');
assert.deepEqual(assign([[10], [1]]), [[0, 0], [1, -1]], 'One website deal cannot be assigned twice');

function match(source, titles, expiryDate = null) {
  resetIds();
  return runFullMatch(parseHQ(`v\tNorwegian Cruise Line\nd\t${source}`), ingestWebsiteJSON(titles.map(title => ({ shopOverline: 'Norwegian Cruise Line', title, expiryDate })) ))[0];
}
const source = 'Free Gratuities for 2 + $100 OBC ends 06/15/26';
const tied = match(source, ['Free Gratuities for 2 + $100 OBC', 'Free Gratuities for 2 + $100 OBC'], '2026-06-15T07:00:00Z');
assert.ok(tied.meta.score >= 18);
assert.equal(tied.meta.ambiguous, true);
assert.equal(tied.meta.confidence, 'review');
assert.equal(tied.meta.candidateMargin, 0);
const clear = match(source, ['Free Gratuities for 2 + $100 OBC', 'Save 10% on excursions'], '2026-06-15T07:00:00Z');
assert.equal(clear.meta.ambiguous, false);
assert.equal(clear.meta.confidence, 'strong');

const numericStage = (source, title) => {
  const result = match(source, [title]);
  // Rejected pair evidence remains inspectable in the candidate rankings.
  return result.web ? result.meta : result.meta.candidateRankings[0];
};
const conflict = numericStage('Get $100 onboard credit and save $500', 'Get $100 onboard credit and save $200');
assert.ok(conflict.why.some(item => item.text.includes('terms differ')) || match('Get $100 onboard credit and save $500', ['Get $100 onboard credit and save $200']).meta.numbersMismatch);
const partial = match('Get $100 onboard credit and save $500', ['Get $100 onboard credit and save $500', 'Get $100 onboard credit and save $200']);
assert.equal(partial.web.raw.title, 'Get $100 onboard credit and save $500');
assert.ok(partial.meta.candidateRankings[0].score > partial.meta.candidateRankings[1].score);
const repeated = match('Get $100 onboard credit', ['Get $100 onboard credit. Enjoy your $100 onboard credit.']);
assert.equal(repeated.meta.numbersMismatch, false, 'Repeated mentions of one amount are not a mismatch');
const percent = match('Save 20% and get 10% onboard credit', ['Save 20% and get 10% onboard credit', 'Save 20% and get 5% onboard credit']);
assert.equal(percent.web.raw.title, 'Save 20% and get 10% onboard credit');
assert.ok(percent.meta.candidateRankings[0].score > percent.meta.candidateRankings[1].score);
console.log('Assignment, complete numeric comparisons, and ambiguity regression tests: PASS');
