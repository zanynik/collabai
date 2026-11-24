// Propositional logic engine for Agora.
//
// Every argument in a debate is formalized as premises ⊢ conclusion over
// propositional atoms (P1, P2, … plus M for the motion). This module parses
// those formulas, decides entailment / satisfiability exactly by truth table,
// and emits Lean 4 source whose theorems are checked by the Lean kernel when a
// Lean checker is configured (see lean-server/).

export const MAX_ATOMS = 18;

// ---------------------------------------------------------------- parsing

const KEYWORDS = {
  not: 'NOT', and: 'AND', or: 'OR', implies: 'IMP', iff: 'IFF',
  true: 'TRUE', false: 'FALSE',
};

function tokenize(src) {
  const tokens = [];
  let i = 0;
  const symbols = [
    ['<->', 'IFF'], ['<=>', 'IFF'], ['↔', 'IFF'],
    ['->', 'IMP'], ['=>', 'IMP'], ['→', 'IMP'],
    ['&&', 'AND'], ['&', 'AND'], ['∧', 'AND'],
    ['||', 'OR'], ['|', 'OR'], ['∨', 'OR'],
    ['!', 'NOT'], ['~', 'NOT'], ['¬', 'NOT'],
    ['⊤', 'TRUE'], ['⊥', 'FALSE'],
    ['(', 'LP'], [')', 'RP'],
  ];
  outer: while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { i++; continue; }
    for (const [sym, type] of symbols) {
      if (src.startsWith(sym, i)) { tokens.push({ type }); i += sym.length; continue outer; }
    }
    const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i));
    if (m) {
      const word = m[0];
      const kw = KEYWORDS[word.toLowerCase()];
      tokens.push(kw ? { type: kw } : { type: 'ATOM', name: word });
      i += word.length;
      continue;
    }
    throw new SyntaxError(`Unexpected character "${ch}" at position ${i}`);
  }
  return tokens;
}

// Precedence (loosest → tightest): ↔, → (right-assoc), ∨, ∧, ¬
export function parse(src) {
  if (typeof src !== 'string' || !src.trim()) throw new SyntaxError('Empty formula');
  const tokens = tokenize(src);
  let pos = 0;
  const peek = () => tokens[pos]?.type;
  const eat = (type) => {
    if (peek() !== type) throw new SyntaxError(`Expected ${type} but found ${peek() ?? 'end of input'}`);
    return tokens[pos++];
  };
  function iff() {
    let left = imp();
    while (peek() === 'IFF') { pos++; left = { op: 'iff', a: left, b: imp() }; }
    return left;
  }
  function imp() {
    const left = or();
    if (peek() === 'IMP') { pos++; return { op: 'imp', a: left, b: imp() }; }
    return left;
  }
  function or() {
    let left = and();
    while (peek() === 'OR') { pos++; left = { op: 'or', a: left, b: and() }; }
    return left;
  }
  function and() {
    let left = unary();
    while (peek() === 'AND') { pos++; left = { op: 'and', a: left, b: unary() }; }
    return left;
  }
  function unary() {
    const t = peek();
    if (t === 'NOT') { pos++; return { op: 'not', a: unary() }; }
    if (t === 'LP') { pos++; const e = iff(); eat('RP'); return e; }
    if (t === 'TRUE') { pos++; return { op: 'const', value: true }; }
    if (t === 'FALSE') { pos++; return { op: 'const', value: false }; }
    if (t === 'ATOM') return { op: 'atom', name: tokens[pos++].name };
    throw new SyntaxError(`Unexpected ${t ?? 'end of input'}`);
  }
  const ast = iff();
  if (pos !== tokens.length) throw new SyntaxError(`Unexpected ${peek()} after complete formula`);
  return ast;
}

// ---------------------------------------------------------------- utilities

