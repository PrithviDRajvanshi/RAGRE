import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PoolClient } from "pg";
import { pool } from "../db/connection.js";

const MIGRATIONS_DIR = fileURLToPath(new URL("../db/migrations/", import.meta.url));

async function applyMigration(client: PoolClient, name: string, sql: string): Promise<void> {
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [name]);
    await client.query("COMMIT");
    console.log(`Applied migration ${name}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function main(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const files = (await readdir(MIGRATIONS_DIR))
      .filter((file) => file.endsWith(".sql"))
      .sort((left, right) => left.localeCompare(right));
    const appliedResult = await client.query<{ name: string }>("SELECT name FROM schema_migrations");
    const applied = new Set(appliedResult.rows.map((row) => row.name));

    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
      await applyMigration(client, file, sql);
    }

    console.log(`Migrations complete (${files.length} migration file(s)).`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error("Database migration failed:", error);
  process.exitCode = 1;
});
