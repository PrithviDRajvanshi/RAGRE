# Technical Requirements Document (TRD)

## RAGRE (RAG Reliability Engine)

**Status:** Initial technical design derived from [PRD.md](PRD.md)  
**Design intent:** Build a reproducible retrieval benchmark as a modular monolith. Treat proposed implementation details below as starting points to validate, not as requirements already fixed by the PRD.

## 1. Scope and delivery order

The product's central deliverable is a benchmark engine that produces trustworthy, inspectable, repeatable retrieval measurements. The solo-project commitment is PRD Phases 0–3 plus a thin UI. Implement in this sequence:

1. Project foundation and deterministic evaluation core.
2. Import the named SciFact benchmark split, then implement dense retrieval.
3. Persist versioned inputs, runs, per-case results, and compatible-run comparisons.
4. Add a thin React UI to start a benchmark and inspect aggregate/per-case results; implement only the supporting API surface.
5. Full dashboard, broader APIs, regression gates, reports, and CLI/CI expansion are stretch work.
6. Optional keyword/hybrid retrieval, reranking, answer generation, and answer-quality evaluation are future work.

Keep each phase runnable and useful. The local embedding choice for the first release is fixed below; additional providers and LLM generation are future work.

## 2. Architecture

Use a **TypeScript/Node.js modular monolith** with clear internal boundaries. The PRD names React, PostgreSQL, and pgvector as the initial stack. Keep evaluation logic independent from the web framework, database, and provider SDKs so metric calculations are deterministic and inexpensive to test.

Suggested modules:

- `config`: validated environment and runtime configuration.
- `ingestion`: document parsing, normalization, chunking, and version creation.
- `embeddings`: provider interface, adapters, batching, and embedding cache.
- `retrieval`: retriever interface and dense, keyword, and later hybrid strategies.
- `evaluation`: metric definitions, per-case scoring, aggregation, and benchmark orchestration.
- `experiments`: run lifecycle, comparison compatibility, and regression rules.
- `db`: migrations, transaction boundary, and repositories.
- `api`: request validation, routes, error mapping, and dependency wiring.
- `cli`: machine-readable benchmark invocation and exit status.
- `frontend`: dashboard and result investigation workflows.

The API layer should call application services; it should not implement scoring, SQL, or provider logic directly. Use explicit interfaces where substituting an embedding or retrieval implementation is a real need. Avoid introducing distributed services in the MVP.

## 3. Core data and persistence

Use PostgreSQL as the source of truth. Use pgvector for dense vectors. Model the entities described in the PRD: `Dataset`, `DatasetVersion`, `Document`, `Chunk`, `EvaluationDataset`, `EvaluationDatasetVersion`, `EvaluationCase`, `Experiment`, `ExperimentResult`, and `ExperimentSummary`.

Implementation constraints:

- Give entities stable IDs and timestamps; preserve version boundaries rather than overwriting benchmark inputs.
- Store chunk content, document/source identity, chunk order, and metadata needed to explain retrieval results.
- Store embedding model/provider identity and vector dimensions with embeddings; reject incompatible dimensions.
- Store each experiment's immutable configuration snapshot and references to exact dataset and evaluation-dataset versions.
- Store per-case retrieved ranked items, relevance judgments, metric values, duration, and operational error state. Keep aggregate summaries derivable from per-case data.
- Use migrations for schema changes. Keep database access behind repositories so evaluation can run against in-memory fixtures.
- Index vector and lookup columns based on observed query patterns; choose and document pgvector index type and distance operator when retrieval implementation is selected.

The precise relational schema, deletion/retention behavior, and vector index tuning remain implementation decisions and should be captured in `Decisions.md` when resolved.

## 4. Ingestion and retrieval contracts

### SciFact corpus items

Import the pinned BEIR SciFact corpus, queries, and test qrels with stable upstream IDs and recorded checksums. For the initial benchmark, each abstract is one retrieval item; do not build a general PDF parser or configurable chunker. Keep the source ID through retrieval and result inspection. Treat all imported text as untrusted data.

### Embeddings

Use `onnx-community/all-MiniLM-L6-v2-ONNX` locally through `@huggingface/transformers` for the committed dense-retrieval path. Configure feature extraction with mean pooling and normalization; record the model revision and 384-dimensional output. Download and cache model files locally. This removes per-request embedding API charges while keeping inference in the TypeScript/Node application. Keep an adapter boundary for possible future providers; do not make an external embedding API a first-release dependency.

### Retrieval

Define a common retrieval request/result contract. Requests include dataset/version, query, top-k, and strategy configuration. Results include source IDs, rank, raw strategy score, and trace metadata. Implement local dense retrieval for the product path. For release-gate calibration, score the canonical BEIR Anserini/Pyserini BM25 ranked run (k1=0.9, b=0.4) with the project evaluator and compare with the official BEIR evaluator; this is a metric validation fixture and does not imply PostgreSQL full-text rank scores are interchangeable with Lucene BM25. Hybrid retrieval is stretch work. A retriever must not silently discard failed cases.

## 5. Evaluation and experiment behavior

