import test from "node:test";
import assert from "node:assert/strict";
import { MAX_LOCAL_GLB_BYTES, validateLocalGlb } from "./localGlb";

function makeGlb(document: Record<string, unknown>): ArrayBuffer {
  const json = new TextEncoder().encode(JSON.stringify(document));
  const paddedLength = Math.ceil(json.length / 4) * 4;
  const totalLength = 12 + 8 + paddedLength;
  const buffer = new ArrayBuffer(totalLength);
  const view = new DataView(buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, totalLength, true);
  view.setUint32(12, paddedLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(buffer, 20, json.length).set(json);
  new Uint8Array(buffer, 20 + json.length, paddedLength - json.length).fill(0x20);
  return buffer;
}

test("accepts a self-contained GLB 2 document", () => {
  const parsed = validateLocalGlb(makeGlb({ asset: { version: "2.0" }, scenes: [{}] }));
  assert.equal(parsed.asset?.version, "2.0");
});

test("rejects invalid magic, version, and declared length", () => {
  const valid = makeGlb({ asset: { version: "2.0" } });
  const invalidMagic = valid.slice(0);
  new DataView(invalidMagic).setUint32(0, 0, true);
  assert.throws(() => validateLocalGlb(invalidMagic), /not a GLB/i);

  const invalidVersion = valid.slice(0);
  new DataView(invalidVersion).setUint32(4, 1, true);
  assert.throws(() => validateLocalGlb(invalidVersion), /version 2/i);

  const invalidLength = valid.slice(0);
  new DataView(invalidLength).setUint32(8, 1, true);
  assert.throws(() => validateLocalGlb(invalidLength), /declared length/i);
});

test("rejects external buffers and images before loading", () => {
  const bufferUri = makeGlb({
    asset: { version: "2.0" },
    buffers: [{ uri: "https://example.invalid/model.bin" }],
  });
  assert.throws(() => validateLocalGlb(bufferUri), /external files/i);

  const imageUri = makeGlb({
    asset: { version: "2.0" },
    images: [{ uri: "data:image/png;base64,AAAA" }],
  });
  assert.throws(() => validateLocalGlb(imageUri), /external files/i);
});

test("rejects malformed files and files over the local size limit", () => {
  assert.throws(() => validateLocalGlb(new ArrayBuffer(12)), /too small/i);
  const oversized = new ArrayBuffer(MAX_LOCAL_GLB_BYTES + 1);
  assert.throws(() => validateLocalGlb(oversized), /50 MB/i);
});
