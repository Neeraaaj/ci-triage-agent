import assert from "node:assert/strict";
import { isAllowedPath } from "./tools.js";

const cases = [
  ["src/slug.ts", true],
  ["test/slug.test.ts", true],
  [".env", false],
  ["src/../.env", false],
  ["/etc/passwd", false],
  ["node_modules/zod/index.js", false],
  ["src/secrets.pem", false],
  ['package.json', true],
  ["src/.env", false],
  ["src/./slug.ts", false]
] as const;

for (const [path, expected] of cases) {
  assert.equal(
    isAllowedPath(path),
    expected,
    `Unexpected result for path: ${path}`,
  );

  console.log(`PASS ${path} -> ${expected}`);
}

console.log(`\nAll ${cases.length} path checks passed.`);