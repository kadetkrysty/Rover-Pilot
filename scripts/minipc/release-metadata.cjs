"use strict";
const fs = require("node:fs");
const path = require("node:path");

const ASSETS = [
  "RoverOS-server-linux-x64.tar.gz",
  "RoverOS-server-linux-x64.tar.gz.sha256",
  "RoverOS-server-linux-x64.intoto.jsonl",
];
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
function compareVersions(a, b) {
  if (!VERSION.test(a) || !VERSION.test(b)) throw new Error("Invalid server version.");
  const right = b.split(".").map(Number);
  for (const [index, part] of a.split(".").map(Number).entries()) {
    if (part !== right[index]) return part > right[index] ? 1 : -1;
  }
  return 0;
}
function selectRelease(releases, repository) {
  if (!Array.isArray(releases) || !/^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[\w.-]+$/.test(repository) ||
      [".", ".."].includes(repository.split("/")[1])) {
    throw new Error("Invalid release source.");
  }
  const candidates = releases.filter((release) =>
    !release.draft && !release.prerelease &&
    typeof release.tag_name === "string" &&
    VERSION.test(release.tag_name.replace(/^roveros-server-v/, "")) &&
    release.tag_name.startsWith("roveros-server-v") &&
    Array.isArray(release.assets) &&
    ASSETS.every((name) => release.assets.some((asset) => asset.name === name)));
  candidates.sort((a, b) => compareVersions(
    b.tag_name.slice("roveros-server-v".length), a.tag_name.slice("roveros-server-v".length)));
  const selected = candidates[0];
  if (!selected) throw new Error("No signed RoverOS server release is available.");
  const urls = {};
  for (const name of ASSETS) {
    const asset = selected.assets.find((item) => item.name === name);
    const expected = `https://github.com/${repository}/releases/download/${selected.tag_name}/${name}`;
    if (asset.browser_download_url !== expected) throw new Error("Unexpected release asset URL.");
    urls[name] = expected;
  }
  return { tag: selected.tag_name, version: selected.tag_name.slice("roveros-server-v".length), urls };
}
function verifyManifest(manifest, version, installedVersion) {
  if (!manifest || manifest.schemaVersion !== 1 || manifest.product !== "RoverOS" ||
      manifest.architecture !== "x64" || manifest.operatingSystem !== "ubuntu-24.04" ||
      manifest.nodeMajor !== 22 || manifest.version !== version || !VERSION.test(version) ||
      !/^[a-f0-9]{40}$/i.test(manifest.sourceCommit || "")) {
    throw new Error("The release manifest is not compatible with this MiniPC.");
  }
  if (installedVersion && compareVersions(version, installedVersion) < 0) {
    throw new Error("Refusing to install an older RoverOS version.");
  }
}
module.exports = { ASSETS, compareVersions, selectRelease, verifyManifest };
if (require.main === module) {
  const [jsonFile, outDir, repository] = process.argv.slice(2);
  const release = selectRelease(JSON.parse(fs.readFileSync(jsonFile, "utf8")), repository);
  fs.writeFileSync(path.join(outDir, "release-tag"), release.tag);
  for (const [name, url] of Object.entries(release.urls)) {
    fs.writeFileSync(path.join(outDir, `${name}.url`), url);
  }
}
