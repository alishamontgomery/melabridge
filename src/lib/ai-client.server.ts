/**
 * Shared AI completion client — server-only.
 *
 * Provider: Google Gemini via the official @google/genai SDK.
 * Key:       GEMINI_API_KEY  (Replit Secret — any format issued by Google AI Studio)
 * Model:     explicit Gemini model with a supported fallback
 *
 * Import only from server-side modules (*.functions.ts, *.server.ts, etc.).
 */

import { GoogleGenAI, type Content } from "@google/genai";

export type AiMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AiCallOptions = {
  /** Request JSON-object output from the model. */
  jsonMode?: boolean;
  /** Maximum number of attempts for transient provider failures. */
  maxAttempts?: number;
  /** Per-attempt timeout. */
  timeoutMs?: number;
  /** Optional response validator. Invalid responses are retried, never shown as AI output. */
  isAcceptable?: (text: string) => boolean;
};

export type AiError =
  | { kind: "no_key" }
  | { kind: "timeout" }
  | { kind: "rate_limited" }
  | { kind: "payment_required" }
  | { kind: "malformed_response" }
  | { kind: "http_error"; status: number; body?: string }
  | { kind: "network_error"; message: string };

export type AiResult =
  | { ok: true; text: string; provider: string }
  | { ok: false; error: AiError };

// Keep model selection explicit and allow a second currently-supported model
// when a provider model is retired, unavailable in a region, or at capacity.
// These can be overridden without a code release when Google changes aliases.
const DEFAULT_PRIMARY_MODEL = "gemini-2.5-flash";
const DEFAULT_FALLBACK_MODEL = "gemini-2.5-flash-lite";
const AI_TIMEOUT_MS = 18_000;
const MAX_ATTEMPTS = 2;
const MODEL_RETRY_DELAY_MS = [400];

/** Lazy singleton — avoids module-load crash when env var is absent (SSR safety). */
let _client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!_client) {
    _client = new GoogleGenAI({ apiKey });
  }
  return _client;
}

/** True when a Gemini API key is configured. */
export function hasAiProvider(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

/** Return the active provider label, or null if none configured. */
export function getAiProviderLabel(): string | null {
  return process.env.GEMINI_API_KEY ? "gemini" : null;
}

/**
 * Split OpenAI-style messages into:
 *  - systemInstruction: joined text of all "system" role entries
 *  - contents: remaining messages with roles mapped (assistant → model)
 */
function splitMessages(messages: AiMessage[]): {
  systemInstruction: string | undefined;
  contents: Content[];
} {
  const systemParts: string[] = [];
  const contents: Content[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      systemParts.push(msg.content);
    } else {
      contents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      });
    }
  }

  return {
    systemInstruction: systemParts.length > 0 ? systemParts.join("\n\n") : undefined,
    contents,
  };
}

/** Classify an error thrown by the @google/genai SDK into our AiError union. */
function classifyError(e: unknown): AiError {
  const msg = e instanceof Error ? e.message : String(e);
  if (/timed out|timeout/i.test(msg)) {
    return { kind: "timeout" };
  }
  // SDK surfaces HTTP status codes in the message text
  if (/429|quota|rate.?limit|RESOURCE_EXHAUSTED/i.test(msg)) {
    return { kind: "rate_limited" };
  }
  if (/403|payment|billing|PERMISSION_DENIED/i.test(msg)) {
    return { kind: "payment_required" };
  }
  if (/404|not found|model.*(invalid|not available|unavailable)|invalid.*model/i.test(msg)) {
    const match = msg.match(/(\d{3})/);
    return { kind: "http_error", status: match ? Number(match[1]) : 404, body: msg.slice(0, 400) };
  }
  // 5xx (server-side / capacity) — treat as rate_limited so the UI message makes sense
  if (/5\d{2}|UNAVAILABLE|overloaded|high demand|capacity/i.test(msg)) {
    return { kind: "rate_limited" };
  }
  if (/4\d{2}/.test(msg)) {
    const match = msg.match(/(\d{3})/);
    const status = match ? parseInt(match[1], 10) : 400;
    return { kind: "http_error", status, body: msg.slice(0, 400) };
  }
  return { kind: "network_error", message: msg };
}

