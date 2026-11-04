import test from "node:test";
import assert from "node:assert/strict";
import { normalizeLockfileRegistryUrls } from "./normalize-github-npm-lock.mjs";

test("rewrites Replit firewall tarball URLs to the public npm registry", () => {
  const lock = {
    packages: {
      "node_modules/example": {
        resolved:
          "http://package-firewall.replit.internal/npm/example/-/example-1.2.3.tgz",
      },
      "node_modules/@scope/example": {
        resolved:
          "http://package-firewall.replit.internal/npm/@scope/example/-/example-1.2.3.tgz",
      },
      "node_modules/other": {
        resolved: "https://registry.npmjs.org/other/-/other-1.0.0.tgz",
      },
    },
  };

  assert.equal(normalizeLockfileRegistryUrls(lock), 2);
  assert.equal(
    lock.packages["node_modules/example"].resolved,
    "https://registry.npmjs.org/example/-/example-1.2.3.tgz",
  );
  assert.equal(
    lock.packages["node_modules/@scope/example"].resolved,
    "https://registry.npmjs.org/@scope/example/-/example-1.2.3.tgz",
  );
  assert.equal(
    lock.packages["node_modules/other"].resolved,
    "https://registry.npmjs.org/other/-/other-1.0.0.tgz",
  );
});
