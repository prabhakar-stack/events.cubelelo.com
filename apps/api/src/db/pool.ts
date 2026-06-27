import pg from "pg";
import { env } from "../config/env";

const { Pool } = pg;

let _pool: InstanceType<typeof Pool> | null = null;

export function getPool(): InstanceType<typeof Pool> {
  if (!_pool) {
    _pool = new Pool({
      connectionString: env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return _pool;
}

export async function closePool(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}
