import { pool } from "../db/connection.js";
import {
  EMBEDDING_DIMENSIONS,
  LOCAL_EMBEDDING_MODEL,
  LocalEmbeddingProvider,
} from "../embeddings/local.js";
import type { ScifactDocument } from "../data/scifact.js";

const BATCH_SIZE = 32;

function vectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

async function main(): Promise<void> {
  try {
    const result = await pool.query<ScifactDocument>(`
      SELECT d.id, d.title, d.text
      FROM documents AS d
      WHERE NOT EXISTS (
        SELECT 1 FROM doc_embeddings AS e WHERE e.doc_id = d.id AND e.model = $1
      )
      ORDER BY d.id
    `, [LOCAL_EMBEDDING_MODEL]);
    const documents = result.rows;
    const provider = new LocalEmbeddingProvider();

    for (let start = 0; start < documents.length; start += BATCH_SIZE) {
      const batch = documents.slice(start, start + BATCH_SIZE);
      const texts = batch.map((document) =>
        document.title?.trim() ? `${document.title}\n\n${document.text}` : document.text,
      );
      const embedded = await provider.embed(texts);

      if (embedded.model !== LOCAL_EMBEDDING_MODEL || embedded.dimensions !== EMBEDDING_DIMENSIONS) {
        throw new Error("Embedding provider returned unexpected model metadata.");
      }
      if (embedded.embeddings.length !== batch.length) {
        throw new Error(`Embedding provider returned ${embedded.embeddings.length} vectors for ${batch.length} documents.`);
      }

      for (const [index, vector] of embedded.embeddings.entries()) {
        if (vector.length !== EMBEDDING_DIMENSIONS) {
          throw new Error(
            `Embedding for document ${batch[index]!.id} has ${vector.length} dimensions; expected ${EMBEDDING_DIMENSIONS}.`,
          );
        }
        if (!vector.every(Number.isFinite)) {
          throw new Error(`Embedding for document ${batch[index]!.id} contains a non-finite value.`);
        }
      }

      const values: unknown[] = [];
      const valueRows = batch.map((document, index) => {
        const offset = index * 3;
        values.push(document.id, LOCAL_EMBEDDING_MODEL, vectorLiteral(embedded.embeddings[index]!));
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}::vector)`;
      });
      const sql = `INSERT INTO doc_embeddings (doc_id, model, embedding) VALUES ${valueRows.join(", ")}
        ON CONFLICT (doc_id, model) DO NOTHING`;
      await pool.query(sql, values);
      console.log(`Embedded ${Math.min(start + batch.length, documents.length)} / ${documents.length} missing documents`);
    }

    console.log(`Embedding complete: ${documents.length} document(s) processed for ${LOCAL_EMBEDDING_MODEL}.`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error("Document embedding failed:", error);
  process.exitCode = 1;
});
