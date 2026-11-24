// Shared helpers for the serverless handlers.
const MAX_BODY_ARGS = 200;
const MAX_PROPS = 200;

export function handle(fn) {
  return async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {});
      const result = await fn(body);
      res.status(200).json(result);
    } catch (err) {
      const status = err.status ?? (err instanceof SyntaxError || err instanceof RangeError ? 400 : 500);
      if (status >= 500) console.error(err);
      res.status(status).json({ error: err.message });
    }
  };
}

export function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

/** Validate and normalize a debate payload from the client. */
export function readDebate(body) {
  const d = body?.debate;
  if (!d || typeof d !== 'object') throw badRequest('debate is required');
  if (typeof d.motion !== 'string' || !d.motion.trim()) throw badRequest('debate.motion is required');
  const propositions = Array.isArray(d.propositions) ? d.propositions : [];
  const args = Array.isArray(d.arguments) ? d.arguments : [];
  if (propositions.length > MAX_PROPS || args.length > MAX_BODY_ARGS) throw badRequest('debate is too large');
  return {
    motion: d.motion.slice(0, 500),
    propositions: propositions.map((p) => ({
      id: String(p.id), text: String(p.text ?? '').slice(0, 500),
      agree: Number(p.agree) || 0, disagree: Number(p.disagree) || 0,
    })),
    arguments: args.map((a) => ({
      id: String(a.id), side: ['pro', 'con', 'other'].includes(a.side) ? a.side : 'other',
      author: String(a.author ?? '').slice(0, 60), text: String(a.text ?? '').slice(0, 4000),
      premises: Array.isArray(a.premises) ? a.premises.slice(0, 12).map(String) : [],
      conclusion: String(a.conclusion ?? ''),
    })),
  };
}
