/**
 * Migration runner — applies all *.sql files in migrations/ in numeric order.
 * Tracks applied migrations in a `schema_migrations` table so each runs once.
 *
 * Usage:  DATABASE_URL=postgres://... node --import tsx/esm migrate.ts
 */
import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import pg from "pg";

// Load from repo root .env
config({ path: join(dirname(fileURLToPath(import.meta.url)), "../../.env") });

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "migrations");

async function run(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("❌  DATABASE_URL is not set");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();

  try {
    // Ensure tracking table exists
    await client.query(`
      create table if not exists schema_migrations (
        name       text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    const { rows: applied } = await client.query<{ name: string }>(
      "select name from schema_migrations order by name",
    );
    const appliedSet = new Set(applied.map((r) => r.name));

    const files = (await readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith(".sql"))
      .sort();

    let ran = 0;
    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`  ✓ ${file} (already applied)`);
        continue;
      }
      const sql = await readFile(join(MIGRATIONS_DIR, file), "utf8");
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query(
          "insert into schema_migrations (name) values ($1)",
          [file],
        );
        await client.query("commit");
        console.log(`  ✅ ${file}`);
        ran++;
      } catch (err) {
        await client.query("rollback");
        throw err;
      }
    }

    if (ran === 0) {
      console.log("✨  Database is up to date — no migrations to run.");
    } else {
      console.log(`\n✨  Applied ${ran} migration(s).`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error("❌  Migration failed:", err);
  process.exit(1);
});
