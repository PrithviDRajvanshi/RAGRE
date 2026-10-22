import {
  dedupeAndRerank,
  precisionAtK,
  recallAtK,
  reciprocalRank,
  validateK,
} from "./metrics.js";
import type { AggregateResult, CaseResult, EvalCase, RankedItem } from "./types.js";

export function evaluateCase(
  evaluationCase: EvalCase,
  retrieved: RankedItem[],
  ks: number[],
): CaseResult {
  for (const k of ks) validateK(k);

  const relevant = new Set(evaluationCase.relevant);
  if (relevant.size === 0) {
    return {
      caseId: evaluationCase.caseId,
      status: "skipped",
      skipReason: "no_relevant_labels",
      metrics: {},
      flags: [],
    };
  }

  const ranked = dedupeAndRerank(retrieved);
  const metrics: Record<string, number | null> = {
    rr: reciprocalRank(relevant, ranked),
  };
  const flags = new Set<string>();

  for (const k of new Set(ks)) {
    metrics[`recall@${k}`] = recallAtK(relevant, ranked, k);
    metrics[`precision@${k}`] = precisionAtK(relevant, ranked, k);
    if (ranked.length < k) flags.add("short_result_list");
  }

  return {
    caseId: evaluationCase.caseId,
    status: "scored",
    metrics,
    flags: [...flags],
  };
}

/** Macro-average each defined metric over scored cases; skipped cases are excluded. */
export function aggregate(results: CaseResult[]): AggregateResult {
  const scored = results.filter((result) => result.status === "scored");
  const skippedCount = results.length - scored.length;
  const metricNames = new Set(scored.flatMap((result) => Object.keys(result.metrics)));
  const metrics: Record<string, number | null> = {};

  for (const metricName of metricNames) {
    const values = scored
      .map((result) => result.metrics[metricName])
      .filter((value): value is number => value !== null && value !== undefined);
    metrics[metricName] = values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null;
  }

  return {
    scoredCount: scored.length,
    skippedCount,
    metrics,
  };
}
