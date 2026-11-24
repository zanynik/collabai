import { handle, readDebate } from '../lib/http.js';
import { analyzeDebate } from '../lib/debate.js';
import { facilitate } from '../lib/agents.js';

// AI: given the machine-checked analysis, propose the next questions that
// would most move the discussion (cruxes first, then gaps, contradictions…).
export default handle(async (body) => {
  const debate = readDebate(body);
  const analysis = analyzeDebate(debate);
  return facilitate(debate, analysis);
});
