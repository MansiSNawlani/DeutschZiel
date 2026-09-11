/**
 * Minimal Gemini REST client. Called straight from the browser with the
 * learner's own key (see settings.ts) — there is no backend in v0.
 *
 * Model IDs are deliberately not hardcoded: the settings screen lists what the
 * key actually has access to and the learner picks. Google's free-tier model
 * lineup changes often and rate limits are no longer published, so discovering
 * them at runtime beats guessing at build time.
 */

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

export type GeminiModel = {
  id: string;
  displayName: string;
  inputTokenLimit: number;
};

export class GeminiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'GeminiError';
  }
}

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    return body.error?.message ?? res.statusText;
  } catch {
    return res.statusText;
  }
}

/** Models this key can call generateContent on, newest-looking Flash first. */
export async function listModels(apiKey: string): Promise<GeminiModel[]> {
  const res = await fetch(`${BASE}/models?key=${encodeURIComponent(apiKey)}&pageSize=200`);
  if (!res.ok) throw new GeminiError(await readError(res), res.status);

  const body = (await res.json()) as {
    models?: {
      name: string;
      displayName?: string;
      inputTokenLimit?: number;
      supportedGenerationMethods?: string[];
    }[];
  };

  return (body.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => ({
      id: m.name.replace(/^models\//, ''),
      displayName: m.displayName ?? m.name,
      inputTokenLimit: m.inputTokenLimit ?? 0,
    }))
    .sort((a, b) => score(b.id) - score(a.id) || a.id.localeCompare(b.id));
}

/** Prefer Flash (free tier, fast enough for a correction loop), then newer versions. */
function score(id: string): number {
  let s = 0;
  if (id.includes('flash')) s += 100;
  if (id.includes('lite')) s -= 30;
  if (id.includes('preview') || id.includes('exp')) s -= 20;
  const version = /gemini-(\d+(?:\.\d+)?)/.exec(id);
  if (version) s += parseFloat(version[1]) * 10;
  return s;
}

export type JsonSchema = Record<string, unknown>;

/**
 * One structured-output call. responseSchema makes the model return parseable
 * JSON rather than prose we would have to scrape, which is what lets the error
 * taxonomy stay a closed enum.
 */
export async function generateJson<T>(opts: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  schema: JsonSchema;
  temperature?: number;
  maxOutputTokens?: number;
  /** Beyond this the request is abandoned rather than spinning forever. */
  timeoutMs?: number;
}): Promise<T> {
  const {
    apiKey,
    model,
    system,
    user,
    schema,
    temperature = 0.3,
    maxOutputTokens = 8192,
    timeoutMs = 75_000,
  } = opts;

  // Without this a stalled request leaves the UI spinning with nothing to report.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(
      `${BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: schema,
            temperature,
            maxOutputTokens,
          },
        }),
      },
    );
  } catch (e) {
    if (controller.signal.aborted) {
      throw new GeminiError(
        `${model} did not respond within ${Math.round(timeoutMs / 1000)}s. Reasoning-heavy models can exceed this — pick a Flash model in Einstellungen, or try again.`,
      );
    }
    throw new GeminiError(`Network error calling ${model}: ${String(e)}`);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const message = await readError(res);
    if (res.status === 429) {
      throw new GeminiError(
        `Rate limited by the free tier. Your actual limits are shown at aistudio.google.com/rate-limit — Google no longer publishes them. (${message})`,
        429,
      );
    }
    throw new GeminiError(message, res.status);
  }

  const body = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
  };

  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('');
  if (!text) {
    const reason = body.candidates?.[0]?.finishReason;
    if (body.promptFeedback?.blockReason) {
      throw new GeminiError(`${model} blocked the prompt (${body.promptFeedback.blockReason}).`);
    }
    if (reason === 'MAX_TOKENS') {
      // Reasoning models can spend the whole output budget before emitting JSON.
      throw new GeminiError(
        `${model} hit its output limit before returning any JSON. This usually means a reasoning-heavy model — pick a Flash model in Einstellungen.`,
      );
    }
    throw new GeminiError(`Empty response from ${model}${reason ? ` (${reason})` : ''}`);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new GeminiError(`Model returned text that is not JSON: ${text.slice(0, 200)}`);
  }
}
