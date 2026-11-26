import { pool } from "../db/connection.js";
import { DenseRetriever } from "../retrieval/dense-retriever.js";
import { LocalEmbeddingProvider, LOCAL_EMBEDDING_MODEL } from "../embeddings/local.js";
import { runBenchmark, loadScifactInputs } from "../evaluation/benchmark.js";
import type { BenchmarkRepository, ExperimentRecord, ExperimentResultRecord } from "../evaluation/benchmark.js";
import type { ScifactQuery, ScifactQrel } from "../data/scifact.js";
import { execFileSync } from "node:child_process";

function parseArgs(args: string[]): { label: string; topK: number; ks: number[] } {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index++) {
    const key = args[index]!;
    if (!key.startsWith("--") || !args[index + 1]) throw new Error(`Invalid argument: ${key}`);
    values.set(key.slice(2), args[++index]!);
  }
  const topK = Number(values.get("topK"));
  const ks = (values.get("ks") ?? "").split(",").map(Number);
  const label = values.get("label") ?? "";
  if (!label || !Number.isInteger(topK) || !ks.length || ks.some((k) => !Number.isInteger(k))) {
    throw new Error("Usage: npm run benchmark -- --label baseline --topK 10 --ks 1,5,10");
  }
  return { label, topK, ks };
}

class PostgresBenchmarkRepository implements BenchmarkRepository {
  async createExperiment(row: ExperimentRecord): Promise<void> {
    await pool.query(
      `INSERT INTO experiments (id,label,status,config,dataset_manifest,embedding_model,app_version)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [row.id,row.label,row.status,JSON.stringify(row.config),JSON.stringify(row.datasetManifest),row.embeddingModel,row.appVersion],
    );
  }
  async updateExperiment(id: string, row: Partial<ExperimentRecord>): Promise<void> {
    const columns: Record<string, string> = {
      status: "status", startedAt: "started_at", completedAt: "completed_at",
      aggregateMetrics: "aggregate_metrics", latency: "latency", errorSummary: "error_summary",
    };
    const updates = Object.entries(row).filter(([key]) => key in columns);
    const sets = updates.map(([key], index) => `${columns[key]} = $${index + 2}`);
    const values = updates.map(([key, value]) => ["aggregateMetrics", "latency"].includes(key) && value !== null ? JSON.stringify(value) : value);
    await pool.query(`UPDATE experiments SET ${sets.join(", ")} WHERE id = $1`, [id, ...values]);
  }
  async saveResult(row: ExperimentResultRecord): Promise<void> {
    await pool.query(
      `INSERT INTO experiment_results (experiment_id,query_id,status,retrieved,metrics,flags,embedding_ms,search_ms,error_category,error_message)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [row.experimentId,row.queryId,row.status,row.retrieved === null ? null : JSON.stringify(row.retrieved),row.metrics === null ? null : JSON.stringify(row.metrics),row.flags === null ? null : JSON.stringify(row.flags),row.embeddingMs,row.searchMs,row.errorCategory,row.errorMessage],
    );
  }
  async loadQueries(): Promise<ScifactQuery[]> {
    const result = await pool.query<ScifactQuery>("SELECT id, text FROM queries ORDER BY id");
    return result.rows.map((row) => ({ id: row.id, text: row.text }));
  }
  async loadQrels(): Promise<ScifactQrel[]> {
    const result = await pool.query<{ query_id: string; doc_id: string; grade: number }>("SELECT query_id, doc_id, grade FROM qrels ORDER BY query_id, doc_id");
    return result.rows.map((row) => ({ queryId: row.query_id, docId: row.doc_id, grade: row.grade }));
  }
}

function appVersion(): string | null {
  try { return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(); } catch { return null; }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const inputs = await loadScifactInputs();
  const repository = new PostgresBenchmarkRepository();
  try {
    const experiment = await runBenchmark(options, {
      repository, retriever: new DenseRetriever(new LocalEmbeddingProvider(), pool),
      embeddingModel: LOCAL_EMBEDDING_MODEL, datasetManifest: inputs.manifest, appVersion: appVersion(),
    });
    const results = await pool.query<{ status: string }>("SELECT status FROM experiment_results WHERE experiment_id = $1", [experiment.id]);
    const counts = { scored: experiment.aggregateMetrics!.scoredCount, skipped: results.rows.filter((r) => r.status === "skipped").length, failed: results.rows.filter((r) => r.status === "failed").length };
    console.log(`Experiment: ${experiment.id}`);
    console.log(`Counts: scored=${counts.scored}, skipped=${counts.skipped}, failed=${counts.failed}`);
    for (const k of options.ks) console.log(`Recall@${k}: ${experiment.aggregateMetrics!.metrics[`recall@${k}`] ?? "n/a"}; Precision@${k}: ${experiment.aggregateMetrics!.metrics[`precision@${k}`] ?? "n/a"}`);
    console.log(`MRR: ${experiment.aggregateMetrics!.metrics.rr ?? "n/a"}`);
    console.log(`Latency ms: p50=${experiment.latency!.p50 ?? "n/a"}, p95=${experiment.latency!.p95 ?? "n/a"}`);
  } finally { await pool.end(); }
}

main().catch((error: unknown) => { console.error("Benchmark failed:", error); process.exitCode = 1; });
