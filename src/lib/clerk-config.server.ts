import { clerkClient } from "@clerk/tanstack-react-start/server";

export type ClerkCredentialIssue =
  | "ok"
  | "missing"
  | "malformed"
  | "environment_mismatch"
  | "rejected"
  | "unavailable";

export type ClerkCredentialCheck = {
  issue: ClerkCredentialIssue;
  message: string;
};

export class ClerkConfigurationError extends Error {
  constructor(
    public readonly issue: Exclude<ClerkCredentialIssue, "ok" | "unavailable">,
    message: string,
  ) {
    super(message);
    this.name = "ClerkConfigurationError";
  }
}

const publishableKeyPattern = /^pk_(test|live)_[A-Za-z0-9_-]+$/;
const secretKeyPattern = /^sk_(test|live)_[A-Za-z0-9_-]+$/;

export function externalClerkOptions() {
  const publishableKey = process.env.CLERK_PUBLISHABLE_KEY?.trim();
  // MelaBridge uses one external Clerk instance for the canonical site.
  // Never fall back to VITE_* or the obsolete external slot: those values can
  // belong to a different Clerk tenant and create an opaque session mismatch.
  const secretKey = process.env.CLERK_SECRET_KEY?.trim();
  if (!publishableKey || !secretKey) {
    throw new ClerkConfigurationError(
      "missing",
      "Clerk credentials are missing. Set CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY in the server environment.",
    );
  }
  if (!publishableKeyPattern.test(publishableKey)) {
    throw new ClerkConfigurationError(
      "malformed",
      "The Clerk publishable credential is malformed. Set CLERK_PUBLISHABLE_KEY to a valid Clerk publishable key.",
    );
  }
  if (!secretKeyPattern.test(secretKey)) {
    throw new ClerkConfigurationError(
      "malformed",
      "The Clerk server credential is malformed. Set CLERK_SECRET_KEY to a valid Clerk secret key.",
    );
  }
  const publishableMode = publishableKey.startsWith("pk_test_")
    ? "test"
    : publishableKey.startsWith("pk_live_")
      ? "live"
      : null;
  const secretMode = secretKey.startsWith("sk_test_")
    ? "test"
    : secretKey.startsWith("sk_live_")
      ? "live"
      : null;
  if (publishableMode && secretMode && publishableMode !== secretMode) {
    throw new ClerkConfigurationError(
      "environment_mismatch",
      "Clerk publishable and server credentials are from different environments. Use keys from the same Clerk instance and environment.",
    );
  }
  return { publishableKey, secretKey };
}

export function externalClerkClient() {
  return clerkClient(externalClerkOptions());
}

function errorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const value = error as { status?: unknown; statusCode?: unknown };
  if (typeof value.status === "number") return value.status;
  if (typeof value.statusCode === "number") return value.statusCode;
  return undefined;
}

function isRejectedCredentialError(error: unknown): boolean {
  const status = errorStatus(error);
  if (status === 401 || status === 403) return true;
  if (!error || typeof error !== "object") return false;
  const value = error as { errors?: Array<{ code?: unknown }> };
  return value.errors?.some((entry) => {
    const code = typeof entry.code === "string" ? entry.code.toLowerCase() : "";
    return code.includes("authentication") || code.includes("unauthorized") || code.includes("invalid_secret");
  }) ?? false;
}

async function runExternalClerkCredentialCheck(): Promise<ClerkCredentialCheck> {
  let options: ReturnType<typeof externalClerkOptions>;
  try {
    options = externalClerkOptions();
  } catch (error) {
    if (error instanceof ClerkConfigurationError) {
      return { issue: error.issue, message: error.message };
    }
    return {
      issue: "malformed",
      message: "Clerk credentials could not be validated. Check the server configuration.",
    };
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    // A bounded, read-only request confirms that the server credential is
    // accepted without loading or logging any user data.
    await Promise.race([
      clerkClient(options).users.getUserList({ limit: 1 }),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("Clerk credential verification timed out.")), 5_000);
      }),
    ]);
    return {
      issue: "ok",
      message: "Clerk server credentials were accepted.",
    };
  } catch (error) {
    if (isRejectedCredentialError(error)) {
      return {
        issue: "rejected",
        message:
          "Clerk rejected the server credential. Verify CLERK_SECRET_KEY belongs to the same Clerk instance and environment as CLERK_PUBLISHABLE_KEY, and replace it if it was revoked.",
      };
    }
    return {
      issue: "unavailable",
      message: "Clerk credential verification could not reach Clerk. Check network access and try again.",
    };
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

let externalClerkCredentialCheck: Promise<ClerkCredentialCheck> | undefined;

export function checkExternalClerkCredentials(): Promise<ClerkCredentialCheck> {
  if (!externalClerkCredentialCheck) {
    externalClerkCredentialCheck = runExternalClerkCredentialCheck();
    void externalClerkCredentialCheck.then((check) => {
      // A transient network failure should not become a permanent readiness
      // result; the next health check or auth request can retry it.
      if (check.issue === "unavailable") externalClerkCredentialCheck = undefined;
    });
  }
  return externalClerkCredentialCheck;
}
