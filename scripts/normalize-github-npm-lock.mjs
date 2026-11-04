import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const privateRegistryPrefix = "http://package-firewall.replit.internal/npm/";

export function normalizeLockfileRegistryUrls(lock) {
  let rewrittenCount = 0;
  for (const entry of Object.values(lock.packages ?? {})) {
    if (typeof entry.resolved === "string" && entry.resolved.startsWith(privateRegistryPrefix)) {
      entry.resolved = `https://registry.npmjs.org/${entry.resolved.slice(privateRegistryPrefix.length)}`;
      rewrittenCount += 1;
    }
  }
  return rewrittenCount;
}

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const lockPath = fileURLToPath(new URL("../package-lock.json", import.meta.url));
  const lock = JSON.parse(await readFile(lockPath, "utf8"));
  const rewrittenCount = normalizeLockfileRegistryUrls(lock);

  if (rewrittenCount > 0) {
    await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`, "utf8");
  }

  console.log(`Normalized ${rewrittenCount} private npm tarball URL${rewrittenCount === 1 ? "" : "s"} for GitHub Actions.`);
}
