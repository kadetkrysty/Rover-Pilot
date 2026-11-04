import assert from "node:assert/strict";
import test from "node:test";
import { getDiscoveredRoverUrl } from "./discoveredServer";

const validCandidate = {
  serviceName: "RoverOS-Server",
  serviceType: "_http._tcp.",
  host: "192.168.1.40",
  port: 5000,
  marker: "1",
};

test("builds a URL only for the advertised RoverOS server on a local address", () => {
  assert.equal(
    getDiscoveredRoverUrl(validCandidate),
    "http://192.168.1.40:5000",
  );
});

test("rejects unrelated services, ports, and public addresses", () => {
  assert.equal(
    getDiscoveredRoverUrl({ ...validCandidate, serviceName: "printer" }),
    null,
  );
  assert.equal(
    getDiscoveredRoverUrl({ ...validCandidate, port: 8080 }),
    null,
  );
  assert.equal(
    getDiscoveredRoverUrl({ ...validCandidate, host: "203.0.113.12" }),
    null,
  );
  assert.equal(
    getDiscoveredRoverUrl({ ...validCandidate, serviceType: "_ssh._tcp." }),
    null,
  );
  assert.equal(
    getDiscoveredRoverUrl({ ...validCandidate, marker: "wrong" }),
    null,
  );
});

test("rejects malformed and non-IPv4 discovery data", () => {
  for (const host of [
    "127.0.0.1",
    "192.168.1.999",
    "192.168.001.40",
    "RoverOS-Server.local",
    "::1",
  ]) {
    assert.equal(getDiscoveredRoverUrl({ ...validCandidate, host }), null);
  }
  assert.equal(getDiscoveredRoverUrl(null), null);
});
