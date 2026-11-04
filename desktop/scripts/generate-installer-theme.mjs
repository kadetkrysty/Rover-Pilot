import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const desktopDirectory = resolve(scriptDirectory, "..");
const defaultCssPath = resolve(desktopDirectory, "..", "client/src/index.css");
const defaultOutputDirectory = resolve(desktopDirectory, "..", "generated-artifacts/installer-theme");

const REQUIRED_VARIABLES = {
  "--background": "BG",
  "--card": "PANEL",
  "--foreground": "TEXT",
  "--primary": "ACCENT",
  "--muted-foreground": "MUTED",
  "--border": "BORDER",
};

function parseHsl(value, variableName = "HSL value") {
  const channel = "([+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+))";
  const match = value.trim().match(
    new RegExp(`^(?:hsl\\(\\s*${channel}\\s+${channel}%\\s+${channel}%\\s*\\)|${channel}\\s+${channel}%\\s+${channel}%)$`, "i"),
  );
  if (!match) {
    throw new Error(`${variableName} must be a strict HSL triplet (for example: 180 100% 50%).`);
  }
  const values = match.slice(1).filter((part) => part !== undefined);
  const h = Number(values[0]);
  const s = Number(values[1]);
  const l = Number(values[2]);
  if (![h, s, l].every(Number.isFinite) || h < 0 || h > 360 || s < 0 || s > 100 || l < 0 || l > 100) {
    throw new Error(`${variableName} contains HSL values outside their valid ranges.`);
  }
  return [h, s / 100, l / 100];
}

