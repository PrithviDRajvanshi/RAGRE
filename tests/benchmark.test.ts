import { describe, expect, it } from "vitest";
import { formatVectorLiteral } from "../src/retrieval/dense-retriever.js";
import { canTransitionExperiment, percentile, runBenchmark } from "../src/evaluation/benchmark.js";
import type { BenchmarkRepository, ExperimentRecord, ExperimentResultRecord } from "../src/evaluation/benchmark.js";
import type { Retriever } from "../src/retrieval/retrieval.interface.js";

class MemoryRepository implements BenchmarkRepository {
  experiment!: ExperimentRecord;
  results: ExperimentResultRecord[] = [];
  queries = [{ id: "q1", text: "claim" }, { id: "q2", text: "unlabeled" }, { id: "q3", text: "error" }];
  qrels = [{ queryId: "q1", docId: "d1", grade: 1 }];
  async createExperiment(record: ExperimentRecord) { this.experiment = structuredClone(record); }
  async updateExperiment(_id: string, patch: Partial<ExperimentRecord>) { Object.assign(this.experiment, patch); }
  async saveResult(record: ExperimentResultRecord) { this.results.push(structuredClone(record)); }
  async loadQueries() { return this.queries; }
  async loadQrels() { return this.qrels; }
}

describe("benchmark helpers", () => {
  it("formats vector literals and rejects unsafe numeric values", () => {
    expect(formatVectorLiteral([0.25, -2, -0])).toBe("[0.25,-2,0]");
    expect(() => formatVectorLiteral([Number.NaN])).toThrow();
    expect(() => formatVectorLiteral([])).toThrow();
  });
  it("allows only queued to running and running to terminal transitions", () => {
    expect(canTransitionExperiment("queued", "running")).toBe(true);
    expect(canTransitionExperiment("queued", "completed")).toBe(false);
    expect(canTransitionExperiment("running", "completed_with_errors")).toBe(true);
    expect(canTransitionExperiment("completed", "running")).toBe(false);
  });
  it("uses nearest-rank percentiles and requires twenty observations", () => {
    expect(percentile(Array.from({ length: 19 }, (_, i) => i), 50)).toBeNull();
    expect(percentile(Array.from({ length: 20 }, (_, i) => i + 1), 50)).toBe(10);
    expect(percentile(Array.from({ length: 20 }, (_, i) => i + 1), 95)).toBe(19);
  });
  it("persists successes, unlabeled skips, and failures without scoring failures", async () => {
    const repository = new MemoryRepository();
    const retriever: Retriever = {
      async retrieve(query) {
        if (query === "error") throw new Error("model embedding failed");
        return { results: [{ documentId: "d1", rank: 1, score: 0.9 }], timing: { embeddingMs: 2, searchMs: 3 } };
      },
    };
    const result = await runBenchmark({ label: "fixture", topK: 1, ks: [1] }, {
      repository, retriever, embeddingModel: "fixture-model", datasetManifest: { sha256: { corpus: "abc" } },
      id: () => "experiment-1", now: () => new Date("2026-01-01T00:00:00Z"),
    });
    expect(result.status).toBe("completed_with_errors");
    expect(result.aggregateMetrics).toEqual({ scoredCount: 1, skippedCount: 1, metrics: { rr: 1, "recall@1": 1, "precision@1": 1 } });
    expect(repository.results.map((row) => row.status)).toEqual(["success", "skipped", "failed"]);
    expect(repository.results[2]).toMatchObject({ metrics: null, errorCategory: "EMBEDDING_ERROR" });
    expect(result.latency).toEqual({ p50: null, p95: null });
  });
});
