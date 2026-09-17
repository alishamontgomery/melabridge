import Stripe from "stripe";

const getEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not configured`);
  return value;
};

export type StripeEnv = "sandbox" | "live";

export function getStripeSecretKey(env: StripeEnv): string | null {
  if (env === "sandbox") {
    return process.env.STRIPE_SANDBOX_SECRET_KEY ?? process.env.STRIPE_SECRET_KEY ?? null;
  }

  // Older deployments stored the live key under the generic name. Reuse it
  // only when its prefix proves it is a live key; never let a test key service
  // a production checkout request.
  const explicitLiveKey = process.env.STRIPE_LIVE_SECRET_KEY;
  if (explicitLiveKey?.startsWith("sk_live_")) return explicitLiveKey;
  const genericKey = process.env.STRIPE_SECRET_KEY;
  return genericKey?.startsWith("sk_live_") ? genericKey : null;
}

export function createStripeClient(env: StripeEnv): Stripe {
  const directKey = getStripeSecretKey(env);
  if (directKey) {
    return new Stripe(directKey, {
      apiVersion: "2026-03-25.dahlia",
    });
  }

  throw new Error(
    env === "sandbox"
      ? "Stripe sandbox credentials are not configured. Add STRIPE_SANDBOX_SECRET_KEY or STRIPE_SECRET_KEY in Replit Secrets."
      : "Stripe live credentials are not configured. Add STRIPE_LIVE_SECRET_KEY in Replit Secrets.",
  );
}

export function getStripeErrorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const e = error as {
      message?: string; type?: string; code?: string; decline_code?: string; param?: string; requestId?: string;
      raw?: { message?: string; type?: string; code?: string; decline_code?: string; param?: string; requestId?: string };
    };
    const message = e.raw?.message ?? e.message;
    if (message) {
      const details = [
        e.raw?.type ?? e.type,
        e.raw?.code ?? e.code,
        e.raw?.decline_code ?? e.decline_code,
        e.raw?.param ?? e.param,
        e.raw?.requestId ?? e.requestId,
      ].filter(Boolean);
      return details.length ? `${message} (${details.join(", ")})` : message;
    }
  }
  return "Stripe request failed";
}

export async function verifyWebhook(req: Request, env: StripeEnv): Promise<{ type: string; data: { object: any } }> {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();
  const secret = env === "sandbox"
    ? getEnv("PAYMENTS_SANDBOX_WEBHOOK_SECRET")
    : getEnv("PAYMENTS_LIVE_WEBHOOK_SECRET");

  if (!signature || !body) throw new Error("Missing signature or body");

  let timestamp: string | undefined;
  const v1Signatures: string[] = [];
  for (const part of signature.split(",")) {
    const [key, value] = part.split("=", 2);
    if (key === "t") timestamp = value;
    if (key === "v1") v1Signatures.push(value);
  }
  if (!timestamp || v1Signatures.length === 0) throw new Error("Invalid signature format");

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) throw new Error("Webhook timestamp too old");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`));
  const expected = Buffer.from(new Uint8Array(signed)).toString("hex");
  if (!v1Signatures.includes(expected)) throw new Error("Invalid webhook signature");
  return JSON.parse(body);
}