export function hslToHex(value) {
  const [hue, saturation, lightness] = parseHsl(value);
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const h = hue / 60;
  const x = chroma * (1 - Math.abs((h % 2) - 1));
  let rgb;
  if (h < 1) rgb = [chroma, x, 0];
  else if (h < 2) rgb = [x, chroma, 0];
  else if (h < 3) rgb = [0, chroma, x];
  else if (h < 4) rgb = [0, x, chroma];
  else if (h < 5) rgb = [x, 0, chroma];
  else rgb = [chroma, 0, x];
  const offset = lightness - chroma / 2;
  return `#${rgb.map((channel) => Math.round((channel + offset) * 255).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

function readRootDeclarations(css) {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rootMatch = withoutComments.match(/:root\s*\{([\s\S]*?)\}/);
  if (!rootMatch) throw new Error("Could not find a :root declaration block in the application CSS.");
  const declarations = new Map();
  for (const declaration of rootMatch[1].split(";")) {
    const separator = declaration.indexOf(":");
    if (separator < 0) continue;
    const name = declaration.slice(0, separator).trim();
    if (name.startsWith("--")) declarations.set(name, declaration.slice(separator + 1).trim());
  }
  return declarations;
}

function toRgb(hex) {
  return [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));
}

function bgrHex(hex) {
  return toRgb(hex).reverse().map((channel) => channel.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function createPalette(css) {
  const declarations = readRootDeclarations(css);
  const palette = {};
  for (const [cssName, outputName] of Object.entries(REQUIRED_VARIABLES)) {
    const value = declarations.get(cssName);
    if (!value) throw new Error(`Required CSS color declaration ${cssName} is missing from :root.`);
    try {
      palette[outputName] = hslToHex(value);
    } catch (error) {
      throw new Error(`Invalid ${cssName} declaration: ${error.message}`);
    }
  }
  return palette;
}

const GLYPHS = {
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  N: ["10001", "11001", "11001", "10101", "10011", "10011", "10001"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
};

function makeBitmap(width, height, palette, painter) {
  const rowBytes = width * 3;
  const stride = Math.ceil(rowBytes / 4) * 4;
  const pixelBytes = stride * height;
  const buffer = Buffer.alloc(54 + pixelBytes);
  buffer.write("BM", 0, "ascii");
  buffer.writeUInt32LE(buffer.length, 2);
  buffer.writeUInt32LE(54, 10);
  buffer.writeUInt32LE(40, 14);
  buffer.writeInt32LE(width, 18);
  buffer.writeInt32LE(height, 22);
  buffer.writeUInt16LE(1, 26);
  buffer.writeUInt16LE(24, 28);
  buffer.writeUInt32LE(0, 30);
  buffer.writeUInt32LE(pixelBytes, 34);
  buffer.writeInt32LE(2835, 38);
  buffer.writeInt32LE(2835, 42);

  const colors = Object.fromEntries(Object.entries(palette).map(([key, value]) => [key, toRgb(value)]));
  const pixel = (x, y, color) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const offset = 54 + (height - 1 - y) * stride + x * 3;
    const [r, g, b] = typeof color === "string" ? colors[color] : color;
    buffer[offset] = b;
    buffer[offset + 1] = g;
    buffer[offset + 2] = r;
  };
  const rect = (x, y, w, h, color) => {
    for (let py = y; py < y + h; py++) for (let px = x; px < x + w; px++) pixel(px, py, color);
  };
  const line = (x1, y1, x2, y2, color) => {
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1;
    const sy = y1 < y2 ? 1 : -1;
    let error = dx - dy;
    while (true) {
      pixel(x1, y1, color);
      if (x1 === x2 && y1 === y2) break;
      const twice = 2 * error;
      if (twice > -dy) { error -= dy; x1 += sx; }
      if (twice < dx) { error += dx; y1 += sy; }
    }
  };
  const text = (label, x, y, scale, color, gap = scale) => {
    let cursor = x;
    for (const character of label) {
      const glyph = GLYPHS[character];
      if (character === " ") { cursor += 4 * scale; continue; }
      if (!glyph) throw new Error(`Unsupported installer artwork glyph: ${character}`);
      glyph.forEach((row, rowIndex) => {
        for (let column = 0; column < row.length; column++) {
          if (row[column] === "1") rect(cursor + column * scale, y + rowIndex * scale, scale, scale, color);
        }
      });
      cursor += 5 * scale + gap;
    }
    return cursor;
  };

  painter({ width, height, pixel, rect, line, text, colors });
  return buffer;
}

function makeHeaderBitmap(palette) {
  return makeBitmap(150, 57, palette, ({ width, height, rect, line, text }) => {
    rect(0, 0, width, height, "BG");
    rect(5, 5, width - 10, height - 10, "PANEL");
    line(0, 0, 22, 0, "ACCENT");
    line(0, 0, 0, 17, "ACCENT");
    line(width - 1, height - 1, width - 23, height - 1, "ACCENT");
    line(width - 1, height - 1, width - 1, height - 18, "ACCENT");
    line(11, 43, width - 12, 43, "BORDER");
    rect(12, 48, 3, 3, "ACCENT");
    text("ROVER", 13, 15, 3, "ACCENT", 1);
    text("OS", 100, 19, 2, "TEXT", 2);
  });
}

function makeSidebarBitmap(palette) {
  return makeBitmap(164, 314, palette, ({ width, height, rect, line, text }) => {
    rect(0, 0, width, height, "BG");
    rect(5, 5, width - 10, height - 10, "PANEL");
    line(0, 0, 26, 0, "ACCENT");
    line(0, 0, 0, 23, "ACCENT");
    line(width - 1, height - 1, width - 27, height - 1, "ACCENT");
    line(width - 1, height - 1, width - 1, height - 24, "ACCENT");
    text("ROVER", 15, 18, 3, "ACCENT", 2);
    text("OS", 109, 22, 2, "TEXT", 1);
    line(13, 47, width - 13, 47, "BORDER");
    text("TACTICAL", 15, 58, 2, "MUTED", 1);
    text("CONTROL", 15, 77, 2, "MUTED", 1);

    // Compact rover silhouette framed as a restrained navigation HUD.
    line(35, 136, 128, 136, "BORDER");
    line(35, 136, 48, 119, "ACCENT");
    line(48, 119, 112, 119, "ACCENT");
    line(112, 119, 128, 136, "ACCENT");
    line(48, 119, 55, 99, "BORDER");
    line(55, 99, 91, 99, "ACCENT");
    line(91, 99, 106, 119, "ACCENT");
    line(60, 106, 77, 106, "MUTED");
    line(60, 111, 77, 111, "MUTED");
    line(85, 99, 92, 86, "ACCENT");
    line(92, 86, 100, 86, "ACCENT");
    rect(39, 137, 18, 8, "BORDER");
    rect(107, 137, 18, 8, "BORDER");
    rect(43, 140, 10, 2, "ACCENT");
    rect(111, 140, 10, 2, "ACCENT");
    line(20, 154, 20, 172, "ACCENT");
    line(20, 154, 33, 154, "ACCENT");
    line(143, 154, 143, 172, "ACCENT");
    line(130, 154, 143, 154, "ACCENT");

    line(14, 187, width - 14, 187, "BORDER");
    text("STATUS", 15, 200, 2, "ACCENT", 2);
    rect(15, 221, 7, 7, "ACCENT");
    text("CLIENT", 29, 221, 1, "TEXT", 1);
    line(14, 243, width - 14, 243, "BORDER");
    text("NAV LINK", 15, 257, 1, "MUTED", 1);
    line(15, 279, 149, 279, "BORDER");
    line(15, 286, 112, 286, "BORDER");
    line(15, 293, 132, 293, "BORDER");
    rect(15, 301, 3, 3, "ACCENT");
  });
}

function makeInstallerIcon(palette) {
  const sizes = [16, 32, 48];
  const images = sizes.map(size => {
    const scale = Math.max(1, Math.floor(size / 10));
    const bitmap = makeBitmap(size, size, palette, ({ text }) => {
      text("R", Math.floor((size - 5 * scale) / 2), Math.floor((size - 7 * scale) / 2), scale, "ACCENT");
    });
    const dib = Buffer.from(bitmap.subarray(14));
    const mask = Buffer.alloc(Math.ceil(size / 32) * 4 * size);
    dib.writeInt32LE(size * 2, 8);
    dib.writeUInt32LE(dib.length - 40 + mask.length, 20);
    return Buffer.concat([dib, mask]);
  });
  const directory = Buffer.alloc(6 + sizes.length * 16);
  directory.writeUInt16LE(1, 2);
  directory.writeUInt16LE(sizes.length, 4);
  let offset = directory.length;
  sizes.forEach((size, index) => {
    const entry = 6 + index * 16;
    directory[entry] = size;
    directory[entry + 1] = size;
    directory.writeUInt16LE(1, entry + 4);
    directory.writeUInt16LE(24, entry + 6);
    directory.writeUInt32LE(images[index].length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += images[index].length;
  });
  return Buffer.concat([directory, ...images]);
}

export async function generateTheme({ cssPath = defaultCssPath, outputDir = defaultOutputDirectory } = {}) {
  const css = await readFile(cssPath, "utf8");
  const palette = createPalette(css);
  const definitions = Object.entries(palette)
    .map(([key, hex]) => `!define ROVER_${key} "${hex.slice(1)}"`)
    .join("\n");
  const themeNsh = [
    "; Generated by scripts/generate-installer-theme.mjs. Do not edit by hand.",
    definitions,
    `!define ROVER_BG_WIN32 "${bgrHex(palette.BG)}"`,
    `!define ROVER_ACCENT_WIN32 "${bgrHex(palette.ACCENT)}"`,
    "",
  ].join("\n");
  const metadata = {
    source: "client/src/index.css :root",
    colorSpace: "sRGB",
    palette: Object.fromEntries(Object.entries(palette).map(([name, hex]) => [name, hex])),
    bitmaps: {
      "header.bmp": { width: 150, height: 57, bitsPerPixel: 24, compression: "BI_RGB" },
      "sidebar.bmp": { width: 164, height: 314, bitsPerPixel: 24, compression: "BI_RGB" },
    },
  };

  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    writeFile(resolve(outputDir, "theme.nsh"), themeNsh, "utf8"),
    writeFile(resolve(outputDir, "theme.json"), `${JSON.stringify(metadata, null, 2)}\n`, "utf8"),
    writeFile(resolve(outputDir, "header.bmp"), makeHeaderBitmap(palette)),
    writeFile(resolve(outputDir, "sidebar.bmp"), makeSidebarBitmap(palette)),
    writeFile(resolve(outputDir, "installer.ico"), makeInstallerIcon(palette)),
  ]);
  return { palette, outputDir };
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  generateTheme().then(({ outputDir }) => {
    console.log(`Installer theme generated: ${outputDir}`);
  }).catch((error) => {
    console.error(`Unable to generate installer theme: ${error.message}`);
    process.exitCode = 1;
  });
}
