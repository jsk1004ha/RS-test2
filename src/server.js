import http from "node:http";
import { createApp } from "./app.js";
import { readConfig } from "./config.js";
import { WriteDatabase } from "./database.js";

const config = readConfig();
const database = new WriteDatabase(config);
const server = http.createServer(createApp({ config, database }));

server.requestTimeout = 15000;
server.headersTimeout = 20000;
server.keepAliveTimeout = 5000;

server.listen(config.port, config.host, async () => {
  console.info(JSON.stringify({
    event: "server.started",
    host: config.host,
    port: config.port,
    databaseConfigured: database.configured,
    deploymentId: config.deploymentId,
  }));
  try {
    await database.initialize();
    console.info(JSON.stringify({ event: "database.schema.ready" }));
  } catch (error) {
    console.error(JSON.stringify({ event: "database.schema.failed", code: error.code || "DATABASE_UNAVAILABLE" }));
  }
});

let closing = false;
async function shutdown(signal) {
  if (closing) return;
  closing = true;
  console.info(JSON.stringify({ event: "server.shutdown", signal }));
  server.close(async () => {
    await database.close().catch(() => {});
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
