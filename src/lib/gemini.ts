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

/**
 * Only capacity and rate limiting are worth sending again. A rejected key or a
 * rejected schema fails identically however often it is repeated, so retrying
 * those would spend quota and delay the message that actually explains it.
 *
 * 503 is the common one on the free tier: the model is busy, not unwilling.
 */
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const MAX_REQUESTS = 3;
/** One entry per gap between sends, so MAX_REQUESTS - 1 of them. Rising,
 * because a model that is busy now is rarely free a second later. */
const BACKOFF_MS = [2_000, 6_000];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
  /**
   * Audio sent alongside the prompt. The model hears the recording rather than
   * reading a transcript of it — speech recognition silently repairs learner
   * German, which would make grammar feedback systematically flattering.
   */
  audio?: { mimeType: string; base64: string };
  temperature?: number;
  maxOutputTokens?: number;
  /** Beyond this the request is abandoned rather than spinning forever. */
  timeoutMs?: number;
  /** Called before each send, so a resend can be told apart from a hang. */
  onRequest?: (current: number, total: number) => void;
}): Promise<T> {
  const {
    apiKey,
    model,
    system,
    user,
    schema,
    audio,
    temperature = 0.3,
    maxOutputTokens = 8192,
    timeoutMs = 75_000,
    onRequest,
  } = opts;

  const parts: Record<string, unknown>[] = [{ text: user }];
  if (audio) parts.push({ inlineData: { mimeType: audio.mimeType, data: audio.base64 } });

  const payload = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: schema,
      temperature,
      maxOutputTokens,
    },
  });

  let res: Response | undefined;
  for (let sent = 1; sent <= MAX_REQUESTS; sent++) {
    onRequest?.(sent, MAX_REQUESTS);

    // Per send, so a resend does not have to share the previous one's budget.
    // Without this a stalled request leaves the UI spinning with nothing to report.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      res = await fetch(
        `${BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: payload,
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

    if (res.ok) break;

    if (!RETRYABLE_STATUS.has(res.status) || sent === MAX_REQUESTS) {
      const message = await readError(res);
      if (res.status === 429) {
        throw new GeminiError(
          `Rate limited by the free tier. Your actual limits are shown at aistudio.google.com/rate-limit — Google no longer publishes them. (${message})`,
          429,
        );
      }
      throw new GeminiError(message, res.status);
    }

    await sleep(BACKOFF_MS[sent - 1]);
  }

  if (!res) throw new GeminiError(`No response from ${model}.`);

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
