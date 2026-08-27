import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PUBLIC_DIRECTORY = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
const STATIC_FILES = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
]);

export function createApp({ config, database, logger = console }) {
  return async function app(request, response) {
    const requestId = safeIdentifier(request.headers["x-request-id"]) || randomUUID();
    const startedAt = performance.now();
    setHeaders(response, requestId);

    response.on("finish", () => {
      logger.info(JSON.stringify({
        event: "http.request.completed",
        requestId,
        method: request.method,
        path: String(request.url || "/").split("?", 1)[0],
        statusCode: response.statusCode,
        durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
      }));
    });

    try {
      const url = new URL(request.url || "/", "http://localhost");
      const method = request.method || "GET";

      if ((method === "GET" || method === "HEAD") && STATIC_FILES.has(url.pathname)) {
        const [filename, contentType] = STATIC_FILES.get(url.pathname);
        const body = await readFile(path.join(PUBLIC_DIRECTORY, filename));
        response.statusCode = 200;
        response.setHeader("content-type", contentType);
        response.setHeader("cache-control", "no-cache");
        response.end(method === "HEAD" ? undefined : body);
        return;
      }

      if (method === "GET" && url.pathname === "/healthz/live") {
        return sendJson(response, 200, { ok: true, check: "liveness" });
      }

      if (method === "GET" && url.pathname === "/healthz/ready") {
        const status = await database.check();
        return sendJson(response, 200, { ok: true, check: "readiness", database: status });
      }

      if (method === "GET" && url.pathname === "/api/info") {
        const [databaseStatus, count] = await Promise.all([database.check(), database.count()]);
        return sendJson(response, 200, {
          ok: true,
          database: { ...databaseStatus, count },
          release: {
            commitSha: config.commitSha,
            deploymentId: config.deploymentId,
            podName: config.podName,
            buildTime: config.buildTime,
          },
        });
      }

      if (method === "GET" && url.pathname === "/api/writes") {
        const writes = await database.list(url.searchParams.get("limit"));
        return sendJson(response, 200, { ok: true, writes });
      }

      if (method === "POST" && url.pathname === "/api/writes") {
        assertSameOrigin(request);
        const body = await readJson(request);
        const message = normalizeMessage(body.message);
        const write = await database.create(message, requestId);
        return sendJson(response, 201, { ok: true, write });
      }

      return sendJson(response, 404, { ok: false, code: "NOT_FOUND" });
    } catch (error) {
      const code = safeErrorCode(error);
      const status = code === "INVALID_MESSAGE" || code === "INVALID_JSON" ? 400
        : code === "CROSS_ORIGIN_WRITE_BLOCKED" ? 403
          : code === "REQUEST_TOO_LARGE" ? 413
            : 503;
      logger.error(JSON.stringify({ event: "request.failed", requestId, code }));
      return sendJson(response, status, { ok: false, code });
    }
  };
}

function setHeaders(response, requestId) {
  response.setHeader("x-request-id", requestId);
  response.setHeader("x-content-type-options", "nosniff");
  response.setHeader("referrer-policy", "no-referrer");
  response.setHeader("content-security-policy", "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'");
}

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  let bytes = 0;
  const chunks = [];
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > 4096) {
      const error = new Error("request too large");
      error.code = "REQUEST_TOO_LARGE";
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    const error = new Error("invalid JSON");
    error.code = "INVALID_JSON";
    throw error;
  }
}

function normalizeMessage(value) {
  const message = typeof value === "string" ? value.trim() : "";
  if (!message || message.length > 120 || /[\u0000-\u001f\u007f]/u.test(message)) {
    const error = new Error("message must be 1 to 120 printable characters");
    error.code = "INVALID_MESSAGE";
    throw error;
  }
  return message;
}

function assertSameOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return;
  const host = request.headers["x-forwarded-host"] || request.headers.host;
  if (!host || new URL(origin).host !== String(host).split(",", 1)[0].trim()) {
    const error = new Error("cross-origin write blocked");
    error.code = "CROSS_ORIGIN_WRITE_BLOCKED";
    throw error;
  }
}

function safeIdentifier(value) {
  const candidate = typeof value === "string" ? value.trim() : "";
  return /^[A-Za-z0-9._:-]{1,80}$/.test(candidate) ? candidate : "";
}

function safeErrorCode(error) {
  const candidate = typeof error?.code === "string" ? error.code : "DATABASE_UNAVAILABLE";
  return /^[A-Z0-9_]{2,40}$/.test(candidate) ? candidate : "DATABASE_UNAVAILABLE";
}
