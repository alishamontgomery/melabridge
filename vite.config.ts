import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import tsconfigPaths from "vite-tsconfig-paths";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

// Pull Supabase credentials from process.env at config-evaluation time so that
// Replit Secrets (SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY) override the stale
// values in .env that still reference the deleted Supabase project.
const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_PUBLISHABLE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "";
const SUPABASE_PROJECT_ID =
  process.env.SUPABASE_PROJECT_ID || process.env.VITE_SUPABASE_PROJECT_ID || "";
const CLERK_PUBLISHABLE_KEY =
  process.env.CLERK_PUBLISHABLE_KEY?.trim() || "";

export default defineConfig({
  plugins: [
    // TanStack Start must run before the React plugin.
    tanstackStart({
      // Use the SSR error wrapper used by the application server.
      server: { entry: "server" },
    }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
    // Replit publishes this app as a Node/Cloud Run service, so the production
    // bundle must expose an HTTP server rather than a worker module.
    nitro({ preset: "node-server" }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(projectRoot, "src"),
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
      "@tanstack/react-start",
      "@tanstack/react-router",
    ],
  },
  server: {
    host: "0.0.0.0",
    port: 5000,
    allowedHosts: true,
    strictPort: true,
  },
  // Override import.meta.env.VITE_* at build time with values from Replit Secrets.
  // Without this, Vite bakes the stale .env values into the browser bundle.
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(SUPABASE_URL),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(SUPABASE_PUBLISHABLE_KEY),
    "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(SUPABASE_PROJECT_ID),
    "import.meta.env.VITE_CLERK_PUBLISHABLE_KEY": JSON.stringify(CLERK_PUBLISHABLE_KEY),
  },
  optimizeDeps: {
    // Pre-bundle TanStack Router packages (including subpath exports) at
    // startup so Vite never lazily re-discovers them mid-session.
    include: [
      "@tanstack/react-router",
      "@tanstack/router-core",
      "@tanstack/router-core/isServer",
      "@tanstack/router-core/ssr/client",
      "@tanstack/router-core/ssr/server",
      "@tanstack/history",
      "seroval",
      "h3-v2",
    ],
    // @google/genai and its deps are server-only — exclude them so the
    // client optimizer never tries to process Node.js-only code.
    exclude: [
      "@google/genai",
      "google-auth-library",
      "protobufjs",
      "ws",
    ],
  },
});
