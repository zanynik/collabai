// Thin wrapper around the Claude API for structured (schema-validated) output.

import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';

export const MODEL = process.env.AGORA_MODEL || 'claude-opus-5-5';

let client;
function getClient() {
  if (!client) client = new Anthropic(); // reads ANTHROPIC_API_KEY
  return client;
}

export class LLMError extends Error {
  constructor(message, status = 502) { super(message); this.status = status; }
}

/**
 * Ask Claude for JSON matching `schema` (a zod schema). Returns the parsed object.
 * Server-side fallbacks are enabled so a safety-classifier false positive on
 * the primary model is retried on a fallback model inside the same call.
 */
export async function structured({ system, prompt, schema, effort = 'medium', maxTokens = 16000 }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new LLMError('ANTHROPIC_API_KEY is not configured on the server', 503);
  }
  let response;
  try {
    response = await getClient().beta.messages.parse({
      model: MODEL,
      max_tokens: maxTokens,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system,
      messages: [{ role: 'user', content: prompt }],
      output_config: { effort, format: betaZodOutputFormat(schema) },
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) throw new LLMError('Claude is rate limited — try again shortly', 429);
    if (err instanceof Anthropic.AuthenticationError) throw new LLMError('Invalid ANTHROPIC_API_KEY', 503);
    if (err instanceof Anthropic.APIError) throw new LLMError(`Claude API error ${err.status}: ${err.message}`);
    throw err;
  }
  if (response.stop_reason === 'refusal') {
    throw new LLMError('Claude declined to process this content', 422);
  }
  if (response.stop_reason === 'max_tokens') {
    throw new LLMError('Response was cut off (max_tokens)');
  }
  if (!response.parsed_output) throw new LLMError('Claude returned output that did not match the schema');
  return response.parsed_output;
}
