# Agora

**Debates that converge.** Participants argue in plain language. Claude
formalizes each argument onto the debate's shared claims, a logic engine
(certified by Lean 4) checks whether it actually follows, and an AI facilitator
steers the next round toward the cruxes: the few claims the whole disagreement
hinges on.

See [docs/VISION.md](docs/VISION.md) for the product thinking.

## What you get

- **Follows / Gap / Self-contradictory** verdict on every argument, with a
  concrete counterexample when it doesn't follow
- **Contradiction detection** per side, reduced to the smallest conflicting set
- **Load-bearing premises** highlighted: the only things worth attacking
- **Cruxes** ranked by how much both sides depend on them and how split people are
- **Next questions** from the Facilitator, based on the checked analysis
- **Lean 4 certificate** for every verdict, re-checkable by anyone

## Run locally

```bash
npm install
```

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

```bash
npm run dev
```

Open http://localhost:3000. The example debate loads automatically. Without an
API key, everything except *Formalize with AI* and *Suggest next questions*
still works; use **Write it formally** to add arguments by hand.

```bash
npm test
```

## Deploy (Vercel)

Static files are in `public/`, serverless functions in `api/`. Set:

| Variable | Required | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | for AI features | Formalizer and Facilitator |
| `AGORA_MODEL` | no | Override the model (default `claude-opus-5-5`) |
| `LEAN_SERVER_URL` | no | URL of the Lean checker (below) for kernel-certified verdicts |
| `LEAN_SERVER_TOKEN` | no | Shared secret for the Lean checker |

## Lean checker (optional)

Without it, verdicts come from exhaustive truth tables (exact for
propositional logic) and the Lean source is still generated for export. With
it, the Lean 4 kernel checks every theorem on each analysis.

```bash
docker build -t agora-lean lean-server
```

```bash
docker run -p 8080:8080 -e LEAN_SERVER_TOKEN=change-me agora-lean
```

Then set `LEAN_SERVER_URL=http://<host>:8080` and the same `LEAN_SERVER_TOKEN`
on the web app.

## API

All endpoints take `POST` with `{ debate }` (see the shape in
`lib/debate.js`, or `public/example-debate.json`).

| Endpoint | AI? | Returns |
|---|---|---|
| `/api/analyze` | no | verdicts, counterexamples, contradictions, cruxes, Lean source, verification status |
| `/api/formalize` | yes | proposed `premises ⊢ conclusion` + any new shared claims, for `{ text, side, author }` |
| `/api/facilitate` | yes | a neutral synthesis and up to 5 high-leverage questions |

## Formula syntax

`M` is the motion; `P1, P2, …` are shared claims. Connectives: `!` not, `&`
and, `|` or, `->` implies, `<->` iff (unicode `¬ ∧ ∨ → ↔` also work).

## Layout

```
api/            serverless handlers (analyze, formalize, facilitate)
lib/logic.js    parser, entailment, unsat cores, Lean 4 emitter
lib/debate.js   debate analysis: verdicts, contradictions, cruxes
lib/agents.js   Formalizer and Facilitator prompts + schemas
lib/llm.js      Claude client (structured output)
lib/lean.js     client for the Lean checker service
lean-server/    Lean 4 checker service + Dockerfile
public/         single-page app + example debate
test/           node:test suite
```

## Status

Prototype. Debates live in the browser (localStorage) and can be exported or
imported as JSON. Multiplayer storage is the next step (see the roadmap in the vision doc).
