import { handle, readDebate } from '../lib/http.js';
import { analyzeDebate } from '../lib/debate.js';
import { checkWithLean } from '../lib/lean.js';

// Deterministic: no AI involved. Checks every argument and finds gaps,
// contradictions and cruxes; optionally has Lean 4 certify the results.
export default handle(async (body) => {
  const debate = readDebate(body);
  const analysis = analyzeDebate(debate);
  analysis.verification = body.verify === false
    ? { checker: 'truth-table', kernelChecked: false }
    : await checkWithLean(analysis.lean.source);
  return analysis;
});
