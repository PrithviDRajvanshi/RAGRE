import { pool } from "../db/connection.js";

try {
  await pool.query("CREATE EXTENSION IF NOT EXISTS vector;");
  await pool.query("SELECT 1;");
  console.log("Database connection successful; pgvector extension is available.");
} catch (error) {
  console.error("Database check failed:", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
