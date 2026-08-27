import assert from "node:assert/strict";
import http from "node:http";
import { after, before, test } from "node:test";
import { createApp } from "../src/app.js";

const rows = [];
const database = {
  async check() { return { ok: true, latencyMs: 1, serverTime: new Date().toISOString() }; },
  async count() { return rows.length; },
  async list() { return [...rows].reverse(); },
  async create(message, requestId) {
    const row = {
      id: rows.length + 1,
      message,
      requestId,
      deploymentId: "dep-test",
      commitSha: "abc123",
      podName: "pod-test",
      createdAt: new Date().toISOString(),
    };
    rows.push(row);
    return row;
  },
};

const config = { commitSha: "abc123", deploymentId: "dep-test", podName: "pod-test", buildTime: "test" };
let server;
let origin;

before(async () => {
  server = http.createServer(createApp({ config, database, logger: { info() {}, error() {} } }));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});

after(async () => new Promise((resolve) => server.close(resolve)));

test("liveness and readiness are healthy", async () => {
  assert.equal((await fetch(`${origin}/healthz/live`)).status, 200);
  const ready = await fetch(`${origin}/healthz/ready`).then((response) => response.json());
  assert.equal(ready.database.ok, true);
});

test("writes a record and reads it back", async () => {
  const writeResponse = await fetch(`${origin}/api/writes`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-request-id": "test-write-1" },
    body: JSON.stringify({ message: "Raibit PostgreSQL write" }),
  });
  assert.equal(writeResponse.status, 201);
  const created = await writeResponse.json();
  assert.equal(created.write.message, "Raibit PostgreSQL write");

  const listed = await fetch(`${origin}/api/writes`).then((response) => response.json());
  assert.equal(listed.writes[0].requestId, "test-write-1");
});

test("rejects invalid and cross-origin writes", async () => {
  const invalid = await fetch(`${origin}/api/writes`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: "" }),
  });
  assert.equal(invalid.status, 400);

  const crossOrigin = await fetch(`${origin}/api/writes`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://example.com" },
    body: JSON.stringify({ message: "blocked" }),
  });
  assert.equal(crossOrigin.status, 403);
});