export function atomsOf(ast, out = new Set()) {
  switch (ast.op) {
    case 'atom': out.add(ast.name); break;
    case 'const': break;
    case 'not': atomsOf(ast.a, out); break;
    default: atomsOf(ast.a, out); atomsOf(ast.b, out);
  }
  return out;
}

export function evaluate(ast, env) {
  switch (ast.op) {
    case 'atom': return Boolean(env[ast.name]);
    case 'const': return ast.value;
    case 'not': return !evaluate(ast.a, env);
    case 'and': return evaluate(ast.a, env) && evaluate(ast.b, env);
    case 'or': return evaluate(ast.a, env) || evaluate(ast.b, env);
    case 'imp': return !evaluate(ast.a, env) || evaluate(ast.b, env);
    case 'iff': return evaluate(ast.a, env) === evaluate(ast.b, env);
    default: throw new Error(`Unknown op ${ast.op}`);
  }
}

const PREC = { iff: 1, imp: 2, or: 3, and: 4, not: 5, atom: 6, const: 6 };
const SYM = { iff: ' ↔ ', imp: ' → ', or: ' ∨ ', and: ' ∧ ' };

/** Pretty-print with unicode connectives and minimal parentheses. */
export function show(ast) {
  const wrap = (child, minPrec) => (PREC[child.op] < minPrec ? `(${show(child)})` : show(child));
  switch (ast.op) {
    case 'atom': return ast.name;
    case 'const': return ast.value ? '⊤' : '⊥';
    case 'not': return `¬${wrap(ast.a, PREC.not)}`;
    case 'imp': return wrap(ast.a, PREC.imp + 1) + SYM.imp + wrap(ast.b, PREC.imp);
    default: return wrap(ast.a, PREC[ast.op]) + SYM[ast.op] + wrap(ast.b, PREC[ast.op] + 1);
  }
}

function sortedAtoms(asts) {
  const s = new Set();
  for (const a of asts) atomsOf(a, s);
  return [...s].sort(atomOrder);
}

export function atomOrder(x, y) {
  // M (the motion) first, then P1 < P2 < P10 numerically, then anything else.
  const key = (n) => {
    if (n === 'M') return [0, 0, n];
    const m = /^([A-Za-z_]+)(\d+)$/.exec(n);
    return m ? [1, Number(m[2]), m[1]] : [2, 0, n];
  };
  const [a, b] = [key(x), key(y)];
  return a[0] - b[0] || a[2].localeCompare(b[2]) || a[1] - b[1];
}

function* assignments(atoms) {
  if (atoms.length > MAX_ATOMS) {
    throw new RangeError(`Too many propositions (${atoms.length}) in one check; limit is ${MAX_ATOMS}`);
  }
  const n = atoms.length;
  for (let mask = 0; mask < 2 ** n; mask++) {
    const env = {};
    for (let i = 0; i < n; i++) env[atoms[i]] = Boolean(mask & (1 << i));
    yield env;
  }
}

// ---------------------------------------------------------------- decisions

/** Is there an assignment making every formula true? */
export function satisfiable(asts) {
  const atoms = sortedAtoms(asts);
  for (const env of assignments(atoms)) {
    if (asts.every((f) => evaluate(f, env))) return { sat: true, model: env };
  }
  return { sat: false, model: null };
}

/** Do the premises entail the conclusion? Returns a counterexample if not. */
export function entails(premises, conclusion) {
  const atoms = sortedAtoms([...premises, conclusion]);
  for (const env of assignments(atoms)) {
    if (premises.every((p) => evaluate(p, env)) && !evaluate(conclusion, env)) {
      return { valid: false, counterexample: env };
    }
  }
  return { valid: true, counterexample: null };
}

/**
 * Deletion-based minimal unsatisfiable core. Returns indices into `asts` of a
 * subset that is jointly contradictory and where every member is needed.
 */
export function unsatCore(asts) {
  if (satisfiable(asts).sat) return null;
  let core = asts.map((_, i) => i);
  for (const idx of [...core]) {
    const without = core.filter((i) => i !== idx);
    if (!satisfiable(without.map((i) => asts[i])).sat) core = without;
  }
  return core;
}

