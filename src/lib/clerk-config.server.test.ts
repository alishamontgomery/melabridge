import { afterEach, describe, expect, it } from "vitest";
import { ClerkConfigurationError, externalClerkOptions } from "./clerk-config.server";

const originalPublishableKey = process.env.CLERK_PUBLISHABLE_KEY;
const originalSecretKey = process.env.CLERK_SECRET_KEY;

function setCredentials(publishableKey: string | undefined, secretKey: string | undefined) {
  if (publishableKey === undefined) delete process.env.CLERK_PUBLISHABLE_KEY;
  else process.env.CLERK_PUBLISHABLE_KEY = publishableKey;
  if (secretKey === undefined) delete process.env.CLERK_SECRET_KEY;
  else process.env.CLERK_SECRET_KEY = secretKey;
}

afterEach(() => {
  setCredentials(originalPublishableKey, originalSecretKey);
});

describe("external Clerk configuration", () => {
  it("identifies missing credentials without including secret values", () => {
    setCredentials(undefined, undefined);

    try {
      externalClerkOptions();
      throw new Error("expected configuration error");
    } catch (error) {
      expect(error).toBeInstanceOf(ClerkConfigurationError);
      expect((error as ClerkConfigurationError).issue).toBe("missing");
      expect((error as Error).message).toContain("CLERK_SECRET_KEY");
    }
  });

  it("identifies malformed credentials without echoing their values", () => {
    const malformedSecret = "not-a-clerk-secret";
    setCredentials("not-a-publishable-key", malformedSecret);

    try {
      externalClerkOptions();
      throw new Error("expected configuration error");
    } catch (error) {
      expect(error).toBeInstanceOf(ClerkConfigurationError);
      expect((error as ClerkConfigurationError).issue).toBe("malformed");
      expect((error as Error).message).not.toContain(malformedSecret);
    }
  });

  it("identifies test/live key pairs from different environments", () => {
    setCredentials("pk_test_example", "sk_live_example");

    try {
      externalClerkOptions();
      throw new Error("expected configuration error");
    } catch (error) {
      expect(error).toBeInstanceOf(ClerkConfigurationError);
      expect((error as ClerkConfigurationError).issue).toBe("environment_mismatch");
      expect((error as Error).message).not.toContain("pk_test_example");
      expect((error as Error).message).not.toContain("sk_live_example");
    }
  });
});