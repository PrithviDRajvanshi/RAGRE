export interface RetrievalResult {
  documentId: string;
  rank: number;
  score: number;
}

export interface RetrievalResponse {
  results: RetrievalResult[];
  timing: { embeddingMs: number; searchMs: number };
}

export interface Retriever {
  retrieve(query: string, config: { topK: number }): Promise<RetrievalResponse>;
}