Evaluation cases identify a query and one or more expected relevant sources, with optional graded relevance if needed for nDCG. Document the judgment semantics and the behavior for cases with no relevant labels before accepting such cases into a benchmark.

Implement metric functions as pure functions with explicit inputs and documented edge-case behavior:

- Recall@k
- Precision@k
- Mean Reciprocal Rank
- nDCG@k

Calculate per-case results first, then aggregate them. A report must identify the aggregation method and evaluated k values. Include retrieval latency and operational errors separately from relevance quality; do not silently treat failed retrieval as a successful empty result.

An experiment follows explicit states such as `queued`, `running`, `completed`, and `failed`. Persist state transitions and failure details. A result is comparable to another run only when its evaluation dataset version and other comparison-critical inputs are compatible; surface incompatibility instead of presenting an unqualified score delta. Regression thresholds are configurable and should identify metric, direction, and tolerance.

For reproducibility, record at minimum: dataset and evaluation versions, chunking and retrieval configuration, embedding provider/model/version where available, metric parameters, application/build version, timestamps, and relevant runtime metadata. External providers may not be deterministic; report this limitation and retain the observed configuration.

## 6. API and execution

The committed UI needs only three experiment endpoints: `POST /api/v1/experiments`, `GET /api/v1/experiments/:id`, and `GET /api/v1/experiments/:id/results`. Import the pinned SciFact corpus through the CLI. Dataset/document CRUD, manual evaluation-case authoring, retrieval playground, list/compare/failure/report endpoints, and pagination are full-API stretch scope. Validate input at the boundary and return structured errors with a request or experiment identifier.

Benchmark runs may be long-running. The initial execution mechanism is an open implementation choice: keep the experiment service independent of whether work runs inline or through a durable queue. Ensure the API can return an experiment identifier and expose status/results without holding the request open for the full run. Select a queue only when actual run duration and deployment needs justify it.

The committed CLI imports the corpus, runs the deterministic fixture, and emits a reproducible sample report using the same benchmark services as the API. CI quality gates and broader command options are stretch work. Avoid maintaining separate metric implementations.

## 7. Frontend

Build one thin React benchmark screen. It starts a run and displays aggregate metrics and per-query retrieved results/errors. Include loading, empty, validation, and failure states and keyboard-accessible controls. Dataset administration, evaluation-case editing, retrieval playground, broad visualizations, and dedicated comparison/failure pages are stretch scope.

The specific React framework, component system, charting library, and client data-fetching approach are not fixed by the PRD and should be selected when the frontend phase begins.

## 8. Reliability, security, and observability

- Validate environment configuration at startup and fail with actionable messages for missing required settings.
- Use structured logs with request/experiment IDs and error categories. Avoid logging raw document text, secrets, or unnecessary query content.
- Bound provider timeouts, retries, and concurrency. Mark partial/failed runs explicitly and retain enough detail to diagnose them.
- Use parameterized database operations and strict request validation.
- Treat uploaded documents as untrusted; constrain accepted formats and size, and avoid unsafe parser behavior.
- Keep credentials in environment/secret management, provide a non-secret `.env.example`, and redact credentials from errors and reports.
- Start with public or synthetic data as the PRD recommends. Authentication, tenant isolation, and production handling of private corpora are outside initial scope and must precede multi-user private deployment.
- Track operational latency and errors separately from relevance scores. Add percentile reporting when enough observations exist.

## 9. Verification strategy

Follow the PRD testing strategy:

- Unit coverage for metric definitions, aggregation, regression rules, chunking, and pure comparison logic.
- Integration coverage for PostgreSQL/pgvector repositories, migrations, and provider adapters using controlled fixtures or mocks.
- End-to-end coverage of SciFact import → benchmark → inspect aggregate and per-query results → reproduce the sample report.
- A release-gate calibration: score the canonical SciFact BM25 run/qrels with the project nDCG@10 implementation and confirm it agrees with the official BEIR evaluator within 0.001; record the canonical reference value (~0.665) and Anserini/Lucene settings.
- Security checks for validation, secret redaction, unsafe document handling, and access boundaries when auth is added.

Keep deterministic metric tests independent of a database and live LLM. Do not use favorable aggregate scores as a substitute for validating metric correctness and failure inspection.

## 10. Open technical choices

Resolve and record these choices when implementation evidence is available:

1. API framework and validation library.
2. React application framework and UI/data libraries.
3. Whether to add a project-specific corpus after the initial BEIR SciFact benchmark and the parser strategy for it.
4. Chunking defaults for future project-specific corpora; the MVP stores each SciFact abstract as one retrieval item.
5. pgvector distance metric and index strategy for the chosen embedding model.
6. Inline versus background experiment execution and the point at which a queue is needed.
7. Dataset import format and report format; the first corpus input is the published BEIR SciFact test split and qrels.
8. Authentication and deployment target, if the product moves beyond a local/single-user demonstration.
9. Exact metric aggregation, empty-label behavior, and comparison compatibility rules.

Each choice should include its rationale, alternatives considered, evidence, and consequences in [Decisions.md](Decisions.md).
