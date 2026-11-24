import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse, show, entails, satisfiable, unsatCore, loadBearing, leanTheorem } from '../lib/logic.js';
import { analyzeDebate } from '../lib/debate.js';

test('parser handles ascii, unicode and precedence', () => {
  assert.equal(show(parse('P1 & P2 -> M')), 'P1 ∧ P2 → M');
  assert.equal(show(parse('¬(P1 ∨ P2) ↔ ¬P1 ∧ ¬P2')), '¬(P1 ∨ P2) ↔ ¬P1 ∧ ¬P2');
  assert.equal(show(parse('A -> B -> C')), 'A → B → C');
  assert.equal(show(parse('(A -> B) -> C')), '(A → B) → C');
  assert.equal(show(parse('not A or B and C')), '¬A ∨ B ∧ C');
  assert.throws(() => parse('P1 &'), SyntaxError);
  assert.throws(() => parse('P1 P2'), SyntaxError);
  assert.throws(() => parse(''), SyntaxError);
});

test('entailment: modus ponens valid, affirming the consequent invalid', () => {
  assert.equal(entails([parse('P -> Q'), parse('P')], parse('Q')).valid, true);
  const bad = entails([parse('P -> Q'), parse('Q')], parse('P'));
  assert.equal(bad.valid, false);
  assert.deepEqual(bad.counterexample, { P: false, Q: true });
});

test('unsat core is minimal', () => {
  const fs = ['A', 'B', 'A -> C', '!C', 'B | D'].map(parse);
  assert.equal(satisfiable(fs).sat, false);
  assert.deepEqual(unsatCore(fs), [0, 2, 3]);
  assert.equal(unsatCore([parse('A')]), null);
});

test('load-bearing premises', () => {
  const ps = ['A -> M', 'A', 'B'].map(parse);
  assert.deepEqual(loadBearing(ps, parse('M')), [0, 1]);
});

test('lean theorem shape', () => {
  const src = leanTheorem('A1_valid', [parse('P1 -> M'), parse('P1')], parse('M'));
  assert.match(src, /theorem A1_valid : ∀ \(M P1 : Bool\)/);
  assert.match(src, /cases M <;> cases P1 <;> decide/);
  assert.match(leanTheorem('x', [parse('A'), parse('!A')], null), /→\n    False := by/);
});

test('example debate analysis', () => {
  const debate = JSON.parse(readFileSync(new URL('../public/example-debate.json', import.meta.url)));
  const r = analyzeDebate(debate);
  const byId = Object.fromEntries(r.arguments.map((a) => [a.id, a]));
  assert.equal(byId.A1.valid, true);
  assert.equal(byId.A2.valid, false, 'A2 has a gap: !P3 does not give M');
  assert.equal(byId.A3.valid, true);
  assert.equal(byId.A4.valid, true);
  assert.equal(byId.A5.valid, true);
  assert.equal(byId.A5.vacuous, true, 'A5 is vacuously valid — its premises contradict');
  assert.equal(byId.A1.vacuous, false);
  // pro side is inconsistent because A5 asserts P4, P4 -> !P3 and P3
  const pro = r.contradictions.find((c) => c.side === 'pro');
  assert.ok(pro);
  assert.deepEqual(pro.members.map((m) => m.formula).sort(), ['P3', 'P4', 'P4 → ¬P3'].sort());
  // P1 is load-bearing for both A1 (pro) and A4 (con) → top crux
  assert.equal(r.cruxes[0].id, 'P1');
  assert.ok(r.lean.source.includes('theorem A1_valid'));
  assert.ok(r.lean.source.includes('theorem pro_inconsistent_1'));
  assert.equal(r.gaps[0].argId, 'A2');
});

test('unknown propositions are reported, not crashed on', () => {
  const r = analyzeDebate({ motion: 'x', propositions: [], arguments: [{ id: 'A1', side: 'pro', premises: ['P9'], conclusion: 'M' }] });
  assert.match(r.arguments[0].errors[0], /Unknown proposition P9/);
});

test('formalizer output is materialized onto fresh proposition ids', async () => {
  const { materialize } = await import('../lib/agents.js');
  const debate = { motion: 'x', propositions: [{ id: 'P1', text: 'a' }, { id: 'P7', text: 'b' }] };
  const r = materialize(debate, {
    new_propositions: [{ key: 'N1', text: ' Costs fall ' }, { key: 'N2', text: 'Morale rises' }],
    premises: ['N1 & P1 -> M', 'N1'], conclusion: 'M', side: 'pro', restatement: '', notes: '',
  });
  assert.deepEqual(r.newPropositions.map((p) => [p.id, p.text]), [['P8', 'Costs fall'], ['P9', 'Morale rises']]);
  assert.deepEqual(r.argument.premises, ['P8 & P1 -> M', 'P8']);
  assert.throws(() => materialize(debate, { new_propositions: [], premises: ['P99'], conclusion: 'M', side: 'pro', restatement: '', notes: '' }), /unknown proposition P99/);
});
