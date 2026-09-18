import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const sourceRoot = fileURLToPath(new URL("../src/", import.meta.url));
const sourceExtensions = new Set([".js", ".jsx", ".ts", ".tsx"]);
const deprecatedInputValidator = /\.inputValidator\s*\(/g;
const violations = [];

async function checkDirectory(directory) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      await checkDirectory(path);
      continue;
    }

    if (!entry.isFile() || !sourceExtensions.has(extname(entry.name))) {
      continue;
    }

    const source = await readFile(path, "utf8");

    for (const match of source.matchAll(deprecatedInputValidator)) {
      const line = source.slice(0, match.index).split("\n").length;
      violations.push(`${relative(sourceRoot, path)}:${line}`);
    }
  }
}

await checkDirectory(sourceRoot);

if (violations.length > 0) {
  console.error("Deprecated TanStack Start inputValidator() calls found:");
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  console.error(
    "Replace each call with createServerFn().validator() before continuing.",
  );
  process.exitCode = 1;
} else {
  console.log("No deprecated TanStack Start inputValidator() calls found.");
}