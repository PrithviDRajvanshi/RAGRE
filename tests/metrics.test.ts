import { describe, expect, it } from "vitest";
import { aggregate, evaluateCase } from "../src/evaluation/evaluate.js";
import type { CaseResult, RankedItem } from "../src/evaluation/types.js";

function item(documentId: string, rank: number): RankedItem {
  return { documentId, rank };
}

describe("evaluateCase", () => {
  it("scores the worked deduplication example and flags a short list", () => {
    const result = evaluateCase(
      { caseId: "worked", relevant: ["A", "B", "C"] },
      [item("D", 1), item("A", 2), item("A", 3), item("E", 4), item("B", 5)],
      [5],
    );

    expect(result.status).toBe("scored");
    expect(result.metrics["recall@5"]).toBeCloseTo(2 / 3);
    expect(result.metrics["precision@5"]).toBe(0.4);
    expect(result.metrics.rr).toBe(0.5);
    expect(result.flags).toContain("short_result_list");
  });

  it("scores the pizza example", () => {
    const result = evaluateCase(
      { caseId: "pizza", relevant: ["Doc1"] },
      [item("Doc4", 1), item("Doc1", 2), item("Doc2", 3)],
      [3],
    );

    expect(result.metrics["recall@3"]).toBe(1);
    expect(result.metrics.rr).toBe(0.5);
    expect(result.metrics["precision@3"]).toBeCloseTo(1 / 3);
    expect(result.flags).not.toContain("short_result_list");
  });

  it("skips cases without relevant labels", () => {
    const result = evaluateCase({ caseId: "unlabeled", relevant: [] }, [], [1]);

    expect(result).toEqual({
      caseId: "unlabeled",
      status: "skipped",
      skipReason: "no_relevant_labels",
      metrics: {},
      flags: [],
    });
  });

  it("scores an empty result list as zero", () => {
    const result = evaluateCase({ caseId: "empty", relevant: ["A"] }, [], [1, 3]);

    expect(result.metrics).toEqual({
      rr: 0,
      "recall@1": 0,
      "precision@1": 0,
      "recall@3": 0,
      "precision@3": 0,
    });
    expect(result.flags).toEqual(["short_result_list"]);
  });

  it("counts duplicate retrieved documents once", () => {
    const result = evaluateCase(
      { caseId: "duplicates", relevant: ["A"] },
      [item("A", 8), item("A", 1)],
      [1],
    );

    expect(result.metrics["recall@1"]).toBe(1);
    expect(result.metrics["precision@1"]).toBe(1);
    expect(result.metrics.rr).toBe(1);
    expect(result.flags).toEqual([]);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid k value %s",
    (k) => {
      expect(() => evaluateCase({ caseId: "invalid-k", relevant: ["A"] }, [], [k])).toThrow(
        /Invalid k: expected a positive integer/,
      );
    },
  );
});

describe("aggregate", () => {
  it("macro-averages scored cases and excludes skipped cases", () => {
    const scoredOne = evaluateCase(
      { caseId: "one", relevant: ["A"] },
      [item("A", 1)],
      [1],
    );
    const scoredTwo = evaluateCase(
      { caseId: "two", relevant: ["A"] },
      [],
      [1],
    );
    const skipped = evaluateCase({ caseId: "skip", relevant: [] }, [], [1]);

    expect(aggregate([scoredOne, scoredTwo, skipped])).toEqual({
      scoredCount: 2,
      skippedCount: 1,
      metrics: {
        rr: 0.5,
        "recall@1": 0.5,
        "precision@1": 0.5,
      },
    });
  });

  it("returns empty metrics when there are no scored cases", () => {
    const skipped: CaseResult = {
      caseId: "skip",
      status: "skipped",
      skipReason: "no_relevant_labels",
      metrics: {},
      flags: [],
    };
    expect(aggregate([skipped])).toEqual({
      scoredCount: 0,
      skippedCount: 1,
      metrics: {},
    });
  });
});
