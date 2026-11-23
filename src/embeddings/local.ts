import { pipeline } from "@huggingface/transformers";
import type { EmbeddingProvider, EmbeddingResult } from "./types.js";

export const LOCAL_EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";
export const EMBEDDING_DIMENSIONS = 384;

type FeatureExtractor = (
  texts: string[],
  options: { pooling: "mean"; normalize: true },
) => Promise<{ tolist(): number[][] }>;

export class LocalEmbeddingProvider implements EmbeddingProvider {
  private extractor: FeatureExtractor | undefined;

  async embed(texts: string[]): Promise<EmbeddingResult> {
    if (texts.length === 0) {
      return { embeddings: [], model: LOCAL_EMBEDDING_MODEL, dimensions: EMBEDDING_DIMENSIONS };
    }

    this.extractor ??= (await pipeline(
      "feature-extraction",
      LOCAL_EMBEDDING_MODEL,
    )) as unknown as FeatureExtractor;

    const output = await this.extractor(texts, { pooling: "mean", normalize: true });
    return {
      embeddings: output.tolist(),
      model: LOCAL_EMBEDDING_MODEL,
      dimensions: EMBEDDING_DIMENSIONS,
    };
  }
}
