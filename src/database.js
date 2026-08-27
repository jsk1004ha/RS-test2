import pg from "pg";

const { Pool } = pg;

const CREATE_TABLE = `CREATE TABLE IF NOT EXISTS rs_test2_writes (
  id bigserial PRIMARY KEY,
  message varchar(120) NOT NULL,
  request_id varchar(80) NOT NULL,
  deployment_id varchar(80) NOT NULL,
  commit_sha varchar(64) NOT NULL,
  pod_name varchar(80) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
)`;

export class WriteDatabase {
  #pool;
  #initializePromise;

  constructor(config, options = {}) {
    this.config = config;
    this.#pool = config.databaseUrl
      ? (options.poolFactory ?? ((poolConfig) => new Pool(poolConfig)))({
          connectionString: config.databaseUrl,
          connectionTimeoutMillis: config.databaseConnectTimeoutMs,
          idleTimeoutMillis: 10000,
          max: 5,
          application_name: "rs-test2",
        })
      : null;
  }

  get configured() {
    return this.#pool !== null;
  }

  #requirePool() {
    if (this.#pool) return this.#pool;
    const error = new Error("PostgreSQL is not configured");
    error.code = "DATABASE_NOT_CONFIGURED";
    throw error;
  }

  async initialize() {
    const pool = this.#requirePool();
    if (!this.#initializePromise) {
      this.#initializePromise = pool.query(CREATE_TABLE).catch((error) => {
        this.#initializePromise = undefined;
        throw error;
      });
    }
    await this.#initializePromise;
  }

  async check() {
    const startedAt = performance.now();
    await this.initialize();
    const result = await this.#pool.query("SELECT now() AS server_time");
    return {
      ok: true,
      latencyMs: Math.round((performance.now() - startedAt) * 10) / 10,
      serverTime: result.rows[0].server_time,
    };
  }

  async create(message, requestId) {
    await this.initialize();
    const result = await this.#pool.query(
      `INSERT INTO rs_test2_writes
        (message, request_id, deployment_id, commit_sha, pod_name)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, message, request_id, deployment_id, commit_sha, pod_name, created_at`,
      [message, requestId, this.config.deploymentId, this.config.commitSha, this.config.podName],
    );
    return mapRow(result.rows[0]);
  }

  async list(limit = 20) {
    await this.initialize();
    const boundedLimit = Math.max(1, Math.min(Number(limit) || 20, 50));
    const result = await this.#pool.query(
      `SELECT id, message, request_id, deployment_id, commit_sha, pod_name, created_at
       FROM rs_test2_writes
       ORDER BY id DESC
       LIMIT $1`,
      [boundedLimit],
    );
    return result.rows.map(mapRow);
  }

  async count() {
    await this.initialize();
    const result = await this.#pool.query("SELECT count(*)::int AS count FROM rs_test2_writes");
    return Number(result.rows[0].count);
  }

  async close() {
    if (this.#pool) await this.#pool.end();
  }
}

function mapRow(row) {
  return {
    id: Number(row.id),
    message: row.message,
    requestId: row.request_id,
    deploymentId: row.deployment_id,
    commitSha: row.commit_sha,
    podName: row.pod_name,
    createdAt: row.created_at,
  };
}
