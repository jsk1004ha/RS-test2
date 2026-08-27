function integer(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, parsed));
}

export function readConfig(env = process.env) {
  return {
    host: env.HOST || "0.0.0.0",
    port: integer(env.PORT, 3000, 1, 65535),
    databaseUrl: env.DATABASE_URL || env.POSTGRES_URL || env.POSTGRESQL_URL || "",
    databaseConnectTimeoutMs: integer(env.DATABASE_CONNECT_TIMEOUT_MS, 5000, 1000, 15000),
    commitSha: env.RAIBITSERVER_GIT_SHA || env.RAIBITSERVER_GIT_COMMIT_SHA || env.COMMIT_SHA || "unknown",
    deploymentId: env.RAIBITSERVER_DEPLOYMENT_ID || env.DEPLOYMENT_ID || "unknown",
    podName: env.HOSTNAME || "local",
    buildTime: env.BUILD_TIME || "unknown",
  };
}