function isRetryable(error: AiError): boolean {
  if (["timeout", "rate_limited", "network_error", "malformed_response"].includes(error.kind)) return true;
  if (error.kind !== "http_error") return false;
  return [408, 409, 425, 429].includes(error.status) || error.status >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGeminiOnce(
  client: GoogleGenAI,
  model: string,
  messages: AiMessage[],
  options: AiCallOptions,
): Promise<AiResult> {
  const { systemInstruction, contents } = splitMessages(messages);
  const timeoutMs = options.timeoutMs ?? AI_TIMEOUT_MS;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const response = await Promise.race([
      client.models.generateContent({
        model,
        contents,
        config: {
          ...(systemInstruction ? { systemInstruction } : {}),
          ...(options.jsonMode ? { responseMimeType: "application/json" } : {}),
        },
      }),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("MelaAssist request timed out")), timeoutMs);
      }),
    ]);

    const text = (response.text ?? "").trim();
    if (!text) {
      return { ok: false, error: { kind: "malformed_response" } };
    }
    if (options.isAcceptable && !options.isAcceptable(text)) {
      return { ok: false, error: { kind: "malformed_response" } };
    }
    return { ok: true, text, provider: `gemini:${model}` };
  } catch (e) {
    return { ok: false, error: classifyError(e) };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/** Call Gemini with bounded retry/backoff and model fallback. */
export async function callAi(
  messages: AiMessage[],
  options?: AiCallOptions,
): Promise<AiResult> {
  const client = getClient();
  if (!client) {
    console.error(
      "[MelaAssist] callAi: No AI provider configured. " +
        "Add GEMINI_API_KEY to Replit Secrets to enable MelaAssist features.",
    );
    return { ok: false, error: { kind: "no_key" } };
  }

  const models = [
    process.env.GEMINI_MODEL?.trim() || DEFAULT_PRIMARY_MODEL,
    process.env.GEMINI_FALLBACK_MODEL?.trim() || DEFAULT_FALLBACK_MODEL,
  ].filter((model, index, list) => model && list.indexOf(model) === index);
  const maxAttempts = Math.max(1, Math.min(options?.maxAttempts ?? MAX_ATTEMPTS, MAX_ATTEMPTS));
  let lastError: AiError = { kind: "network_error", message: "No AI response." };

  for (const model of models) {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const result = await callGeminiOnce(client, model, messages, options ?? {});
      if (result.ok) {
        if (attempt > 1 || model !== models[0]) {
          console.info(`[MelaAssist] recovered with ${result.provider} after ${attempt} attempt(s).`);
        }
        return result;
      }

      lastError = result.error;
      const shouldRetry = isRetryable(result.error) && attempt < maxAttempts;
      console.warn(
        `[MelaAssist] provider attempt failed (${model}, attempt ${attempt}/${maxAttempts}, ${result.error.kind})`,
      );
      if (shouldRetry) {
        await sleep(MODEL_RETRY_DELAY_MS[Math.min(attempt - 1, MODEL_RETRY_DELAY_MS.length - 1)]);
      } else {
        break;
      }
    }

    // Move to the configured fallback model after provider capacity, timeout,
    // network, or model-availability failures. Non-retryable client errors
    // should not be repeated against another model.
    const canTryFallback =
      lastError.kind === "timeout" ||
      lastError.kind === "rate_limited" ||
      lastError.kind === "network_error" ||
      lastError.kind === "malformed_response" ||
      (lastError.kind === "http_error" && [400, 404].includes(lastError.status));
    if (!canTryFallback) {
      break;
    }
  }

  console.error(`[MelaAssist] all provider attempts failed (${lastError.kind}).`);
  return { ok: false, error: lastError };
}

/** Convert an AiError into a user-readable message. */
export function aiErrorMessage(error: AiError): string {
  switch (error.kind) {
    case "no_key":
      return "MelaAssist is temporarily unavailable. Please try again shortly.";
    case "timeout":
      return "MelaAssist is taking longer than expected. Please try again.";
    case "rate_limited":
      return "MelaAssist is busy right now — please try again in a moment.";
    case "payment_required":
      return "MelaAssist couldn't connect to its planning engine right now. Please try again shortly.";
    case "malformed_response":
      return "MelaAssist returned an incomplete response. Please try again.";
    case "http_error":
      return "MelaAssist couldn't reach its planning engine. Please try again shortly.";
    case "network_error":
      return "MelaAssist couldn't reach the planning engine. Check your connection and try again.";
    default:
      return "MelaAssist couldn't complete this request. Please try again.";
  }
}
