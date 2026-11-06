const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
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
  assert.ok(testBuild.files.includes("dist/public/**/*"), "Offline demo assets must ship inside the installer");
  assert.equal(build.win.icon, "desktop/assets/roveros.ico");
  assert.equal(build.nsis.installerIcon, build.win.icon);
  assert.equal(build.nsis.uninstallerIcon, build.win.icon);
  assert.equal(testBuild.nsis.include, "desktop/installer/theme.nsh");
  assert.equal(testBuild.nsis.uninstallerSidebar, build.nsis.installerSidebar);
  assert.equal(testBuild.nsis.installerIcon, testBuild.nsis.uninstallerIcon);
});

test("native installer labels and progress track use the dark theme", () => {
  const theme = readFileSync(`${__dirname}/installer/theme.nsh`, "utf8");

  // Group boxes (BS_GROUPBOX = 7) must opt out of Windows' default black label text.
  assert.match(theme, /\$\{OrIf\} \$2 == 7[\s\S]*?SetWindowTheme\(p r0, w" ", w" "\)/);
  // Disable visual styling so the progress track honors the dark background color.
  assert.match(theme, /msctls_progress32[\s\S]*?SetWindowTheme\(p r0, w" ", w" "\)[\s\S]*?0x2001/);
});
