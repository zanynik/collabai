// The two AI roles in Agora.
//
//  Formalizer  — turns a participant's natural-language argument into
//                premises ⊢ conclusion over the debate's shared propositions,
//                reusing existing propositions so different people's claims
//                land on the same atoms (that's what makes cruxes detectable).
//  Facilitator — reads the machine-checked analysis and writes the next few
//                questions that would most move the discussion forward.
//
// The AI never decides what is *valid*; the logic engine / Lean does. The AI
// translates and asks questions.

import { z } from 'zod';
import { structured } from './llm.js';
import { parse, atomsOf } from './logic.js';

const FormalizationSchema = z.object({
  new_propositions: z.array(z.object({
    key: z.string().describe('Temporary id N1, N2, … used in the formulas below'),
    text: z.string().describe('One atomic, declarative, checkable claim. No connectives.'),
  })),
  premises: z.array(z.string()).describe('Formulas over M, existing P-ids and new N-ids'),
  conclusion: z.string(),
  side: z.enum(['pro', 'con', 'other']),
  restatement: z.string().describe("A faithful one-sentence restatement of the argument's logic"),
  notes: z.string().describe('Anything ambiguous or implicit you had to interpret; empty if none'),
});

const FORMALIZER_SYSTEM = `You are the Formalizer in Agora, a debate platform where every argument is checked by a theorem prover.

Translate the participant's argument into propositional logic so the prover can check whether it actually follows.

Vocabulary:
- M is the motion under debate. Pro arguments usually conclude M, con arguments conclude !M.
- P1, P2, … are existing shared propositions (listed in the request). REUSE them whenever the participant means the same claim, even if worded differently. Reuse is the most important thing you do: it lets the system see where people actually disagree.
- If a genuinely new claim is needed, add it to new_propositions with key N1, N2, … and use that key in formulas.
- If the participant asserts the negation of an existing proposition, write !P<n> — do not create a new negated proposition.

Syntax: ! (not), & (and), | (or), -> (implies), <-> (iff), parentheses.

Rules:
- Be faithful, not charitable. Formalize what was argued, including its gaps. If they assert "A, therefore M" without saying A leads to M, the premises are just [A] and the conclusion M — the prover will expose the gap. Do NOT silently add the missing bridge premise.
- Do state premises they clearly rely on in their wording ("since X leads to Y…" → X -> Y).
- New propositions must be atomic declarative claims someone could agree or disagree with.
- Keep it small: usually 1–4 premises.`;

/** Formalize one natural-language argument against the debate's vocabulary. */
export async function formalizeArgument(debate, { text, side, author }) {
  const vocab = (debate.propositions ?? []).map((p) => `${p.id}: ${p.text}`).join('\n') || '(none yet)';
  const prompt = `Motion (M): ${debate.motion}

Existing propositions:
${vocab}

Participant${author ? ` (${author})` : ''} says they are arguing: ${side || 'unspecified'}

Argument:
"""
${text}
"""`;

  const out = await structured({ system: FORMALIZER_SYSTEM, prompt, schema: FormalizationSchema, effort: 'medium' });
  return materialize(debate, out);
}

/** Replace N-keys with fresh P-ids and validate every formula parses. */
export function materialize(debate, out) {
  const existing = new Set((debate.propositions ?? []).map((p) => p.id));
  let next = 1 + Math.max(0, ...[...existing].map((id) => Number(id.slice(1)) || 0));
  const mapping = {};
  const newProps = [];
  for (const np of out.new_propositions) {
    if (!/^N\d+$/.test(np.key) || mapping[np.key]) continue;
    const id = `P${next++}`;
    mapping[np.key] = id;
    newProps.push({ id, text: np.text.trim(), agree: 0, disagree: 0 });
  }
  const rename = (f) => f.replace(/\bN\d+\b/g, (k) => mapping[k] ?? k);
  const premises = out.premises.map(rename);
  const conclusion = rename(out.conclusion);

  const allowed = new Set(['M', ...existing, ...newProps.map((p) => p.id)]);
  for (const f of [...premises, conclusion]) {
    const ast = parse(f); // throws SyntaxError on garbage
    for (const atom of atomsOf(ast)) {
      if (!allowed.has(atom)) throw new SyntaxError(`Formalizer used unknown proposition ${atom}`);
    }
  }
  return {
    newPropositions: newProps,
    argument: { side: out.side, premises, conclusion },
    restatement: out.restatement,
    notes: out.notes,
  };
}

