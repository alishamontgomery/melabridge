import { createServerFn } from "@tanstack/react-start";
import { provisionClerkIdentity } from "@/lib/auth-register.functions";
import { z } from "zod";

const ClerkIdentityInput = z.object({
  sessionToken: z.string().min(1).max(16_384).optional(),
});

/**
 * Returns (and, when necessary, provisions) the application identity for the
 * authenticated Clerk principal. Clerk remains the only sign-in authority;
 * the UUID is an internal ownership key for existing application rows.
 */
export const getCurrentClerkIdentity = createServerFn({ method: "POST" })
  .validator((data: unknown) => ClerkIdentityInput.parse(data ?? {}))
  .handler(async ({ data }) => provisionClerkIdentity(data.sessionToken));