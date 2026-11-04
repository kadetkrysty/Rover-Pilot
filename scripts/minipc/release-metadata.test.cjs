const { test } = require("node:test");
const assert = require("node:assert/strict");
const { ASSETS, compareVersions, selectRelease, verifyManifest } = require("./release-metadata.cjs");
const repo = "example/rover";
function release(version) {
  const tag_name = `roveros-server-v${version}`;
  return { tag_name, draft: false, prerelease: false, assets: ASSETS.map((name) => ({
    name, browser_download_url: `https://github.com/${repo}/releases/download/${tag_name}/${name}`,
  })) };
}
test("selects the newest signed server bundle, not the latest Android release", () => {
  assert.equal(selectRelease([
    { tag_name: "roveros-android-v1.0.99", assets: [] },
    release("1.9.0"), release("1.10.0"), { ...release("9.0.0"), prerelease: true },
  ], repo).version, "1.10.0");
  assert.equal(compareVersions("1.0.0", "1.0.0"), 0);
});
test("missing signature bundles and off-repository download URLs fail closed", () => {
  assert.throws(() => selectRelease([{ ...release("1.0.0"), assets: [] }], repo), /No signed/);
  const malicious = release("1.0.0");
  malicious.assets[0].browser_download_url = "https://attacker.invalid/file.tar.gz";
  assert.throws(() => selectRelease([malicious], repo), /Unexpected/);
  assert.throws(() => selectRelease([], "../bad"), /Invalid/);
});
test("manifest binds architecture, OS, runtime, version and source; downgrades are rejected", () => {
  const manifest = {
    schemaVersion: 1, product: "RoverOS", version: "1.2.0", architecture: "x64",
    operatingSystem: "ubuntu-24.04", nodeMajor: 22, sourceCommit: "a".repeat(40),
  };
  verifyManifest(manifest, "1.2.0", "1.1.0");
  for (const change of [{ architecture: "arm64" }, { nodeMajor: 20 }, { operatingSystem: "ubuntu-core" }, { sourceCommit: null }]) {
    assert.throws(() => verifyManifest({ ...manifest, ...change }, "1.2.0"));
  }
  assert.throws(() => verifyManifest(manifest, "1.2.0", "2.0.0"), /older/);
});
