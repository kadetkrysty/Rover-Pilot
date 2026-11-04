const { test } = require("node:test");
const assert = require("node:assert/strict");
const { build } = require("../package.json");
const testBuild = require("./electron-builder.test.cjs");

test("production requires signing while test installers have an isolated identity", () => {
  assert.equal(build.forceCodeSigning, true);
  assert.equal(testBuild.forceCodeSigning, false);
  assert.notEqual(testBuild.appId, build.appId);
  assert.notEqual(testBuild.productName, build.productName);
  assert.match(testBuild.win.artifactName, /Test-UNSIGNED/);
  assert.match(testBuild.nsis.shortcutName, /Unsigned/);
  assert.ok(testBuild.files.includes("desktop/provisioning-request.cjs"));
});
