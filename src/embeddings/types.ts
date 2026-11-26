export interface EmbeddingMetadata {
  model: string;
  dimensions: number;
}

export interface EmbeddingResult extends EmbeddingMetadata {
  embeddings: number[][];
}

export interface EmbeddingProvider {
  embed(texts: string[]): Promise<EmbeddingResult>;
}
