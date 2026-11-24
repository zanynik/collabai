import { handle, readDebate, badRequest } from '../lib/http.js';
import { formalizeArgument } from '../lib/agents.js';

// AI: natural-language argument → premises ⊢ conclusion over shared propositions.
// Returns a proposal; the client shows it to the author to confirm or edit.
export default handle(async (body) => {
  const debate = readDebate(body);
  const text = String(body.text ?? '').trim();
  if (!text) throw badRequest('text is required');
  if (text.length > 4000) throw badRequest('argument is too long (max 4000 chars)');
  return formalizeArgument(debate, { text, side: body.side, author: String(body.author ?? '').slice(0, 60) });
});
