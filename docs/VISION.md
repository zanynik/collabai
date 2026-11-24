# Agora: debates that converge

## The problem

Online discussion rarely gets anywhere. People talk past each other, repeat
points, defend conclusions that don't follow from what they said, and never
find out *which single disagreement* actually separates them. Summaries written
by AI make this worse in a quiet way: they read as balanced, but nobody can
check them.

## The idea

Make the **structure** of a disagreement explicit and machine-checkable, and
use it to decide what the group should talk about next.

| Role | Who | Does |
|---|---|---|
| Participant | human | Argues in plain language, votes on shared claims |
| Formalizer | AI (Claude) | Maps each argument onto the debate's shared claims as `premises ⊢ conclusion` |
| Prover | logic engine + Lean 4 | Decides whether each argument follows, finds counterexamples, contradictions, load-bearing premises |
| Facilitator | AI (Claude) | Reads the *checked* analysis and asks the next highest-leverage questions |

The rule that makes it trustworthy: **the AI translates and asks; it never
grades.** Validity is decided by exhaustive truth tables and certified by the
Lean 4 kernel. The AI can mistranslate, so the author always reviews the
formalization before it's added, and the formal version is shown next to the
original text forever after.

## What the prover gives the discussion

- **Gaps.** "Your conclusion doesn't follow. Here is a concrete situation where
  every premise holds and the conclusion fails." The missing assumption becomes
  the next thing to debate, which is usually where the real disagreement was hiding.
- **Self-contradiction.** An argument whose premises can't all be true proves
  nothing. A *side* whose combined premises can't all be true has to drop one.
  Agora shows the smallest conflicting set.
- **Load-bearing premises.** In a valid argument, which premises would break it
  if removed? Those are the only things an opponent needs to attack.
- **Cruxes.** A claim that is load-bearing for sound arguments on *both* sides,
  or one that participants are split on. Settling a crux changes minds;
  everything else is noise. Cruxes are ranked and fed to the Facilitator.

## Why shared propositions matter

The Formalizer's most important job is **reuse**: when two people say the same
thing in different words, it should become the same atom (`P3`). That's what
lets the prover see that Rae's argument *for* and Lee's argument *against* both
hinge on whether "output per employee stays the same". Without canonical claims
there are no cruxes, only parallel monologues.

## Lean loop: each round is an experiment

Agora treats a debate as a build–measure–learn loop:

1. **Build:** participants add arguments.
2. **Measure:** the prover computes rigor (share of arguments that follow),
   balance, contradictions and cruxes after every change.
3. **Learn:** the Facilitator turns the top crux or gap into a concrete
   question, and the next round starts there.

A debate is healthy when the follows-ratio rises and the crux list shrinks.

## Why Lean 4

The engine already decides propositional validity exactly, so why bring in a
theorem prover?

- **Certificates, not claims.** Every verdict is exported as a Lean theorem that
  anyone can re-check independently. "The pro side contradicts itself" comes
  with a proof.
- **Headroom.** Propositional logic is the first step. Lean lets the same
  pipeline grow into first-order arguments ("*every* city that tried this…"),
  quantitative claims (`cost ≤ budget`), and causal models, where truth tables
  stop working and real proof search is needed.
- **Auditable AI.** The Formalizer's output is code with a precise meaning, so
  a mistranslation is visible and fixable rather than buried in prose.

## Roadmap

1. **Now (this prototype):** single-browser debates, Claude formalizer and
   facilitator, truth-table checker, Lean 4 certificate export plus an optional
   Lean checker service.
2. **Multiplayer:** a shared database (e.g. Supabase/Postgres) for debates,
   arguments and votes; real-time updates; one vote per person.
3. **Evidence:** attach sources to propositions; the Facilitator asks for
   evidence on top cruxes specifically.
4. **Richer logic:** first-order and arithmetic claims via Lean + Mathlib
   tactics (`omega`, `linarith`, `aesop`), with the Formalizer emitting Lean
   directly.
5. **Outcome tracking:** measure whether debates converge (crux resolution
   rate, vote shifts on cruxes) and tune the Facilitator against that.
