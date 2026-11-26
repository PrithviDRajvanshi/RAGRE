import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PoolClient } from "pg";
import { pool } from "../db/connection.js";
import {
  parseCorpusJsonl,
  parseQueriesJsonl,
  parseQrelsTsv,
  selectTestQueries,
} from "../data/scifact.js";
import type { ScifactDocument, ScifactQuery, ScifactQrel } from "../data/scifact.js";

const DATASET_DIR = path.resolve(process.cwd(), "data", "scifact");
const INSERT_BATCH_SIZE = 500;

function placeholders(rowCount: number, columnCount: number, startAt = 1): string {
  return Array.from({ length: rowCount }, (_, row) =>
    `(${Array.from({ length: columnCount }, (_, column) => `$${startAt + row * columnCount + column}`).join(", ")})`,
  ).join(", ");
}

async function insertDocuments(client: PoolClient, rows: ScifactDocument[]): Promise<void> {
  for (let start = 0; start < rows.length; start += INSERT_BATCH_SIZE) {
    const batch = rows.slice(start, start + INSERT_BATCH_SIZE);
    const values = batch.flatMap((row) => [row.id, row.title, row.text]);
    await client.query(
      `INSERT INTO documents (id, title, text) VALUES ${placeholders(batch.length, 3)}
       ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, text = EXCLUDED.text`,
      values,
    );
  }
}

async function insertQueries(client: PoolClient, rows: ScifactQuery[]): Promise<void> {
  for (let start = 0; start < rows.length; start += INSERT_BATCH_SIZE) {
    const batch = rows.slice(start, start + INSERT_BATCH_SIZE);
    const values = batch.flatMap((row) => [row.id, row.text]);
    await client.query(
      `INSERT INTO queries (id, text) VALUES ${placeholders(batch.length, 2)}
       ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text`,
      values,
    );
  }
}

async function insertQrels(client: PoolClient, rows: ScifactQrel[]): Promise<void> {
  for (let start = 0; start < rows.length; start += INSERT_BATCH_SIZE) {
    const batch = rows.slice(start, start + INSERT_BATCH_SIZE);
    const values = batch.flatMap((row) => [row.queryId, row.docId, row.grade]);
    await client.query(
      `INSERT INTO qrels (query_id, doc_id, grade) VALUES ${placeholders(batch.length, 3)}
       ON CONFLICT (query_id, doc_id) DO UPDATE SET grade = EXCLUDED.grade`,
      values,
    );
  }
}

async function main(): Promise<void> {
  const [corpusText, queriesText, qrelsText] = await Promise.all([
    readFile(path.join(DATASET_DIR, "corpus.jsonl"), "utf8"),
    readFile(path.join(DATASET_DIR, "queries.jsonl"), "utf8"),
    readFile(path.join(DATASET_DIR, "qrels", "test.tsv"), "utf8"),
  ]);

  const documents = parseCorpusJsonl(corpusText);
  const allQueries = parseQueriesJsonl(queriesText);
  const qrels = parseQrelsTsv(qrelsText);
  const queries = selectTestQueries(allQueries, qrels);
  if (queries.length !== 300) {
    throw new Error(`Expected 300 test queries selected by qrels, found ${queries.length}.`);
  }
  const documentIds = new Set(documents.map((document) => document.id));
  const missingDocumentIds = [...new Set(qrels.map((qrel) => qrel.docId))].filter(
    (id) => !documentIds.has(id),
  );
  if (missingDocumentIds.length > 0) {
    throw new Error(`Qrels reference documents missing from corpus.jsonl: ${missingDocumentIds.join(", ")}`);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await insertDocuments(client, documents);
    await insertQueries(client, queries);
    await insertQrels(client, qrels);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }

  console.log(`Imported documents: ${documents.length}`);
  console.log(`Imported test queries: ${queries.length}`);
  console.log(`Imported qrels: ${qrels.length}`);
}

main().catch((error: unknown) => {
  console.error("SciFact import failed:", error);
  process.exitCode = 1;
});
