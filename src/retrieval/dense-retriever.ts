import type { QueryResultRow } from "pg";
import type { EmbeddingProvider } from "../embeddings/types.js";
import type { Retriever, RetrievalResponse } from "./retrieval.interface.js";

export interface SqlExecutor {
  query<T extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<{ rows: T[] }>;
}

export function formatVectorLiteral(vector: number[]): string {
  if (vector.length === 0 || !vector.every(Number.isFinite)) {
    throw new Error("Vector must contain finite numeric values.");
  }
  return `[${vector.map((value) => Object.is(value, -0) ? "0" : String(value)).join(",")}]`;
}

export class DenseRetriever implements Retriever {
  constructor(private readonly provider: EmbeddingProvider, private readonly db: SqlExecutor) {}

  async retrieve(query: string, config: { topK: number }): Promise<RetrievalResponse> {
    if (!Number.isInteger(config.topK) || config.topK < 1) throw new Error("topK must be a positive integer.");
    const embeddingStart = performance.now();
    let embedded;
    try {
      embedded = await this.provider.embed([query]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Embedding provider failed: ${message}`, { cause: error });
    }
    const embeddingMs = Math.round(performance.now() - embeddingStart);
    if (embedded.embeddings.length !== 1 || embedded.embeddings[0]!.length !== embedded.dimensions) {
      throw new Error("Embedding provider returned an invalid query vector.");
    }
    const vector = formatVectorLiteral(embedded.embeddings[0]!);
    const searchStart = performance.now();
    let result;
    try {
      result = await this.db.query<{ doc_id: string; distance: number | string }>(
        `SELECT doc_id, embedding <=> $1::vector AS distance
         FROM doc_embeddings WHERE model = $2
         ORDER BY embedding <=> $1::vector LIMIT $3`,
        [vector, embedded.model, config.topK],
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const wrapped = new Error(`Database vector search failed: ${message}`, { cause: error });
      if (typeof error === "object" && error !== null && "code" in error) {
        Object.assign(wrapped, { code: String(error.code) });
      }
      throw wrapped;
    }
    const searchMs = Math.round(performance.now() - searchStart);
    return {
      results: result.rows.map((row, index) => ({ documentId: row.doc_id, rank: index + 1, score: 1 - Number(row.distance) })),
      timing: { embeddingMs, searchMs },
    };
  }
}