/**
 * For a valid argument, which premises are load-bearing? A premise is
 * load-bearing if dropping it alone breaks the entailment. These are the
 * claims an opponent has to attack to defeat the argument.
 */
export function loadBearing(premises, conclusion) {
  if (!entails(premises, conclusion).valid) return [];
  return premises
    .map((_, i) => i)
    .filter((i) => !entails(premises.filter((_, j) => j !== i), conclusion).valid);
}

// ---------------------------------------------------------------- Lean 4

const LEAN_IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Translate to a Lean 4 Bool expression (decidable, so `decide` can close it). */
export function toLeanBool(ast) {
  switch (ast.op) {
    case 'atom':
      if (!LEAN_IDENT.test(ast.name)) throw new Error(`Bad atom name ${ast.name}`);
      return ast.name;
    case 'const': return ast.value ? 'true' : 'false';
    case 'not': return `(!${toLeanBool(ast.a)})`;
    case 'and': return `(${toLeanBool(ast.a)} && ${toLeanBool(ast.b)})`;
    case 'or': return `(${toLeanBool(ast.a)} || ${toLeanBool(ast.b)})`;
    case 'imp': return `((!${toLeanBool(ast.a)}) || ${toLeanBool(ast.b)})`;
    case 'iff': return `(${toLeanBool(ast.a)} == ${toLeanBool(ast.b)})`;
    default: throw new Error(`Unknown op ${ast.op}`);
  }
}

/** Translate to a Lean 4 Prop (for human-readable statements in comments). */
export function toLeanProp(ast) {
  switch (ast.op) {
    case 'atom': return ast.name;
    case 'const': return ast.value ? 'True' : 'False';
    case 'not': return `¬${ast.a.op === 'atom' ? toLeanProp(ast.a) : `(${toLeanProp(ast.a)})`}`;
    case 'and': return `(${toLeanProp(ast.a)} ∧ ${toLeanProp(ast.b)})`;
    case 'or': return `(${toLeanProp(ast.a)} ∨ ${toLeanProp(ast.b)})`;
    case 'imp': return `(${toLeanProp(ast.a)} → ${toLeanProp(ast.b)})`;
    case 'iff': return `(${toLeanProp(ast.a)} ↔ ${toLeanProp(ast.b)})`;
    default: throw new Error(`Unknown op ${ast.op}`);
  }
}

/**
 * A Lean theorem stating: for every truth assignment to the atoms, if every
 * hypothesis holds then the goal holds. Atoms are `Bool`s, so after case-
 * splitting each one the goal is closed and `decide` lets the kernel evaluate
 * it. No Mathlib needed; this compiles against core Lean 4.
 *
 * `goal` may be null, meaning the hypotheses entail `False` (contradiction).
 */
export function leanTheorem(name, hypotheses, goal, docComment) {
  if (!LEAN_IDENT.test(name)) throw new Error(`Bad theorem name ${name}`);
  const atoms = sortedAtoms(goal ? [...hypotheses, goal] : hypotheses);
  const lines = [];
  if (docComment) lines.push(`/-- ${docComment.replace(/-\//g, '- /').replace(/\/-/g, '/ -')} -/`);
  const binder = atoms.length ? `∀ (${atoms.join(' ')} : Bool),\n    ` : '';
  const hyps = hypotheses.map((h) => `${toLeanBool(h)} = true →\n    `).join('');
  const concl = goal ? `${toLeanBool(goal)} = true` : 'False';
  lines.push(`theorem ${name} : ${binder}${hyps}${concl} := by`);
  if (atoms.length) {
    lines.push(`  intro ${atoms.join(' ')}`);
    lines.push(`  ${atoms.map((a) => `cases ${a}`).join(' <;> ')} <;> decide`);
  } else {
    lines.push('  decide');
  }
  return lines.join('\n');
}
