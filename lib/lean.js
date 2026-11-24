// Optional: send the generated Lean file to a Lean 4 checker service so the
// kernel, not just our JS truth tables, certifies the verdicts.
// Configure LEAN_SERVER_URL (see lean-server/). Without it, verdicts come from
// the built-in exhaustive truth-table checker, which decides the same question.

export async function checkWithLean(source, { timeoutMs = 20000 } = {}) {
  const url = process.env.LEAN_SERVER_URL;
  if (!url) return { checker: 'truth-table', kernelChecked: false };
  try {
    const res = await fetch(new URL('/check', url), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(process.env.LEAN_SERVER_TOKEN ? { authorization: `Bearer ${process.env.LEAN_SERVER_TOKEN}` } : {}),
      },
      body: JSON.stringify({ source }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = await res.json();
    return {
      checker: 'lean4',
      kernelChecked: Boolean(body.ok),
      leanVersion: body.version,
      messages: body.messages ?? [],
      error: res.ok ? undefined : body.error,
    };
  } catch (err) {
    return { checker: 'truth-table', kernelChecked: false, error: `Lean checker unreachable: ${err.message}` };
  }
}
