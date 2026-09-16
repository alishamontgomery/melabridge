import { clerkClient } from "@clerk/tanstack-react-start/server";

export function externalClerkOptions() {
  const publishableKey = process.env.CLERK_PUBLISHABLE_KEY?.trim();
  // Both values come from the canonical Replit Clerk development-key pair.
  // Never fall back to VITE_* or the obsolete external slot: those values can
  // belong to a different Clerk tenant and create an opaque session mismatch.
  const secretKey = process.env.CLERK_SECRET_KEY?.trim();
  if (!publishableKey || !secretKey) {
    throw new Error("Clerk credentials are not configured.");
  }
  if (!/^sk_(test|live)_/.test(secretKey)) {
    throw new Error("CLERK_SECRET_KEY must be a Clerk server secret key.");
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
    throw new Error("Clerk publishable and secret keys are from different environments.");
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
    throw new Error("Clerk publishable and secret keys are from different environments.");
  }
  return { publishableKey, secretKey };
}

export function externalClerkClient() {
  return clerkClient(externalClerkOptions());
}
