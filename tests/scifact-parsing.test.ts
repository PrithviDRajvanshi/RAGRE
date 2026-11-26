import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  parseCorpusJsonl,
  parseQueriesJsonl,
  parseQrelsTsv,
  selectTestQueries,
} from "../src/data/scifact.js";

const FIXTURE_DIR = fileURLToPath(new URL("./fixtures/scifact/", import.meta.url));

describe("SciFact parsers", () => {
  it("parses corpus rows and preserves upstream document IDs", async () => {
    const content = await readFile(path.join(FIXTURE_DIR, "corpus.jsonl"), "utf8");
    const corpus = parseCorpusJsonl(content);

    expect(corpus).toHaveLength(5);
    expect(corpus[0]).toEqual({ id: "doc-1", title: "Alpha study", text: "Evidence about alpha." });
  });

  it("parses query rows and preserves upstream query IDs", async () => {
    const content = await readFile(path.join(FIXTURE_DIR, "queries.jsonl"), "utf8");
    expect(parseQueriesJsonl(content)).toEqual([
      { id: "query-1", text: "What supports alpha?" },
      { id: "query-2", text: "What supports beta?" },
    ]);
  });

  it("skips the qrels header and parses integer grades", async () => {
    const content = await readFile(path.join(FIXTURE_DIR, "qrels-test.tsv"), "utf8");
    expect(parseQrelsTsv(content)).toEqual([
      { queryId: "query-1", docId: "doc-1", grade: 1 },
      { queryId: "query-1", docId: "doc-2", grade: 0 },
      { queryId: "query-2", docId: "doc-5", grade: 2 },
    ]);
  });

  it("selects only queries represented in qrels", () => {
    const queries = parseQueriesJsonl(
      '{"_id":"query-1","text":"one"}\n{"_id":"query-2","text":"two"}',
    );
    const qrels = [{ queryId: "query-2", docId: "doc-1", grade: 1 }];
    expect(selectTestQueries(queries, qrels)).toEqual([{ id: "query-2", text: "two" }]);
  });
});
