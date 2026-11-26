import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { aggregate, evaluateCase } from "./evaluate.js";
import type { AggregateResult, CaseResult, EvalCase, RankedItem } from "./types.js";
import type { Retriever } from "../retrieval/retrieval.interface.js";
import { parseQrelsTsv, parseQueriesJsonl } from "../data/scifact.js";
import type { ScifactQuery, ScifactQrel } from "../data/scifact.js";

export type ExperimentStatus = "queued" | "running" | "completed" | "completed_with_errors" | "failed";
export function canTransitionExperiment(from: ExperimentStatus, to: ExperimentStatus): boolean {
  return (from === "queued" && to === "running") ||
    (from === "running" && ["completed", "completed_with_errors", "failed"].includes(to));
}

export function percentile(values: number[], p: number): number | null {
  if (!Number.isFinite(p) || p < 0 || p > 100) throw new Error("Percentile must be between 0 and 100.");
  if (values.length < 20) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil((p / 100) * sorted.length) - 1]!;
}

export interface ExperimentRecord {
  id: string; label: string; status: ExperimentStatus; config: Record<string, unknown>;
  datasetManifest: unknown; embeddingModel: string; appVersion: string | null;
  startedAt: Date | null; completedAt: Date | null; aggregateMetrics: AggregateResult | null;
  latency: { p50: number | null; p95: number | null } | null; errorSummary: string | null;
}
export interface ExperimentResultRecord {
  experimentId: string; queryId: string; status: "success" | "failed" | "skipped";
  retrieved: RankedItem[] | null; metrics: CaseResult["metrics"] | null; flags: string[] | null;
  embeddingMs: number | null; searchMs: number | null; errorCategory: string | null; errorMessage: string | null;
}
export interface BenchmarkRepository {
  createExperiment(record: ExperimentRecord): Promise<void>;
  updateExperiment(id: string, patch: Partial<ExperimentRecord>): Promise<void>;
  saveResult(record: ExperimentResultRecord): Promise<void>;
  loadQueries(): Promise<ScifactQuery[]>;
  loadQrels(): Promise<ScifactQrel[]>;
}
export interface BenchmarkOptions { label: string; topK: number; ks: number[] }
export interface BenchmarkDependencies {
  repository: BenchmarkRepository; retriever: Retriever; embeddingModel: string;
  datasetManifest: unknown; appVersion?: string | null; now?: () => Date; id?: () => string;
}

function errorDetails(error: unknown): { category: string; message: string } {
  const message = error instanceof Error ? error.message : String(error);
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  if (/embedding|model|vector/i.test(message)) return { category: "EMBEDDING_ERROR", message };
  if (/^(08|23|25|28|40|53|57|58)/.test(code) || /postgres|database|connection|sql/i.test(message)) {
    return { category: "DB_ERROR", message };
  }
  return { category: "UNKNOWN", message };
}

