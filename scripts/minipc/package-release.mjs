import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";

const root = process.cwd();
const output = path.join(root, "generated-artifacts/server-release");
const staging = path.join(output, "bundle");
const pkg = JSON.parse(await readFile("package.json", "utf8"));
const tag = process.env.GITHUB_REF_TYPE === "tag" ? process.env.GITHUB_REF_NAME : "";
const version = tag ? tag.replace(/^roveros-server-v/, "") : pkg.version;
if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
  throw new Error("Server release tags must use roveros-server-vMAJOR.MINOR.PATCH.");
}
await rm(output, { recursive: true, force: true });
await mkdir(staging, { recursive: true });
for (const file of ["dist", "migrations", "deploy/avahi/roveros.service",
  "deploy/systemd/roveros-control.service", "scripts/minipc/install-control.sh",
  "firmware/mini_pc_master/control_core.py", "firmware/mini_pc_master/secure_control_daemon.py",
  "firmware/arduino_mega_sensor_controller/arduino_mega_sensor_controller.ino",
  "firmware/arduino_mega_sensor_controller/feru_protocol.h", "docs/ROVEROS_DRIVE_CONTROL.md"]) {
  await mkdir(path.dirname(path.join(staging, file)), { recursive: true });
  await cp(file, path.join(staging, file), { recursive: true });
}
await writeFile(path.join(staging, "release-manifest.json"), JSON.stringify({
  schemaVersion: 1,
  product: "RoverOS",
  version,
  architecture: "x64",
  operatingSystem: "ubuntu-24.04",
  nodeMajor: 22,
  sourceCommit: process.env.GITHUB_SHA || null,
}, null, 2) + "\n");
const name = "RoverOS-server-linux-x64.tar.gz";
execFileSync("tar", ["-C", staging, "-czf", path.join(output, name), "."]);
const digest = createHash("sha256").update(await readFile(path.join(output, name))).digest("hex");
await writeFile(path.join(output, `${name}.sha256`), `${digest}  ${name}\n`);
await rm(staging, { recursive: true, force: true });
console.log(`Prebuilt MiniPC release: ${path.relative(root, output)}/${name}`);
