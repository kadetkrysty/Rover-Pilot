import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { generateTheme, hslToHex } from "./generate-installer-theme.mjs";

const cssPath = resolve(import.meta.dirname ?? new URL(".", import.meta.url).pathname, "../../client/src/index.css");

async function withTempDirectory(callback) {
  const directory = await mkdtemp(join(tmpdir(), "roveros-installer-theme-"));
  try {
    await callback(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("converts strict HSL values to RGB hex", () => {
  assert.equal(hslToHex("180 100% 50%"), "#00FFFF");
  assert.equal(hslToHex("220 40% 10%"), "#0F1624");
  assert.throws(() => hslToHex("180 101% 50%"), /outside their valid ranges/);
  assert.throws(() => hslToHex("cyan"), /strict HSL triplet/);
});

test("generates palette metadata, NSIS definitions and 24-bit Windows bitmaps", async () => {
  await withTempDirectory(async (directory) => {
    const outputDir = join(directory, "artifacts");
    const { palette } = await generateTheme({ cssPath, outputDir });
    assert.equal(palette.ACCENT, "#00FFFF");
    assert.equal(palette.BG, hslToHex("220 40% 10%"));

    const nsis = await readFile(join(outputDir, "theme.nsh"), "utf8");
    for (const name of ["BG", "PANEL", "TEXT", "ACCENT", "MUTED", "BORDER"]) {
      assert.match(nsis, new RegExp(`!define ROVER_${name} "[0-9A-F]{6}"`));
    }
    assert.match(nsis, /!define ROVER_ACCENT_WIN32 "FFFF00"/);
    assert.match(nsis, /!define ROVER_BG_WIN32 "[0-9A-F]{6}"/);

    const metadata = JSON.parse(await readFile(join(outputDir, "theme.json"), "utf8"));
    const icon = await readFile(join(outputDir, "installer.ico"));
    assert.equal(icon.readUInt16LE(2), 1);
    assert.equal(icon.readUInt16LE(4), 3);
    assert.equal(metadata.palette.ACCENT, "#00FFFF");
    assert.deepEqual(metadata.bitmaps["header.bmp"], {
      width: 150, height: 57, bitsPerPixel: 24, compression: "BI_RGB",
    });
    assert.deepEqual(metadata.bitmaps["sidebar.bmp"], {
      width: 164, height: 314, bitsPerPixel: 24, compression: "BI_RGB",
    });

    for (const [file, width, height] of [["header.bmp", 150, 57], ["sidebar.bmp", 164, 314]]) {
      const bitmap = await readFile(join(outputDir, file));
      assert.equal(bitmap.toString("ascii", 0, 2), "BM");
      assert.equal(bitmap.readUInt32LE(2), bitmap.length);
      assert.equal(bitmap.readUInt32LE(10), 54);
      assert.equal(bitmap.readUInt32LE(14), 40);
      assert.equal(bitmap.readInt32LE(18), width);
      assert.equal(bitmap.readInt32LE(22), height);
      assert.equal(bitmap.readUInt16LE(26), 1);
      assert.equal(bitmap.readUInt16LE(28), 24);
      assert.equal(bitmap.readUInt32LE(30), 0);
      assert.equal(bitmap.length, 54 + Math.ceil((width * 3) / 4) * 4 * height);
    }
  });
});

test("regeneration reflects CSS color edits and rejects missing or invalid colors", async () => {
  await withTempDirectory(async (directory) => {
    const customCss = join(directory, "index.css");
    const outputDir = join(directory, "out");
    const original = await readFile(cssPath, "utf8");
    await writeFile(customCss, original);
    await generateTheme({ cssPath: customCss, outputDir });
    await writeFile(customCss, original.replace("--primary: 180 100% 50%;", "--primary: 120 100% 50%;"));
    const regenerated = await generateTheme({ cssPath: customCss, outputDir });
    assert.equal(regenerated.palette.ACCENT, "#00FF00");
    assert.match(await readFile(join(outputDir, "theme.nsh"), "utf8"), /!define ROVER_ACCENT "00FF00"/);

    await writeFile(customCss, original.replace("--border: 215 30% 20%;", ""));
    await assert.rejects(generateTheme({ cssPath: customCss, outputDir }), /--border is missing/);
    await writeFile(customCss, original.replace("--primary: 180 100% 50%;", "--primary: 180 140% 50%;"));
    await assert.rejects(generateTheme({ cssPath: customCss, outputDir }), /Invalid --primary declaration/);
  });
});
