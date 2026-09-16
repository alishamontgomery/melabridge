import { auth } from "@clerk/tanstack-react-start/server";
import { externalClerkClient, externalClerkOptions } from "@/lib/clerk-config.server";

/**
 * Resolves the authenticated Clerk subject for server functions.
 *
 * A freshly activated browser session can have a token before its session
 * cookie is available to the first server request. Prefer the explicit token
 * when one is supplied, then fall back to the request-bound Clerk session for
 * ordinary protected calls.
 */
export async function resolveClerkUserId(sessionToken?: string): Promise<string> {
  if (sessionToken) {
    const clerk = externalClerkClient();
    const requestState = await clerk.authenticateRequest(
      new Request("https://melabridge.local/auth/session", {
        headers: { Authorization: `Bearer ${sessionToken}` },
      }),
      { ...externalClerkOptions(), acceptsToken: "session_token" },
    );
    const verified = requestState.toAuth();
    if (verified?.userId) return verified.userId;
  }

  const session = await auth();
  if (session.userId) return session.userId;
  throw new Error("Unauthorized: Clerk authentication is required.");
}