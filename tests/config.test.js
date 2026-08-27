import assert from "node:assert/strict";
import test from "node:test";
import { readConfig } from "../src/config.js";

test("uses RaibitServer runtime deployment metadata", () => {
  const config = readConfig({
    RAIBITSERVER_GIT_SHA: "112240534df5754dbc6c70311ecfc9dfe3f28388",
    RAIBITSERVER_DEPLOYMENT_ID: "deployment-1",
    HOSTNAME: "pod-1",
    DATABASE_URL: "postgresql://example.invalid/test",
  });

  assert.equal(config.commitSha, "112240534df5754dbc6c70311ecfc9dfe3f28388");
  assert.equal(config.deploymentId, "deployment-1");
  assert.equal(config.podName, "pod-1");
  assert.equal(config.databaseUrl, "postgresql://example.invalid/test");
});
