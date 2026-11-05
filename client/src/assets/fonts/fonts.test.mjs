import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

const fontsDirectory = path.dirname(fileURLToPath(import.meta.url));

test("bundled fonts and their OFL notices are complete and self-hosted", async () => {
  const fontCss = await readFile(path.join(fontsDirectory, "fonts.css"), "utf8");
  const appHtml = await readFile(
    path.join(fontsDirectory, "../../../index.html"),
    "utf8",
  );

  assert.match(fontCss, /font-family:\s*"Rajdhani"/);
  assert.match(fontCss, /font-family:\s*"JetBrains Mono"/);
  assert.match(fontCss, /font-family:\s*"Orbitron"/);
  assert.doesNotMatch(appHtml, /fonts\.(?:googleapis|gstatic)\.com/i);

  const assetNames = [...fontCss.matchAll(/url\(["']?\.\/([^"')]+)/g)].map(
    (match) => match[1],
  );
  assert.equal(assetNames.length, 5, "Each declared font must be bundled");

  for (const asset of assetNames) {
    const data = await readFile(path.join(fontsDirectory, asset));
    assert.equal(data.toString("ascii", 0, 4), "wOF2", `${asset} must be WOFF2`);
    assert.ok(data.byteLength > 500, `${asset} must not be empty or truncated`);
  }

  for (const notice of [
    "OFL-RAJDHANI.txt",
    "OFL-ORBITRON.txt",
    "OFL-JETBRAINS-MONO.txt",
  ]) {
    const text = await readFile(path.join(fontsDirectory, notice), "utf8");
    assert.match(text, /SIL Open Font License, Version 1\.1/i);
  }
});
