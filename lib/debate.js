// Debate analysis: turns a set of formalized arguments into the signals that
// steer a discussion toward substance — which arguments actually follow, where
// a side contradicts itself, and which propositions the whole disagreement
// hinges on (cruxes).

import {
  parse, show, entails, satisfiable, unsatCore, loadBearing, leanTheorem, toLeanProp, atomsOf, atomOrder,
} from './logic.js';

export const MOTION_ATOM = 'M';
const ATOM_RE = /^(M|P\d+)$/;

/**
 * Debate shape (all plain JSON so it can live in the browser or a database):
 * {
 *   motion: string,                       // the question being debated; atom M
 *   propositions: [{ id: 'P1', text, agree: 0, disagree: 0 }],
 *   arguments: [{ id: 'A1', side: 'pro'|'con'|'other', author, text,
 *                 premises: ['P1 -> M', 'P1'], conclusion: 'M' }],
 * }
 */
export function analyzeDebate(debate) {
  const propIndex = new Map((debate.propositions ?? []).map((p) => [p.id, p]));
  const known = (name) => name === MOTION_ATOM || propIndex.has(name);

  const args = [];
  for (const arg of debate.arguments ?? []) {
    const result = {
      id: arg.id, side: arg.side, errors: [],
      premises: [], conclusion: null,
      valid: null, vacuous: false, counterexample: null, loadBearing: [],
    };
    try {
      const premiseAsts = (arg.premises ?? []).map(parse);
      const conclusionAst = parse(arg.conclusion);
      const atoms = new Set();
      [...premiseAsts, conclusionAst].forEach((a) => atomsOf(a, atoms));
      for (const a of atoms) {
        if (!ATOM_RE.test(a)) result.errors.push(`"${a}" is not a valid proposition id (use M or P<n>)`);
        else if (!known(a)) result.errors.push(`Unknown proposition ${a}`);
      }
      result.premises = premiseAsts.map(show);
      result.conclusion = show(conclusionAst);
      result._premiseAsts = premiseAsts;
      result._conclusionAst = conclusionAst;
      if (!result.errors.length) {
        const e = entails(premiseAsts, conclusionAst);
        result.valid = e.valid;
        result.counterexample = e.counterexample;
        result.loadBearing = loadBearing(premiseAsts, conclusionAst);
        // Premises that contradict each other "prove" anything. Flag it so the
        // argument isn't mistaken for a sound one.
        result.vacuous = premiseAsts.length > 0 && !satisfiable(premiseAsts).sat;
      }
    } catch (err) {
      result.errors.push(err.message);
    }
    args.push(result);
  }

  // ---- contradictions: does a side's combined set of premises contradict itself?
  const contradictions = [];
  for (const side of ['pro', 'con']) {
    const pool = []; // { ast, argId, premiseIndex }
    for (const a of args) {
      if (a.side !== side || a.errors.length || !a._premiseAsts) continue;
      a._premiseAsts.forEach((ast, i) => pool.push({ ast, argId: a.id, premiseIndex: i }));
    }
    if (!pool.length) continue;
    try {
      const core = unsatCore(pool.map((p) => p.ast));
      if (core) {
        contradictions.push({
          side,
          members: core.map((i) => ({
            argId: pool[i].argId,
            premiseIndex: pool[i].premiseIndex,
            formula: show(pool[i].ast),
          })),
          _asts: core.map((i) => pool[i].ast),
        });
      }
    } catch (err) {
      contradictions.push({ side, error: err.message, members: [] });
    }
  }

  // ---- cruxes: propositions that valid arguments on both sides depend on,
  // weighted by how split participants are on them.
  const usage = new Map(); // atom -> { pro: Set(argId), con: Set(argId) }
  for (const a of args) {
    if (!a.valid || a.vacuous || (a.side !== 'pro' && a.side !== 'con')) continue;
    for (const i of a.loadBearing) {
      for (const atom of atomsOf(a._premiseAsts[i])) {
        if (atom === MOTION_ATOM) continue;
        if (!usage.has(atom)) usage.set(atom, { pro: new Set(), con: new Set() });
        usage.get(atom)[a.side].add(a.id);
      }
    }
  }
  const cruxes = [];
  for (const [atom, u] of usage) {
    const p = propIndex.get(atom) ?? {};
    const agree = p.agree ?? 0;
    const disagree = p.disagree ?? 0;
    const votes = agree + disagree;
    const controversy = votes ? (2 * Math.min(agree, disagree)) / votes : 0; // 0 = consensus, 1 = even split
    const bothSides = u.pro.size > 0 && u.con.size > 0;
    if (!bothSides && controversy < 0.4) continue;
    const reliance = u.pro.size + u.con.size;
    cruxes.push({
      id: atom,
      text: p.text ?? '',
      proArgs: [...u.pro], conArgs: [...u.con],
      agree, disagree,
      controversy: Number(controversy.toFixed(2)),
      score: Number((reliance * (bothSides ? 2 : 1) * (1 + controversy)).toFixed(2)),
    });
  }
  cruxes.sort((x, y) => y.score - x.score || atomOrder(x.id, y.id));

  // ---- gaps: invalid arguments, with the situation that defeats them.
  const gaps = args
    .filter((a) => a.valid === false)
    .map((a) => ({
      argId: a.id,
      counterexample: describeAssignment(a.counterexample, propIndex, debate.motion),
    }));

  const lean = buildLean(debate, args, contradictions);

  const valid = args.filter((a) => a.valid && !a.vacuous).length;
  const stats = {
    arguments: args.length,
    valid,
    invalid: args.filter((a) => a.valid === false).length,
    vacuous: args.filter((a) => a.vacuous).length,
    malformed: args.filter((a) => a.errors.length).length,
    pro: args.filter((a) => a.side === 'pro').length,
    con: args.filter((a) => a.side === 'con').length,
    contradictions: contradictions.filter((c) => !c.error).length,
    cruxes: cruxes.length,
    // A rough "is this discussion going anywhere" signal: valid, balanced,
    // consistent arguments that engage with shared cruxes.
    rigor: args.length ? Math.round((100 * valid) / args.length) : 0,
  };

  for (const a of args) { delete a._premiseAsts; delete a._conclusionAst; }
  for (const c of contradictions) delete c._asts;

  return { arguments: args, contradictions, cruxes, gaps, stats, lean };
}