const FacilitationSchema = z.object({
  synthesis: z.string().describe('2–4 sentences: where the debate actually stands, neutrally.'),
  prompts: z.array(z.object({
    kind: z.enum(['crux', 'gap', 'contradiction', 'steelman', 'evidence', 'new_angle']),
    target: z.string().describe('The P-id, A-id or side this is about'),
    audience: z.enum(['pro', 'con', 'everyone']),
    question: z.string().describe('The question to put to participants. Short, concrete, answerable.'),
    why: z.string().describe('One sentence: why answering this moves the debate, citing the analysis.'),
  })).max(5),
});

const FACILITATOR_SYSTEM = `You are the Facilitator in Agora. A theorem prover has already checked every argument in the debate; you receive its verdicts. Your job is to make the next round of discussion more meaningful than the last.

What the analysis means:
- valid: the conclusion follows from the premises in every possible world (machine-checked). Valid arguments can only be defeated by attacking a load-bearing premise.
- invalid + counterexample: there is a consistent situation where all premises hold and the conclusion fails. That's a gap; ask the author to supply the missing premise (and then everyone can debate whether it's true).
- vacuous: the premises contradict each other, so the argument proves nothing.
- contradiction: a side's combined premises can't all be true. They need to drop one.
- crux: a proposition that load-bearing premises on BOTH sides depend on, or that participants are split on. Resolving a crux changes minds; everything else is noise.

Write at most 5 prompts, highest leverage first. Prefer: top cruxes (ask for evidence or a test that would settle it), then gaps, then contradictions. Use steelman prompts when one side is thin. Never declare a winner. Refer to propositions by their text, with the id in brackets.`;

export async function facilitate(debate, analysis) {
  const props = (debate.propositions ?? [])
    .map((p) => `${p.id}: ${p.text} [agree ${p.agree ?? 0} / disagree ${p.disagree ?? 0}]`).join('\n');
  const args = analysis.arguments.map((a) => {
    const src = debate.arguments.find((x) => x.id === a.id) ?? {};
    const status = a.errors.length ? `malformed (${a.errors.join('; ')})`
      : a.vacuous ? 'VACUOUS (premises contradict)'
      : a.valid ? `VALID; load-bearing premises: ${a.loadBearing.map((i) => a.premises[i]).join(', ') || 'none'}`
      : 'INVALID';
    return `${a.id} [${a.side}] by ${src.author || 'anon'}: "${src.text ?? ''}"\n   ${a.premises.join(', ')} ⊢ ${a.conclusion}  → ${status}`;
  }).join('\n');
  const gaps = analysis.gaps.map((g) => `${g.argId}: fails when ${g.counterexample.map((c) => `${c.id}=${c.value}`).join(', ')}`).join('\n') || 'none';
  const contra = analysis.contradictions.map((c) => `${c.side}: ${c.members.map((m) => `${m.formula} (${m.argId})`).join(', ')}`).join('\n') || 'none';
  const cruxes = analysis.cruxes.map((c) => `${c.id} score ${c.score}: pro relies via ${c.proArgs.join(',') || '-'}, con via ${c.conArgs.join(',') || '-'}, controversy ${c.controversy}`).join('\n') || 'none';

  const prompt = `Motion (M): ${debate.motion}

Propositions:
${props || '(none)'}

Arguments:
${args || '(none)'}

Gaps (counterexamples):
${gaps}

Contradictions:
${contra}

Cruxes:
${cruxes}`;

  return structured({ system: FACILITATOR_SYSTEM, prompt, schema: FacilitationSchema, effort: 'medium' });
}
