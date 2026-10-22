import type { RankedItem } from "./types.js";

/** Remove repeated documents, preserve their first-seen order, and assign 1-based ranks. */
export function dedupeAndRerank(retrieved: RankedItem[]): RankedItem[] {
  const seen = new Set<string>();
  const unique: RankedItem[] = [];

  for (const item of retrieved) {
    if (seen.has(item.documentId)) continue;

    seen.add(item.documentId);
    unique.push({ ...item, rank: unique.length + 1 });
  }

  return unique;
}

export function validateK(k: number): void {
  if (!Number.isInteger(k) || k <= 0) {
    throw new Error(`Invalid k: expected a positive integer, received ${k}.`);
  }
}

export function recallAtK(
  relevant: Set<string>,
  retrieved: RankedItem[],
  k: number,
): number {
  validateK(k);
  if (relevant.size === 0) {
    throw new Error("Cannot calculate Recall@k with no relevant documents.");
  }

  const relevantRetrieved = retrieved
    .slice(0, k)
    .filter((item) => relevant.has(item.documentId)).length;

  return relevantRetrieved / relevant.size;
}

export function precisionAtK(
  relevant: Set<string>,
  retrieved: RankedItem[],
  k: number,
): number {
  validateK(k);

  const relevantRetrieved = retrieved
    .slice(0, k)
    .filter((item) => relevant.has(item.documentId)).length;

  return relevantRetrieved / k;
}

export function reciprocalRank(
  relevant: Set<string>,
  retrieved: RankedItem[],
): number {
  const firstRelevant = retrieved.find((item) => relevant.has(item.documentId));
  return firstRelevant ? 1 / firstRelevant.rank : 0;
}
