export interface RankedItem {
  documentId: string;
  rank: number;
  score?: number;
}

export interface EvalCase {
  caseId: string;
  relevant: string[];
}

export interface CaseResult {
  caseId: string;
  status: "scored" | "skipped";
  skipReason?: string;
  metrics: Record<string, number | null>;
  flags: string[];
}

export interface AggregateResult {
  scoredCount: number;
  skippedCount: number;
  metrics: Record<string, number | null>;
}