function describeAssignment(env, propIndex, motion) {
  if (!env) return [];
  return Object.keys(env).sort(atomOrder).map((id) => ({
    id,
    value: env[id],
    text: id === MOTION_ATOM ? motion : propIndex.get(id)?.text ?? '',
  }));
}

/** One Lean 4 file certifying every claim the analysis makes. */
function buildLean(debate, args, contradictions) {
  const out = [];
  out.push('/-');
  out.push(`  Agora debate certificate`);
  out.push(`  Motion (M): ${sanitizeComment(debate.motion ?? '')}`);
  for (const p of debate.propositions ?? []) out.push(`  ${p.id}: ${sanitizeComment(p.text)}`);
  out.push('');
  out.push('  Each proposition is modelled as a Bool. A theorem `∀ atoms, h₁ → … → goal`');
  out.push('  proved by case analysis + `decide` means the conclusion follows from the');
  out.push('  premises in every possible world. Checked by the Lean 4 kernel; no Mathlib.');
  out.push('-/');
  out.push('');
  out.push('namespace Agora');
  out.push('');
  const theorems = [];
  for (const a of args) {
    if (!a.valid || !a._premiseAsts) continue;
    const name = `${a.id}_valid`;
    const readable = `${a._premiseAsts.map(toLeanProp).join(', ') || '∅'} ⊢ ${toLeanProp(a._conclusionAst)}`;
    out.push(leanTheorem(name, a._premiseAsts, a._conclusionAst, `${a.id} (${a.side}): ${readable}`));
    out.push('');
    theorems.push({ name, kind: 'valid', argId: a.id });
  }
  contradictions.forEach((c, i) => {
    if (!c._asts) return;
    const name = `${c.side}_inconsistent_${i + 1}`;
    out.push(leanTheorem(name, c._asts, null, `The ${c.side} side's premises ${c.members.map((m) => m.formula).join(', ')} are jointly contradictory.`));
    out.push('');
    theorems.push({ name, kind: 'contradiction', side: c.side });
  });
  out.push('end Agora');
  return { source: out.join('\n') + '\n', theorems };
}

function sanitizeComment(s) {
  return String(s).replace(/-\//g, '- /').replace(/\/-/g, '/ -').replace(/\s+/g, ' ').trim();
}