export async function runBenchmark(
  options: BenchmarkOptions,
  dependencies: BenchmarkDependencies,
): Promise<ExperimentRecord> {
  if (!options.label.trim()) throw new Error("label is required.");
  if (!Number.isInteger(options.topK) || options.topK <= 0) throw new Error("topK must be a positive integer.");
  for (const k of options.ks) if (!Number.isInteger(k) || k <= 0 || k > options.topK) throw new Error("Each k must be a positive integer no greater than topK.");
  const now = dependencies.now ?? (() => new Date());
  const experiment: ExperimentRecord = {
    id: (dependencies.id ?? randomUUID)(), label: options.label, status: "queued",
    config: { topK: options.topK, ks: options.ks }, datasetManifest: dependencies.datasetManifest,
    embeddingModel: dependencies.embeddingModel, appVersion: dependencies.appVersion ?? null,
    startedAt: null, completedAt: null, aggregateMetrics: null, latency: null, errorSummary: null,
  };
  await dependencies.repository.createExperiment(experiment);
  if (!canTransitionExperiment(experiment.status, "running")) throw new Error("Invalid experiment transition queued -> running.");
  experiment.status = "running";
  experiment.startedAt = now();
  await dependencies.repository.updateExperiment(experiment.id, { status: experiment.status, startedAt: experiment.startedAt });

  let queries: ScifactQuery[];
  let qrels: ScifactQrel[];
  try {
    [queries, qrels] = await Promise.all([
      dependencies.repository.loadQueries(), dependencies.repository.loadQrels(),
    ]);
  } catch (error) {
    if (canTransitionExperiment("running", "failed")) {
      const details = errorDetails(error);
      experiment.status = "failed";
      experiment.completedAt = now();
      experiment.errorSummary = `${details.category}: ${details.message}`;
      await dependencies.repository.updateExperiment(experiment.id, {
        status: experiment.status, completedAt: experiment.completedAt, errorSummary: experiment.errorSummary,
      });
    }
    throw error;
  }
  const relevantByQuery = new Map<string, string[]>();
  for (const qrel of qrels) if (qrel.grade > 0) {
    const docs = relevantByQuery.get(qrel.queryId) ?? [];
    docs.push(qrel.docId); relevantByQuery.set(qrel.queryId, docs);
  }
  const scored: CaseResult[] = [];
  const latencies: number[] = [];
  let failedCount = 0;
  const errors: string[] = [];
  for (const query of queries) {
    const evaluationCase: EvalCase = { caseId: query.id, relevant: relevantByQuery.get(query.id) ?? [] };
    try {
      const response = await dependencies.retriever.retrieve(query.text, { topK: options.topK });
      latencies.push(response.timing.embeddingMs + response.timing.searchMs);
      const evaluation = evaluateCase(evaluationCase, response.results, options.ks);
      scored.push(evaluation);
      if (evaluation.status === "skipped") {
        await dependencies.repository.saveResult({ experimentId: experiment.id, queryId: query.id, status: "skipped", retrieved: response.results, metrics: evaluation.metrics, flags: evaluation.flags, embeddingMs: response.timing.embeddingMs, searchMs: response.timing.searchMs, errorCategory: null, errorMessage: null });
      } else {
        await dependencies.repository.saveResult({ experimentId: experiment.id, queryId: query.id, status: "success", retrieved: response.results, metrics: evaluation.metrics, flags: evaluation.flags, embeddingMs: response.timing.embeddingMs, searchMs: response.timing.searchMs, errorCategory: null, errorMessage: null });
      }
    } catch (error) {
      failedCount++;
      const details = errorDetails(error); errors.push(`${query.id}: ${details.category}: ${details.message}`);
      await dependencies.repository.saveResult({ experimentId: experiment.id, queryId: query.id, status: "failed", retrieved: null, metrics: null, flags: null, embeddingMs: null, searchMs: null, errorCategory: details.category, errorMessage: details.message });
    }
  }
  const result = aggregate(scored);
  experiment.status = failedCount ? "completed_with_errors" : "completed";
  experiment.completedAt = now();
  experiment.aggregateMetrics = result;
  experiment.latency = { p50: percentile(latencies, 50), p95: percentile(latencies, 95) };
  experiment.errorSummary = errors.length ? errors.join("\n") : null;
  if (!canTransitionExperiment("running", experiment.status)) throw new Error(`Invalid experiment transition running -> ${experiment.status}.`);
  await dependencies.repository.updateExperiment(experiment.id, {
    status: experiment.status, completedAt: experiment.completedAt, aggregateMetrics: result,
    latency: experiment.latency, errorSummary: experiment.errorSummary,
  });
  return experiment;
}

export async function loadScifactInputs(directory = path.resolve(process.cwd(), "data", "scifact")) {
  const [queriesText, qrelsText, manifestText] = await Promise.all([
    readFile(path.join(directory, "queries.jsonl"), "utf8"),
    readFile(path.join(directory, "qrels", "test.tsv"), "utf8"),
    readFile(path.join(directory, "manifest.json"), "utf8"),
  ]);
  const queries = parseQueriesJsonl(queriesText);
  const qrels = parseQrelsTsv(qrelsText);
  const ids = new Set(qrels.map((qrel) => qrel.queryId));
  return { queries: queries.filter((query) => ids.has(query.id)), qrels, manifest: JSON.parse(manifestText) as unknown };
}
