import test from "node:test";
import assert from "node:assert/strict";
import { getMapsConfig, saveMapsConfig } from "./mapsConfig";

test("offline Demo refuses live Maps configuration reads and writes", async () => {
  const previous = globalThis.window;
  let calls = 0;
  globalThis.window = {
    location: { search: "?demo=1", protocol: "https:", origin: "https://demo.invalid" },
    fetch: async () => { calls++; throw new Error("No network call allowed"); },
  } as unknown as Window & typeof globalThis;
  try {
    await assert.rejects(getMapsConfig(), /disabled in offline demo/);
    await assert.rejects(saveMapsConfig(""), /cannot be changed in offline demo/);
    assert.equal(calls, 0);
  } finally { globalThis.window = previous; }
});
