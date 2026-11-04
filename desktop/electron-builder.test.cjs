// Test packaging only. Production packaging retains mandatory code signing.
const { build } = require("../package.json");

module.exports = {
  ...build,
  appId: `${build.appId}.test`,
  productName: "RoverOS Test",
  forceCodeSigning: false,
  win: {
    ...build.win,
    artifactName: "RoverOS-Test-UNSIGNED-${version}-${arch}.${ext}",
  },
  nsis: {
    ...build.nsis,
    shortcutName: "RoverOS Test (Unsigned)",
    uninstallDisplayName: "RoverOS Test (Unsigned)",
  },
};
