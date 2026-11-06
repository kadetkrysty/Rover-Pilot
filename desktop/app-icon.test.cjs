const { test } = require("node:test");
const assert = require("node:assert/strict");
const { existsSync, readFileSync } = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function assertPngSize(file, size) {
  const png = readFileSync(file);
  assert.deepEqual(png.subarray(0, 8), pngSignature, `${file} is a PNG`);
  assert.equal(png.readUInt32BE(16), size, `${file} width`);
  assert.equal(png.readUInt32BE(20), size, `${file} height`);
}

test("web and Android app icons use the bundled RoverOS rover artwork", () => {
  const manifestPath = path.join(root, "client/public/manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  for (const icon of manifest.icons) {
    if (!icon.src.startsWith("/icons/roveros-app-icon-")) continue;
    assert.equal(icon.type, "image/png");
    assert.ok(existsSync(path.join(root, "client/public", icon.src.slice(1))), icon.src);
    assert.match(
      readFileSync(path.join(root, "client/public/service-worker.js"), "utf8"),
      new RegExp(icon.src.replaceAll("/", "\\/")),
      `${icon.src} is cached for offline use`,
    );
  }
  assert.match(readFileSync(path.join(root, "client/index.html"), "utf8"), /apple-touch-icon\.png/);
  assertPngSize(path.join(root, "client/public/favicon.png"), 128);
  assertPngSize(path.join(root, "client/public/apple-touch-icon.png"), 180);

  const androidManifest = readFileSync(
    path.join(root, "android/app/src/main/AndroidManifest.xml"),
    "utf8",
  );
  assert.match(androidManifest, /android:icon="@mipmap\/ic_launcher"/);
  assert.match(androidManifest, /android:roundIcon="@mipmap\/ic_launcher_round"/);
  for (const [density, pixels] of [
    ["ldpi", 36],
    ["mdpi", 48],
    ["hdpi", 72],
    ["xhdpi", 96],
    ["xxhdpi", 144],
    ["xxxhdpi", 192],
  ]) {
    const folder = path.join(root, `android/app/src/main/res/mipmap-${density}`);
    assertPngSize(path.join(folder, "ic_launcher.png"), pixels);
    assertPngSize(path.join(folder, "ic_launcher_round.png"), pixels);
  }
  assert.ok(existsSync(path.join(
    root,
    "android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml",
  )));
  assert.ok(existsSync(path.join(
    root,
    "android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml",
  )));
});

test("Windows uses a multi-size rover icon with valid BMP-backed entries", () => {
  const ico = readFileSync(path.join(root, "desktop/assets/roveros.ico"));
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
  const count = ico.readUInt16LE(4);
  const sizes = new Set();
  for (let index = 0; index < count; index++) {
    const entry = 6 + index * 16;
    const size = ico[entry] || 256;
    sizes.add(size);
    const byteCount = ico.readUInt32LE(entry + 8);
    const offset = ico.readUInt32LE(entry + 12);
    const headerSize = ico.readUInt32LE(offset);
    assert.ok(headerSize >= 40, `${size}px ICO entry contains a DIB header`);
    assert.equal(ico.readInt32LE(offset + 4), size, `${size}px ICO image width`);
    assert.equal(ico.readInt32LE(offset + 8), size * 2, `${size}px ICO image and mask height`);
    assert.ok(ico.readUInt16LE(entry + 6) >= 24, `${size}px ICO color depth`);
    assert.ok(byteCount >= headerSize);
    assert.ok(offset + byteCount <= ico.length);
  }
  for (const size of [16, 32, 48, 64, 128, 256]) {
    assert.ok(sizes.has(size), `Windows icon includes ${size}px artwork`);
  }
  assert.match(readFileSync(path.join(root, "desktop/main.cjs"), "utf8"), /assets", "roveros\.ico"/);
});
