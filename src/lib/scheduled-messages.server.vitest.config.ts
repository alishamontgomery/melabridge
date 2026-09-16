import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Minimal, self-contained config for the scheduled-messages targeted tests.
// Avoids the full TanStack Start plugin chain (which is client/SSR oriented)
// and just wires the "@" path alias the source file uses.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("../../src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/lib/scheduled-messages.server.test.ts"],
  },
});
