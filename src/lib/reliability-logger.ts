export type ReliabilityLevel = "info" | "warn" | "error";

export type ReliabilityContext = {
  source?: string;
  route?: string;
  operation?: string;
  status?: number;
  detail?: string;
  [key: string]: unknown;
};

const MAX_TEXT = 600;
const MAX_DETAIL = 1200;

function redact(value: string, maxLength = MAX_TEXT): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/\b(?:sk|pk)_(?:test|live)_[A-Za-z0-9_-]+/g, "[redacted-key]")
    .replace(/\b(?:eyJ|AIza)[A-Za-z0-9._-]+/g, "[redacted-token]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-email]")
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, "[redacted-id]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function safeRoute(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const path = value.split("?")[0].split("#")[0];
  return redact(
    path
      .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "/:id")
      .replace(/\/[A-Za-z0-9_-]{24,}/g, "/:token"),
    180,
  );
}

export function safeErrorMessage(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Unknown error";
  return redact(message, MAX_DETAIL) || "Unknown error";
}

export function safeErrorRecord(
  error: unknown,
  context: ReliabilityContext = {},
): Record<string, unknown> {
  const safeContext: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    if (value == null) continue;
    if (key === "route") {
      safeContext[key] = safeRoute(value);
    } else if (typeof value === "string") {
      safeContext[key] = redact(value);
    } else if (typeof value === "number" || typeof value === "boolean") {
      safeContext[key] = value;
    }
  }
  return {
    ...safeContext,
    message: safeErrorMessage(error),
  };
}

export function logReliability(
  level: ReliabilityLevel,
  event: string,
  context: ReliabilityContext = {},
): void {
  const safeContext = safeErrorRecord(context.detail ?? event, context);
  const record = {
    at: new Date().toISOString(),
    event: redact(event, 120),
    ...safeContext,
  };
  const line = `[reliability] ${JSON.stringify(record)}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}