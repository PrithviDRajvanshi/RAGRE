# PRODUCT REQUIREMENTS DOCUMENT (PRD)

# RAGRE (RAG Reliability Engine)
### A Benchmarking, Evaluation, and Observability Platform for Retrieval-Augmented Generation Systems

**Document Version:** 1.0  
**Status:** Proposed — Initial Development  
**Product Category:** AI Infrastructure / Developer Tooling  
**Primary Users:** Solo RAG developers and engineers on small teams  
**Initial Technology Stack:** TypeScript, Node.js, PostgreSQL, pgvector, React  
**Project Type:** Independent Engineering Project  
**Working Name:** RAGRE

---

# 1. Executive Summary

## 1.1 Product Overview

RAGRE is a developer-focused platform designed to evaluate, benchmark, debug, and improve Retrieval-Augmented Generation (RAG) systems.

Retrieval-Augmented Generation combines information retrieval with large language models (LLMs). Instead of relying exclusively on the knowledge encoded in a model's parameters, a RAG system retrieves relevant external information and supplies it to the model as context for generating a response.

Although RAG is widely used to build knowledge assistants, enterprise search systems, customer-support agents, and AI-powered applications, its reliability depends on several interacting components:

- Document ingestion and preprocessing.
- Text chunking and metadata extraction.
- Embedding generation.
- Semantic and keyword retrieval.
- Ranking and reranking.
- Context construction.
- LLM response generation.
- Evaluation, monitoring, and regression testing.

A RAG application may produce an incorrect answer because the relevant document was never retrieved, the correct passage was ranked too low, the document was outdated, or the LLM generated an unsupported response despite receiving appropriate evidence.

Without systematic evaluation, developers often rely on manually testing a small number of questions. This approach does not scale and makes it difficult to establish whether a change genuinely improves system quality.

RAGRE addresses this problem by providing a reproducible evaluation environment in which developers can execute benchmark datasets against different retrieval configurations, measure their performance, inspect individual failures, compare experiments, and identify regressions.

## 1.2 Product Vision

To make RAG systems measurable, debuggable, reproducible, and continuously improvable by providing developers with a unified environment for retrieval evaluation and reliability testing.

## 1.3 Core Value Proposition

**RAGRE helps developers answer three fundamental questions:**

1. Is my RAG system retrieving the right information?
2. Which configuration provides the best trade-off between retrieval quality, latency, and cost?
3. Can I prove that a code or configuration change improved the system without introducing regressions?

The platform will prioritize quantitative evaluation, transparent failure analysis, and reproducible experiments over generating AI responses for demonstration purposes.

## 1.4 Product Positioning

RAGRE is not intended to be another general-purpose AI chatbot or document-question-answering application.

It is an engineering tool for developers who build and maintain RAG systems.

Its primary output is not simply an answer to a user's question. Its primary output is evidence about the behavior and performance of a retrieval pipeline.

---

## 1.5 Why this project instead of an existing tool?

RAGRE is not intended to replace Ragas, DeepEval, TruLens, Phoenix, or LangSmith as general-purpose LLM evaluation and observability platforms. Those projects already provide evaluation, tracing, experimentation, or combinations of these capabilities. This is a deliberately narrower engineering project: a lightweight, self-hosted benchmark tool focused on reproducible retrieval comparisons, with corpus metadata, vectors, run records, and result inspection kept in PostgreSQL/pgvector.

The intended distinction is the end-to-end workflow and a local dense retrieval baseline backed by pgvector, not a claim of better metrics or broader integrations. A developer should be able to version a corpus and its labels, compare retrieval configurations against the same cases, and inspect query-level results in a self-hosted PostgreSQL-backed app. Existing tools remain valid choices; if they already meet a team's workflow, there is no reason to switch.

This positioning is a project hypothesis to test through implementation and comparison, not a claim that the named tools cannot support self-hosting or reproducible experiments. See the [Ragas evaluation guide](https://docs.ragas.io/en/stable/), [DeepEval project](https://github.com/confident-ai/deepeval), [TruLens docs](https://www.trulens.org/docs/), [Phoenix docs](https://arize.com/docs/phoenix/), and [LangSmith evaluation docs](https://docs.langchain.com/langsmith/evaluation-types).

---
# 2. Problem Statement

## 2.1 The Reliability Problem

Consider an enterprise knowledge assistant containing thousands of documents.

An employee asks:

"What is the current monthly work-from-home reimbursement limit?"

The authoritative policy specifies ₹3,000 per month, but an older document specifies ₹2,000.

The retrieval system ranks the old document above the current policy. The LLM receives the outdated information and produces a convincing but incorrect response.

From the user's perspective, the chatbot has failed. From the developer's perspective, the root cause is not immediately obvious.

Possible causes include:

- The outdated document has more lexical overlap with the query.
- The embedding model does not distinguish the two passages effectively.
- The document chunks separate the relevant value from its surrounding context.
- The current policy has incorrect or missing metadata.
- The retrieval configuration ranks relevant passages too low.
- The context window excludes the correct passage.
- The generation model ignores or misinterprets the retrieved evidence.

A developer needs a way to isolate these failure modes rather than changing prompts or models blindly.

## 2.2 Limitations of Existing Development Workflows

Common weaknesses in RAG development workflows include:

### A. Manual testing

Developers enter questions individually and inspect the responses. This provides limited coverage and makes comparisons subjective.

### B. Missing ground truth

Teams may not maintain labelled datasets that specify which documents should be retrieved for each question.

### C. Inconsistent experiments

Different configurations may be evaluated using different questions, datasets, or document versions, making comparisons unreliable.

### D. Limited retrieval observability

Developers may see the final answer without knowing which chunks were retrieved, their rankings, their scores, or why the relevant evidence was omitted.

### E. Poor regression detection

A retrieval improvement for one set of questions may silently degrade another set. Without automated benchmarks, such regressions may reach production.

### F. Incomplete cost and latency analysis

A more sophisticated retrieval strategy may improve relevance but increase latency, infrastructure consumption, or LLM token usage.

### G. Confusion between retrieval and generation failures

A poor answer may result from bad retrieval, poor context construction, or generation behavior. Evaluating only the final answer does not reliably isolate the responsible component.

## 2.3 Proposed Solution

RAGRE will provide a repeatable workflow that allows developers to:

1. Create a versioned dataset of documents.
2. Define evaluation questions and expected relevant sources.
3. Configure retrieval strategies and parameters.
4. Execute benchmark runs against a fixed dataset.
5. Calculate retrieval-quality and performance metrics.
6. Inspect the retrieved results for individual questions.
7. Compare a candidate configuration against a baseline.
8. Detect regressions using configurable thresholds.
9. Export reports containing measurements, configuration details, and failure examples.

The MVP will focus on retrieval quality and reproducibility. LLM generation evaluation will be added as a separate layer after the retrieval benchmark engine is validated.

---

# 3. Product Goals and Non-Goals

## 3.1 Primary Goals

### G1. Quantify retrieval quality

Provide reliable implementations of Recall@k, Precision@k, Mean Reciprocal Rank, and Normalized Discounted Cumulative Gain.

### G2. Enable reproducible experiments

Every experiment must record its dataset version, retrieval configuration, execution status, metrics, and relevant runtime metadata.

### G3. Make failures inspectable

Developers must be able to identify which queries failed, which documents were expected, which chunks were retrieved, and how their rankings affected the metrics.

### G4. Compare retrieval configurations

Users must be able to compare different chunking, retrieval, embedding, and ranking configurations against the same evaluation dataset.

### G5. Detect regressions

The platform must identify meaningful performance degradations between a baseline and a candidate experiment.

### G6. Provide a thin developer interface

A small React interface must let a developer start a benchmark and inspect aggregate and per-query results. Dataset administration, playground, and expanded dashboard pages are stretch scope.

### G7. Demonstrate production-oriented engineering

The project must implement modular architecture, input validation, automated tests, structured logging, error handling, reproducible evaluation, and clear technical documentation.

## 3.2 Secondary Goals

- Support multiple embedding providers through a provider abstraction.
- Support dense, keyword, and hybrid retrieval.
- Record retrieval latency and operational errors.
- Evaluate answer faithfulness and relevance in a later phase.
- Provide command-line and CI integration.
- Make it possible to add new retrieval strategies without rewriting the evaluation engine.

## 3.3 Non-Goals for the MVP

The initial version will not attempt to:

- Train or fine-tune a foundation model.
- Build a general-purpose conversational AI assistant.
- Replace enterprise vector databases.
- Automatically optimize every RAG configuration.
- Guarantee that an LLM will never hallucinate.
- Provide a complete enterprise knowledge-management suite.
- Implement distributed execution across many servers.
- Support every document format or retrieval framework.
- Replicate the proprietary internals of another AI infrastructure company.

These exclusions are intentional. The objective is to deliver a complete and verifiable evaluation workflow before expanding into broader capabilities.

---

## 3.4 Solo-project MVP commitment

The committed release is limited to Roadmap Phases 0–3 plus one thin UI for the benchmark workflow. Phase 0 establishes a runnable project and database; Phase 1 validates deterministic metrics; Phase 2 loads the named corpus and runs dense retrieval; Phase 3 persists versioned inputs and experiment results. The thin UI is limited to starting a run and inspecting its aggregate and per-query results. Build only the API endpoints required by that workflow.

**Solo MVP release gate:**

- The SciFact test split or a documented small fixture can be loaded with stable IDs and labels.
- Dense retrieval returns ranked source IDs for a fixed evaluation set.
- Recall@k, Precision@k, and MRR produce verified per-query and aggregate results.
- A run and its inputs/results persist across application restart; compatible runs can be compared.
- The thin UI starts a run and makes aggregate and per-query outcomes inspectable.
- Setup instructions reproduce one sample report locally.
- The project metric implementation, applied to canonical SciFact BM25 rankings and test qrels, agrees with the official BEIR evaluator within 0.001 nDCG@10; the published reference is 0.665 with Anserini/Lucene BM25 defaults (k1=0.9, b=0.4) ([BEIR paper](https://arxiv.org/abs/2104.08663)). Record any retrieval-score deviation and the analyzer/field configuration; a different PostgreSQL lexical ranking is not assumed to match.

Requirements marked **Stretch** or P1/P2 are deferred. The full-product acceptance criteria in Section 14 remain a later target; the solo MVP release gate is defined in this section and the Phase 0–3 roadmap plus thin UI.

# 4. Primary User and Non-Target

## Primary user

A solo RAG developer or engineer working on a small team who needs to answer a concrete question: did this retrieval or indexing change improve results on a fixed, labeled set of queries? They can run a local TypeScript/PostgreSQL application and are comfortable inspecting ranked passages and benchmark metrics.

## Non-target for the MVP

This release is not aimed at enterprise platform teams needing multi-tenant access control, production tracing across many services, broad framework integrations, or managed collaboration. Those needs are outside the solo-project commitment.

---
# 5. Core Product Workflow

The primary user journey consists of eight stages.

## Stage 1: Import the benchmark corpus

The user imports the pinned BEIR SciFact release (corpus, test queries, and qrels). Preserve source IDs and dataset checksums as a named dataset version. The initial workflow does not accept arbitrary uploaded documents.

## Stage 2: Index the existing abstracts

Treat each SciFact abstract as one retrieval item for the first benchmark and generate a local embedding for dense retrieval. Generate or consume a separate canonical BM25 ranked run only for metric calibration. No PDF parsing or configurable chunking is required for this corpus.

## Stage 3: Load the published relevance judgments

Load the SciFact test qrels as the evaluation dataset, preserving query and document IDs and relevance grades. Manually authored cases and CSV/JSON authoring are stretch functionality.

## Stage 4: Configure retrieval

The user selects the local dense retriever and records model configuration and top-k. The canonical BM25 run is used separately to calibrate metric calculations, not as a user-facing retrieval strategy. Hybrid retrieval and reranking remain stretch features.

## Stage 5: Execute a benchmark

The system runs each evaluation case through the selected retrieval configuration.

For every case, it records the retrieved chunks, ranks, scores, execution time, errors, and relevant evaluation metrics.

## Stage 6: Analyze results

The user reviews aggregate metrics and identifies weak queries or categories.

The system distinguishes retrieval failures from execution failures.

## Stage 7: Compare experiments

The user selects a baseline and candidate experiment.

The system compares their metrics using the same evaluation cases and dataset version wherever possible.

## Stage 8: Export and reproduce

The user can rerun an experiment using its saved configuration and reproduce a local sample report. Downloadable report export is stretch scope.

The system must clearly indicate when exact reproduction is not guaranteed because an external provider, model version, corpus, or nondeterministic service has changed.

---

# 6. Functional Requirements

Priority definitions:

- **P0:** Mandatory for the MVP.
- **P1:** Important after the initial benchmark engine is operational.
- **P2:** Future enhancement.
- **Stretch:** Full-product requirement explicitly deferred beyond the solo MVP.

## 6.1 Dataset Management

### FR-001: Create dataset

**Priority:** Stretch

The system shall allow users to create named datasets.

Required fields:
- Dataset name.
- Description.
- Optional tags.

Acceptance criteria:
- A valid request creates a dataset with a unique ID.
- Duplicate or invalid input is handled explicitly.
- Dataset metadata is persisted.
- API responses follow a consistent schema.

### FR-002: Ingest documents

**Priority:** Stretch

The system shall ingest supported document formats.

Initial formats:
- Plain text.
- Markdown.
- PDF, subject to reliable text extraction.

Acceptance criteria:
- The system extracts usable text.
- Unsupported or unreadable files produce explicit errors.
- Each document receives a stable ID.
- Original source metadata is preserved.
- The system records a content hash to detect duplicate content.
- Failed ingestion does not leave a document incorrectly marked as fully indexed.

### FR-003: Track document versions

**Priority:** P0

The system shall identify changes to the imported SciFact corpus and evaluation split.

Acceptance criteria:
- A modified document can be distinguished from its previous version.
- Dataset versions identify the corpus used by an experiment.
- Benchmark reports include the relevant dataset version.
- Results from different dataset versions are not silently treated as directly equivalent.

### FR-004: Chunk documents

**Priority:** Stretch

The system shall split extracted text into configurable chunks.

Supported initial parameters:
- Maximum chunk size.
- Chunk overlap.
- Chunking strategy.
- Optional document metadata.

Acceptance criteria:
- Chunk boundaries are deterministic for the same input and configuration.
- Every chunk references its parent document.
- Chunk order is preserved.
- Empty chunks are excluded.
- The selected chunking configuration is recorded.

Token-based chunking is preferred when tokenizer support is available. A character-based implementation may be used for an initial prototype, provided it is explicitly identified as such.

### FR-005: Generate embeddings

**Priority:** P0

**Initial model:** `onnx-community/all-MiniLM-L6-v2-ONNX` via `@huggingface/transformers`, running locally. Use mean pooling with normalization and record model identity/configuration; its embedding dimension is 384. This avoids per-request embedding API charges; model files are downloaded once and cached locally. See the [Transformers.js model card](https://huggingface.co/onnx-community/all-MiniLM-L6-v2-ONNX).

The system shall generate and store local embeddings for SciFact abstracts.

Acceptance criteria:
- Embeddings are associated with their corresponding chunks.
- Provider failures are handled without corrupting indexing state.
- Embedding model and dimensions are recorded.
- Incompatible embedding dimensions are rejected.
- Re-indexing behavior is explicit.
- API keys are never stored in experiment reports.

## 6.2 Evaluation Dataset Management

### FR-006: Create evaluation cases

**Priority:** Stretch

The system shall allow users to define labelled questions.

Required fields:
- Query text.
- One or more expected relevant document IDs or chunk IDs.

Optional fields:
- Case name.
- Category.
- Difficulty.
- Relevance grades.
- Expected answer.
- Notes.

Acceptance criteria:
- Every evaluation case has a unique identifier.
- Referenced documents must exist in the relevant dataset.
- Invalid references are rejected or explicitly marked as unresolved.
- The system supports multiple relevant sources for a query.
- Dataset changes create a new version or otherwise preserve experiment reproducibility.

### FR-007: Import evaluation datasets

**Priority:** Stretch

The system should support importing evaluation cases from JSON or CSV.

Acceptance criteria:
- A documented schema is available.
- Invalid rows are reported with actionable errors.
- Valid rows are not silently discarded.
- Duplicate case handling is deterministic.

### FR-008: Validate evaluation coverage

**Priority:** Stretch

The system should identify incomplete or potentially misleading evaluation datasets.

Checks may include:
- Questions with no expected relevant sources.
- Expected sources missing from the dataset.
- Duplicate questions.
- Categories with insufficient examples.
- Sources that no longer exist in the current dataset version.

The platform must not treat missing labels as proof that a retrieval result is irrelevant.

## 6.3 Retrieval Engine

### FR-009: Dense vector retrieval

**Priority:** P0

The system shall retrieve chunks using embedding similarity.

Acceptance criteria:
- Query embeddings use a compatible embedding model and vector dimension.
- Results are ordered according to the configured similarity method.
- Retrieved chunks include source identifiers and ranks.
- Retrieval parameters are recorded.
- Empty result sets are represented correctly.

### FR-010: Configurable top-k retrieval

**Priority:** P0

The user shall specify how many results the retrieval engine returns.

Acceptance criteria:
- The system enforces valid limits.
- The requested k value is stored with the experiment.
- Returned result counts do not exceed k.
- Metrics can be calculated at multiple cutoffs when the retrieved result set supports them.

### FR-011: BEIR BM25 metric calibration

**Priority:** P0

The system shall provide a BM25 reference run for release-gate calibration. Use the BEIR Anserini/Pyserini SciFact setup (Lucene BM25 defaults k1=0.9, b=0.4, with matching indexed fields and tokenization) or consume its canonical ranked output. A PostgreSQL-native lexical strategy may be added, but must be reported separately unless its setup matches the reference.

### FR-012: Hybrid retrieval

**Priority:** Stretch

The system should combine dense and keyword retrieval.

A reciprocal-rank fusion approach may be used as an initial implementation.

Acceptance criteria:
- Dense and keyword results can be combined.
- The fusion configuration is recorded.
- Duplicate chunks are handled consistently.
- The resulting ranking can be inspected.

### FR-013: Reranking

**Priority:** Stretch

The system may support a reranking stage that reorders an initial set of retrieved candidates.

Acceptance criteria:
- Initial and reranked positions are distinguishable.
- Additional latency is recorded.
- Reranking can be enabled or disabled per experiment.
- The candidate set remains traceable.

### FR-014: Retrieval trace

**Priority:** P0

Every completed retrieval case shall retain a trace of the relevant retrieval process.

The trace should include:
- Query identifier.
- Query text or a reference to it.
- Retrieval configuration.
- Retrieved chunk identifiers.
- Source document identifiers.
- Rank positions.
- Similarity or ranking scores, when available.
- Retrieval duration.
- Errors and warnings.

The trace must not expose API credentials or unrelated private data.

## 6.4 Evaluation Engine

### FR-015: Recall@k

**Priority:** P0

The system shall calculate Recall@k.

For a query with a known set of relevant documents:

Recall@k = Number of relevant documents retrieved in the top k / Total number of relevant documents.

The implementation shall explicitly define whether relevance is evaluated at document or chunk level.

For the MVP, document-level relevance should be the default, with retrieved chunks mapped to their source documents and duplicate source documents deduplicated.

### FR-016: Precision@k

**Priority:** P0

The system shall calculate Precision@k.

Precision@k = Number of relevant retrieved items in the top k / k.

The report must document how precision is handled when fewer than k items are available.

### FR-017: Mean Reciprocal Rank

**Priority:** P0

The system shall calculate MRR across evaluation cases.

For each query:

Reciprocal Rank = 1 / Rank of the first relevant result.

If no relevant result is retrieved, the reciprocal rank is zero.

MRR is the arithmetic mean of reciprocal ranks across the eligible evaluation cases.

### FR-018: nDCG@k

**Priority:** P0

The system should calculate Normalized Discounted Cumulative Gain at k.

This metric is especially useful when evaluation cases contain graded relevance labels rather than binary relevant/not-relevant labels.

The gain function and discount convention must be documented.

### FR-019: Aggregate benchmark metrics

**Priority:** P0

The system shall calculate aggregate metrics across a benchmark run.

Acceptance criteria:
- The aggregation method is documented.
- Query-level results remain available.
- The number of successful, failed, skipped, and evaluated cases is recorded.
- Undefined metrics are represented explicitly rather than silently converted to misleading values.

### FR-020: Latency measurements

**Priority:** Stretch

The system shall measure retrieval execution time.

Acceptance criteria:
- Each successful retrieval case records elapsed time.
- Aggregate p50 and p95 latency can be reported when enough observations exist.
- Benchmark reports include the number of observations.
- Warm-up behavior and measurement conditions are documented where applicable.
- Embedding-generation latency is separated from retrieval latency when both are measured.

### FR-021: Operational error tracking

**Priority:** P0

The system shall distinguish operational errors from relevance failures.

Examples:
- Embedding API timeout.
- Database connection failure.
- Invalid vector dimensions.
- Query execution failure.
- Rate-limit response.

Acceptance criteria:
- Failed cases are visible in the benchmark report.
- Error categories are recorded.
- A failed query is not incorrectly scored as a successful retrieval with zero relevance.
- Partial runs clearly identify which cases were evaluated.

## 6.5 Experiment Management

### FR-022: Create experiment

**Priority:** P0

An experiment shall contain:
- Dataset and dataset version.
- Evaluation dataset version.
- Retrieval configuration.
- Embedding model identifier.
- Requested k values.
- Start and completion timestamps.
- Status.
- Aggregate metrics.
- Execution metadata.

### FR-023: Persist experiment results

**Priority:** P0

Each experiment shall retain per-query results and aggregate metrics.

Completed results shall not be silently overwritten when a subsequent experiment is executed.

### FR-024: Compare experiments

**Priority:** P0

The system shall compare a baseline experiment with a candidate experiment.

The comparison should include:
- Recall@k changes.
- Precision@k changes.
- MRR changes.
- nDCG@k changes, when available.
- Latency changes.
- Error-rate changes.
- Per-query regressions and improvements.

Acceptance criteria:
- Comparisons validate dataset compatibility.
- Incompatible runs produce an explicit warning or are rejected.
- Absolute and relative changes are labelled correctly.
- The baseline and candidate remain independently accessible.

### FR-025: Experiment status

**Priority:** P0

Experiments shall have explicit lifecycle states.

Recommended states:
- QUEUED.
- RUNNING.
- COMPLETED.
- COMPLETED_WITH_ERRORS.
- FAILED.
- CANCELLED.

The system shall prevent invalid state transitions.

### FR-026: Reproducibility metadata

**Priority:** P0

The system shall retain sufficient information to rerun and interpret an experiment.

This includes:
- Dataset and label versions.
- Retrieval parameters.
- Chunking configuration.
- Embedding model identifier.
- Application version or commit hash, when available.
- Evaluation implementation version.
- Relevant dependency versions.
- Runtime metadata.

The platform shall distinguish configuration reproducibility from bit-for-bit deterministic reproduction.

## 6.6 Regression Testing

### FR-027: Define regression thresholds

**Priority:** Stretch

Users should be able to configure acceptable performance changes.

Example thresholds:
- Recall@5 must not decrease by more than a specified amount.
- MRR must remain above a minimum.
- p95 retrieval latency must remain under a specified budget.
- Error rate must remain below a defined limit.

Thresholds shall be configurable rather than hardcoded as universal values.

### FR-028: Detect regressions

**Priority:** Stretch

The system should compare a candidate run with its baseline and flag configured threshold violations.

Acceptance criteria:
- The report identifies the failed threshold.
- The relevant metric values are displayed.
- Per-query changes are accessible.
- A regression decision is reproducible from the saved results.

### FR-029: Command-line benchmark execution

**Priority:** P0

The system shall provide a minimal CLI to import SciFact and run the deterministic benchmark independently of the UI. Broad CLI configuration and CI regression gates are stretch scope.

## 6.7 LLM Answer Evaluation

### FR-030: Optional answer generation

**Priority:** Stretch

The system may send retrieved context to an LLM to generate answers for evaluation cases.

Acceptance criteria:
- Retrieval and generation stages are measured separately.
- The prompt and generation configuration are versioned.
- Token usage, latency, and provider errors are recorded when available.
- Generated answers are associated with their supporting retrieved chunks.

### FR-031: Answer quality evaluation

**Priority:** Stretch

The system may evaluate:
- Faithfulness to retrieved evidence.
- Answer relevance to the query.
- Answer correctness against a reference answer.
- Citation correctness, where citations are generated.

LLM-based judges must be treated as imperfect evaluators. The system should record the evaluator model and rubric and support human inspection of results.

A high faithfulness score must not be presented as proof that the answer is factually correct if the retrieved documents themselves are outdated or wrong.

---

# 7. Non-Functional Requirements

## 7.1 Reliability

- Database failures must produce explicit errors.
- External API failures must not corrupt experiment state.
- Retried operations must avoid duplicate persisted results where possible.
- Long-running experiments must survive ordinary HTTP client disconnections.
- Failed runs must retain diagnostic information.

## 7.2 Performance

The MVP should support small and medium-sized local evaluation datasets.

Initial engineering targets, to be validated during implementation:

- Interactive retrieval requests should typically complete within a few seconds, excluding provider-specific delays.
- The API should return experiment identifiers promptly rather than hold requests open for entire benchmark runs.
- Benchmark execution should use bounded concurrency.
- p50 and p95 latency should be measured rather than assumed.

No universal throughput target will be claimed before testing on a defined environment and dataset.

## 7.3 Scalability

The architecture should allow future introduction of:
- Background job queues.
- Multiple worker processes.
- Batch embedding generation.
- Cached embeddings.
- Incremental indexing.
- Dataset-level isolation.
- External vector database adapters.

The MVP does not require a distributed microservices architecture.

## 7.4 Security

- API keys must be stored in environment variables or a suitable secret manager.
- Secrets must never appear in logs, reports, or frontend bundles.
- User input must be validated.
- File uploads must enforce type and size restrictions.
- Uploaded files must not be executed.
- Database access must use parameterized queries or safe ORM methods.
- External content must be treated as untrusted data.
- The system must not execute instructions found in retrieved documents.
- Resource-intensive benchmark requests must have configurable limits.

If the platform is exposed publicly, authentication, authorization, rate limiting, and tenant isolation become mandatory before handling multiple users' private datasets.

## 7.5 Maintainability

- Business logic must be separated from HTTP controllers.
- Evaluation metrics must be implemented as independently testable functions.
- Retrieval strategies must follow a common interface.
- Database access must be isolated behind repository or data-access modules.
- Configuration schemas must be validated.
- API contracts and metric definitions must be documented.

## 7.6 Observability

The application should emit:
- Structured logs.
- Request IDs.
- Experiment IDs.
- Retrieval durations.
- External provider error categories.
- Benchmark progress.
- Database error information.

Logs must not include secrets or unnecessarily expose sensitive document contents.

## 7.7 Accessibility and Usability

The dashboard should provide:
- Clear loading and failure states.
- Readable metric definitions.
- Distinguishable regression warnings.
- Keyboard-accessible controls.
- Responsive layouts.
- Explicit explanations of missing or undefined measurements.

---

# 8. System Architecture

## 8.1 Architectural Overview

The application will use a modular monolithic architecture for the MVP.

This provides a clean separation of responsibilities without introducing the operational complexity of independently deployed microservices.

### Frontend Layer

**Technology:** React, TypeScript, and a suitable component system.

Responsibilities:
- Dataset management.
- Document ingestion interface.
- Evaluation-case management.
- Retrieval playground.
- Experiment execution and status display.
- Benchmark result visualization.
- Experiment comparison.
- Failure investigation.

### API Layer

**Technology:** Node.js, Express, TypeScript, Zod.

Responsibilities:
- REST endpoint definitions.
- Request validation.
- Response serialization.
- Error handling.
- Experiment orchestration.
- Authentication when introduced.
- API-level resource limits.

### Application Services

Responsibilities:
- Dataset service.
- Ingestion service.
- Chunking service.
- Embedding service.
- Retrieval service.
- Evaluation service.
- Experiment service.
- Comparison service.
- Reporting service.

### Persistence Layer

**Technology:** PostgreSQL with pgvector.

Responsibilities:
- Dataset metadata.
- Document and chunk records.
- Embeddings.
- Evaluation cases and labels.
- Experiment configurations.
- Per-query results.
- Aggregate metrics.
- Experiment lifecycle state.

### External Providers

Possible integrations:
- An embedding API.
- An optional LLM generation API.
- An optional reranking service.

Provider implementations should be hidden behind interfaces so the evaluation engine is not coupled to one vendor.

## 8.2 Retrieval Interface

A common retrieval interface should accept a query and configuration and return ranked results.

Conceptually:

`retrieve(query, config) -> RankedChunk[]`

Each ranked chunk should include:
- Chunk ID.
- Document ID.
- Rank.
- Score, if available.
- Relevant metadata.

Different implementations can provide dense retrieval, keyword retrieval, or hybrid retrieval without changing the evaluation metrics.

## 8.3 Evaluation Interface

The evaluator should accept:
- Evaluation cases.
- Retrieval outputs.
- Relevance labels.
- Requested metric cutoffs.

It should return:
- Per-case metrics.
- Aggregate metrics.
- Coverage statistics.
- Evaluation warnings.

The evaluator must not depend on Express, React, or a specific database implementation.

## 8.4 Execution Model

For the first working version, the benchmark engine may run as a CLI command or a background worker.

When initiated through the API:
1. Validate the experiment request.
2. Create a persisted experiment record.
3. Return its identifier.
4. Execute the benchmark asynchronously.
5. Persist per-case results.
6. Update progress and final status.
7. Expose results through the API.

A queue such as BullMQ or a dedicated job system can be introduced later if workload requirements justify it.

---

# 9. Database Design

The following entities define the initial logical data model.

## 9.1 Dataset

Fields:
- `id`
- `name`
- `description`
- `created_at`
- `updated_at`

## 9.2 DatasetVersion

Fields:
- `id`
- `dataset_id`
- `version_number`
- `corpus_hash`
- `created_at`
- `metadata`

A dataset version identifies the exact BEIR SciFact release/split, source checksums, and indexing configuration used for an experiment.

## 9.3 Document

Fields:
- `id`
- `dataset_version_id`
- `source_name`
- `source_type`
- `content_hash`
- `extracted_text_reference`
- `metadata`
- `ingestion_status`
- `created_at`

Large document contents may be stored separately when necessary. The MVP can use PostgreSQL storage for manageable datasets.

## 9.4 Chunk

Fields:
- `id`
- `document_id`
- `chunk_index`
- `content`
- `token_count`
- `content_hash`
- `embedding`
- `embedding_model`
- `metadata`

The schema must account for embedding dimension compatibility and support re-indexing when the embedding model changes.

## 9.5 EvaluationDataset

Fields:
- `id`
- `name`
- `description`
- `created_at`

## 9.6 EvaluationDatasetVersion

Fields:
- `id`
- `evaluation_dataset_id`
- `version_number`
- `created_at`

## 9.7 EvaluationCase

Fields:
- `id`
- `evaluation_dataset_version_id`
- `query_text`
- `expected_sources`
- `category`
- `difficulty`
- `reference_answer`
- `metadata`

Expected sources should support multiple relevant items and optional graded relevance.

## 9.8 Experiment

Fields:
- `id`
- `dataset_version_id`
- `evaluation_dataset_version_id`
- `configuration`
- `status`
- `application_version`
- `started_at`
- `completed_at`
- `error_summary`
- `metadata`

## 9.9 ExperimentResult

Fields:
- `id`
- `experiment_id`
- `evaluation_case_id`
- `retrieved_results`
- `per_case_metrics`
- `latency_ms`
- `status`
- `error_category`
- `created_at`

## 9.10 ExperimentSummary

Fields:
- `experiment_id`
- `aggregate_metrics`
- `evaluated_case_count`
- `successful_case_count`
- `failed_case_count`
- `skipped_case_count`
- `summary_metadata`

The summary may be stored directly or derived from per-case results. If persisted, it must remain consistent with the underlying results.

## 9.11 Design Principles

- Use UUIDs or another consistent identifier strategy.
- Add indexes to common lookup fields.
- Store structured configuration in a validated JSONB column where appropriate.
- Preserve historical experiment results.
- Use transactions for operations that must remain consistent.
- Use database constraints for core relationships.
- Define explicit retention and deletion behavior before supporting large-scale ingestion.

---

# 10. API Requirements (Full API Stretch)

The routes below describe the eventual full API and are stretch except for the minimum needed by the committed flow. Committed endpoints: `POST /api/v1/experiments`, `GET /api/v1/experiments/:id`, and `GET /api/v1/experiments/:id/results`. Import the pinned SciFact corpus through the CLI. Other dataset-management, case-authoring, playground, list, compare, failure, and report routes are stretch. All endpoints should use the `/api/v1` prefix.

The API should return consistent JSON responses, appropriate HTTP status codes, and actionable error messages.

## 10.1 Dataset APIs

### POST `/api/v1/datasets`

Creates a dataset.

Expected request:
- Name.
- Optional description.

Response:
- Dataset ID.
- Dataset metadata.

### GET `/api/v1/datasets`

Lists datasets.

Supports pagination.

### GET `/api/v1/datasets/:datasetId`

Returns dataset details and available versions.

### POST `/api/v1/datasets/:datasetId/documents`

Uploads or registers documents for ingestion.

### GET `/api/v1/datasets/:datasetId/documents`

Lists documents and their ingestion states.

## 10.2 Evaluation APIs

### POST `/api/v1/evaluation-datasets`

Creates an evaluation dataset.

### POST `/api/v1/evaluation-datasets/:id/cases`

Adds labelled evaluation cases.

### POST `/api/v1/evaluation-datasets/:id/import`

Imports cases from JSON or CSV when import support is implemented.

### GET `/api/v1/evaluation-datasets/:id/cases`

Lists evaluation cases.

## 10.3 Retrieval APIs

### POST `/api/v1/retrieval/query`

Executes a single retrieval request.

Example request:

```json
{
  "datasetVersionId": "dataset-version-id",
  "query": "What is the reimbursement limit?",
  "config": {
    "strategy": "dense",
    "topK": 5
  }
}
```

Example response:

```json
{
  "query": "What is the reimbursement limit?",
  "results": [
    {
      "chunkId": "chunk-123",
      "documentId": "document-456",
      "rank": 1,
      "score": 0.87
    }
  ],
  "latencyMs": 42
}
```

The example score and latency are illustrative. Actual responses must contain measured values, and the score must be documented according to the retrieval implementation.

## 10.4 Experiment APIs

### POST `/api/v1/experiments`

Creates and starts an experiment.

### GET `/api/v1/experiments`

Lists experiments with pagination and optional filters.

### GET `/api/v1/experiments/:id`

Returns experiment configuration, lifecycle status, progress, and summary.

### GET `/api/v1/experiments/:id/results`

Returns per-case results.

### GET `/api/v1/experiments/:id/failures`

Returns failed or regressed evaluation cases.

### POST `/api/v1/experiments/compare`

Compares two compatible experiments.

### GET `/api/v1/experiments/:id/report`

Returns or downloads an experiment report.

## 10.5 Error Handling

The API should distinguish:
- Invalid input.
- Missing resources.
- Conflicting dataset versions.
- Provider failures.
- Rate limits.
- Database failures.
- Unsupported operations.
- Internal errors.

Internal stack traces, secrets, and sensitive implementation details must not be exposed to clients.

---

# 11. Frontend Requirements

## 11.1 Thin Benchmark UI (Committed)

The committed interface is one thin benchmark screen to start a run and inspect its aggregate/per-query results. The following dashboard and management pages are stretch scope. The eventual dashboard may provide a concise overview of:
- Total datasets.
- Total experiments.
- Recent benchmark runs.
- Latest completed results.
- Failed runs.
- Configured regression alerts.

These metrics should be derived from actual stored data.

## 11.2 Dataset Management Page

Features:
- Create and select datasets.
- Upload supported documents.
- Inspect ingestion status.
- View document metadata.
- Browse document versions.
- Inspect chunks when permitted.

## 11.3 Evaluation Dataset Page

Features:
- Create evaluation datasets.
- Add and edit cases.
- Import JSON or CSV.
- Validate expected source references.
- Filter by category and difficulty.
- Identify cases missing labels.

## 11.4 Retrieval Playground

Features:
- Enter a query.
- Select a dataset version.
- Configure retrieval parameters.
- Execute a single retrieval.
- View ranked chunks.
- Inspect source metadata and scores.
- Compare different configurations.

## 11.5 Experiment Creation Page

Features:
- Select a dataset version.
- Select an evaluation dataset version.
- Configure retrieval strategy.
- Set top-k values.
- Configure supported retrieval parameters.
- Start an experiment.
- View validation errors before execution.

## 11.6 Experiment Results Page

Features:
- Display aggregate metrics.
- Show latency distributions.
- Display success and failure counts.
- Browse per-query metrics.
- Filter weak cases.
- Inspect retrieval traces.
- Export reports.

## 11.7 Experiment Comparison Page

Features:
- Select a baseline and candidate.
- Display absolute and relative metric changes.
- Highlight configured threshold violations.
- Identify improved, unchanged, and regressed queries.
- Link to detailed traces for affected cases.

The interface should prioritize information density and clarity. Visualizations should explain engineering behavior rather than serve as decoration.

---

# 12. Evaluation Dataset and Benchmark Methodology

## 12.1 Initial Corpus

Use the **SciFact test split from the BEIR benchmark** as the first fixed retrieval corpus. It provides a concrete scientific-claim verification task with a corpus of roughly 5,000 scientific abstracts, 300 test queries, and query-to-document relevance judgments. The BEIR dataset listing reports 5K corpus documents and 300 test queries; the loader and source files are available from the [BEIR dataset documentation](https://github.com/beir-cellar/beir/wiki/Datasets-available) and the [BEIR repository](https://github.com/beir-cellar/beir).

Load the published corpus, queries, and qrels rather than inventing labels for the first baseline. Preserve the upstream document/query IDs and record the dataset release, split, download URL, and content hashes with the benchmark. Check the dataset's license and attribution terms before redistributing a copy; the project may instead provide a documented download/import step. Keep a small checked-in fixture for deterministic unit and end-to-end tests, separate from the full benchmark data.

SciFact makes retrieval comparisons reproducible and gives the project a named, inspectable baseline. It is a narrow scientific retrieval task, not evidence that a system will perform equally well on enterprise policy or general-purpose corpora. A project-specific corpus can be added later as a separate labeled evaluation set.

## 12.2 Dataset Quality

Every evaluation case must have explicit relevance labels.

Labels should be reviewed manually or through a documented annotation process.

Automatically generated questions may help expand coverage, but generated labels must not be assumed correct without validation.

## 12.3 Experiment Controls

To ensure meaningful comparisons:
- Use the same dataset version.
- Use the same evaluation cases.
- Record embedding model identifiers.
- Record chunking and retrieval configurations.
- Keep relevant evaluation code consistent.
- Record provider failures and incomplete runs.
- Separate warm-up requests from measured requests when necessary.
- Repeat latency measurements when meaningful comparisons require it.

## 12.4 Reporting

Every report should include:
- Experiment ID.
- Dataset and evaluation dataset versions.
- Retrieval configuration.
- Metric definitions.
- Aggregate metric values.
- Query-level results.
- Execution errors.
- Latency measurements.
- Known limitations.
- Timestamp and software version.

The platform must not claim that a configuration is universally superior based on one small dataset.

---

# 13. Testing Strategy

## 13.1 Unit Tests

Required tests include:
- Recall@k calculations.
- Precision@k calculations.
- MRR calculations.
- nDCG calculations when implemented.
- Duplicate source handling.
- Empty result handling.
- Invalid relevance labels.
- Missing relevant results.
- Chunk boundary logic.
- Configuration validation.
- Experiment state transitions.

Metric tests must use small, hand-calculated examples.

## 13.2 Integration Tests

Test:
- Document ingestion into PostgreSQL.
- Chunk persistence.
- Embedding storage.
- Dense retrieval.
- Evaluation case loading.
- Experiment result persistence.
- Baseline comparison.
- Failed provider calls.
- Database error handling.

Use a dedicated test database and deterministic fixtures where possible.

## 13.3 End-to-End Tests

A complete test should:
1. Create a dataset.
2. Ingest sample documents.
3. Create evaluation cases.
4. Run a benchmark.
5. Inspect aggregate metrics.
6. Inspect a failed case.
7. Compare two runs.
8. Export a report.

## 13.4 Regression Tests

The evaluation metric implementation itself must be protected by automated tests.

Changes to retrieval code should be evaluated against a fixed benchmark dataset.

A regression should be reported even if the candidate improves another metric. For example, better Recall@5 may coexist with worse p95 latency.

## 13.5 Security Tests

Test:
- Invalid file types.
- Oversized uploads.
- Malformed JSON.
- Injection attempts in document contents.
- SQL injection attempts.
- Invalid IDs and resource access.
- Rate-limit behavior.
- Secret redaction in logs.

---

# 14. Full-Product Acceptance Criteria (Stretch Beyond Solo MVP)

The full product vision is considered complete when all criteria below are met. The solo MVP release gate is the narrower commitment in Section 3.4 and the Phase 0–3 roadmap plus thin UI; items below that fall outside that scope remain stretch work.

### Dataset and ingestion
- [ ] Users can create a dataset.
- [ ] Supported documents can be ingested.
- [ ] Documents are chunked and indexed.
- [ ] Document and dataset versions are identifiable.
- [ ] Ingestion errors are visible.

### Evaluation
- [ ] Users can define labelled evaluation cases.
- [ ] Recall@k is implemented and tested.
- [ ] Precision@k is implemented and tested.
- [ ] MRR is implemented and tested.
- [ ] Metrics are available per query and in aggregate.
- [ ] Missing labels are not silently treated as negative relevance.

### Retrieval
- [ ] Dense retrieval works against the indexed corpus.
- [ ] Top-k is configurable.
- [ ] Retrieved results include source IDs and ranks.
- [ ] A retrieval trace is persisted for completed cases.

### Experiments
- [ ] Users can execute a benchmark against a fixed dataset.
- [ ] Experiment status is persisted.
- [ ] Per-case results and aggregate metrics are stored.
- [ ] Two compatible experiments can be compared.
- [ ] The report identifies per-query improvements and regressions.

### Reliability
- [ ] Provider and database failures are handled.
- [ ] Logs include relevant request or experiment identifiers.
- [ ] Metric calculations have unit tests.
- [ ] An end-to-end benchmark test passes.
- [ ] Secrets are excluded from client responses and logs.

### Developer experience
- [ ] A developer can run the project using documented instructions.
- [ ] A sample dataset is included.
- [ ] The benchmark can be executed without the dashboard.
- [ ] A reproducible example report is available.
- [ ] Architecture and API documentation are present.

---

# 15. Development Roadmap

## Phase 0: Project Foundation

**Objective:** Establish a clean and testable development environment.

Deliverables:
- TypeScript project configuration.
- PostgreSQL and pgvector setup.
- Environment configuration.
- Database connection module.
- Logging and error-handling foundations.
- Linting and test setup.
- Initial repository documentation.

Exit criterion: The application starts successfully, connects to the database, and passes a basic health check.

## Phase 1: Evaluation Core

**Objective:** Validate the metric calculations independently of external services.

Deliverables:
- Evaluation case types.
- Retrieval result types.
- Recall@k.
- Precision@k.
- MRR.
- Metric unit tests.
- JSON-based benchmark fixtures.
- Command-line output.

Exit criterion: A deterministic benchmark fixture produces verified metrics.

## Phase 2: SciFact Import and Retrieval

**Objective:** Connect the evaluator to an actual retrieval pipeline.

Deliverables:
- Pinned BEIR SciFact corpus/query/qrels importer.
- One abstract per retrieval item; no general parser or chunker.
- Local embedding adapter and embedding storage.
- Dense retrieval plus a canonical BM25 reference run for evaluator calibration.
- Ranked result traces and retrieval timing.

Exit criterion: The benchmark retrieves SciFact abstracts and evaluates their ranked source IDs against the imported test qrels.

## Phase 3: Experiment Persistence

**Objective:** Make experiments reproducible.

Deliverables:
- Dataset persistence.
- Evaluation dataset versions.
- Experiment records.
- Per-case results.
- Aggregate summaries.
- Configuration persistence.
- Experiment comparison logic.

Exit criterion: Two experiment runs can be retrieved and compared after the application restarts.

## Phase 4: Thin UI (committed slice) and Full Dashboard (stretch)

**Objective:** Make the committed benchmark workflow usable through a minimal interface.

Committed slice:
- One thin UI to start a benchmark and inspect aggregate and per-query results.
- Only the API endpoints required for this workflow.

Stretch deliverables:
- Full REST surface and dataset/evaluation-dataset management pages.
- Retrieval playground, broad results visualization, failure explorer, and comparison page.

Exit criterion for the committed slice: A user can start the benchmark and inspect its results through the thin interface.

## Phase 5: Reliability and Regression Testing

**Objective:** Make benchmark results actionable.

Deliverables:
- Configurable regression thresholds.
- Candidate-versus-baseline checks.
- Error categorization.
- Latency percentiles.
- Exportable reports.
- CI-compatible command-line execution.

Exit criterion: A deliberately degraded retrieval configuration triggers a reproducible regression report.

## Phase 6: Advanced Evaluation

**Objective:** Extend evaluation beyond retrieval.

Deliverables:
- Hybrid retrieval.
- Optional reranking.
- LLM answer generation.
- Faithfulness and answer relevance evaluation.
- Token usage and cost tracking.
- Category-level evaluation.
- Additional provider integrations.

Exit criterion: The platform can separately report retrieval performance and answer-quality measurements.

---

# 16. Solo MVP Timeline and Effort

Estimate: **8–11 weeks at 10–15 hours per week** (about **90–155 hours**), including a modest integration buffer. This is an effort estimate, not a calendar-date promise; it assumes one developer, a local PostgreSQL/pgvector setup, and no production authentication or deployment work.

| Work | Estimate | Exit evidence |
|---|---:|---|
| Phase 0: project foundation | 1 week / 10–15 hours | App and database start locally; documented setup and health check |
| Phase 1: evaluation core | 1–2 weeks / 15–25 hours | Hand-calculated metric fixtures pass; CLI can score fixture results |
| Phase 2: SciFact import and dense retrieval | 2–3 weeks / 20–40 hours | Imported corpus and qrels produce ranked results and measured retrieval traces |
| Phase 3: persistence and comparison | 2 weeks / 20–30 hours | Runs persist across restart and compatible runs can be compared |
| Thin UI and end-to-end hardening | 1–2 weeks / 15–30 hours | User starts a benchmark and inspects aggregate/per-query outcomes in the UI |
| Integration buffer | 1 week / 10–15 hours | Setup, data, and failure-path issues resolved; reproducible example documented |

The range is intentionally broad because document import, pgvector setup, and frontend integration are uncertain until prototyped. If the work exceeds the estimate, reduce interface polish or defer UI breadth; preserve metric correctness, reproducibility, and the complete benchmark path.

## Stretch after the committed MVP

Phases 4–6 in the roadmap are stretch scope except for the thin UI described above. Full dataset administration, broad dashboard pages, CSV import, keyword/hybrid search, reranking, regression thresholds, CI integration, and LLM answer evaluation should be scheduled only after the MVP acceptance gate is met.

---
# 17. Risks and Mitigation

## Risk 1: Misleading metrics

**Problem:** Incorrect relevance labels produce misleading evaluation results.

**Mitigation:** Use a curated dataset, document label definitions, and inspect representative cases manually.

## Risk 2: Unfair experiment comparisons

**Problem:** Different datasets, model versions, or configurations make comparisons unreliable.

**Mitigation:** Persist versions and reject or warn about incompatible runs.

## Risk 3: External provider instability

**Problem:** API limits, timeouts, and model changes affect results.

**Mitigation:** Use provider adapters, retries where safe, bounded concurrency, and explicit error recording.

## Risk 4: Excessive scope

**Problem:** Implementing dashboards, multiple vector databases, agents, rerankers, and answer evaluation simultaneously delays the core deliverable.

**Mitigation:** Build and test the metric engine first, then integrate retrieval, persistence, and UI in sequence.

## Risk 5: Expensive embedding generation

**Problem:** Repeated indexing increases cost and execution time.

**Mitigation:** Cache embeddings using content hashes, model identifiers, and compatible configuration keys.

## Risk 6: Non-deterministic evaluation

**Problem:** External services may produce different outputs across runs.

**Mitigation:** Separate deterministic retrieval-metric tests from provider-dependent integration tests and record model versions.

## Risk 7: Sensitive documents

**Problem:** Uploaded corpora may contain confidential business information.

**Mitigation:** Use public or synthetic documents initially, limit logging of raw content, and implement access controls before supporting private multi-user deployments.

## Risk 8: False confidence from aggregate metrics

**Problem:** A strong average may hide failures affecting critical queries.

**Mitigation:** Retain per-query metrics, support category-level breakdowns, and make regressions inspectable.

---

# 18. Success Metrics

Success should be evaluated at three levels.

## 18.1 Product Functionality

- All committed solo MVP release-gate criteria in Section 3.4 pass.
- The complete benchmark workflow runs end to end.
- Results persist across restarts.
- Benchmark reports can be reproduced from recorded configurations.
- Failed cases can be investigated without rerunning the entire experiment.

## 18.2 Engineering Quality

- Metric calculations are covered by unit tests.
- Integration and end-to-end tests validate the critical workflow.
- API errors are explicit and consistent.
- Experiment state transitions are valid.
- External provider failures are visible.
- No credentials are exposed in logs or reports.

## 18.3 Evaluation Value

The solo MVP should demonstrate:
- Dense retrieval with the selected local embedding model and the canonical BM25 metric-calibration run.
- A baseline-versus-candidate comparison.
- At least one inspected weak or failed query.
- A reproducible report with per-query and aggregate metrics.

Additional retrieval configurations, latency trade-off studies, and multiple investigated failures remain stretch evaluation goals.

The project must not define success as achieving an arbitrary retrieval-accuracy percentage. A credible evaluation tool measures the behavior of a system rather than manufacturing a favorable score.

---

# 19. Future Enhancements

The following capabilities may be considered after the MVP is stable.

### 19.1 Retrieval Optimization

- Automated configuration sweeps.
- Parameter search.
- Reranker selection.
- Chunking strategy comparisons.
- Cost-quality optimization.

### 19.2 Advanced Observability

- Multi-stage pipeline traces.
- Context-window utilization.
- Token-level cost attribution.
- Provider-specific latency breakdowns.
- Retrieval drift detection.

### 19.3 Production Integration

- CI/CD quality gates.
- GitHub Actions integration.
- Webhooks.
- Benchmark scheduling.
- Regression alerts.
- Historical performance trends.

### 19.4 Multi-User Support

- Authentication.
- Role-based access control.
- Dataset ownership.
- Tenant isolation.
- Usage quotas.
- Audit events.

### 19.5 Additional Retrieval Systems

- External vector database adapters.
- Additional lexical search engines.
- Multiple reranking providers.
- Framework integrations.
- Import and evaluation adapters for existing RAG pipelines.

### 19.6 Answer Evaluation

- Reference-answer comparisons.
- Faithfulness evaluation.
- Citation correctness.
- Human review workflows.
- LLM-based judges with recorded rubrics.

These enhancements should be prioritized according to demonstrated user needs rather than implemented merely to increase the number of features.

---

# 20. Initial Repository Structure

The repository should separate the core evaluation logic from infrastructure and interface code.

```text
ragre/
├── src/
│   ├── config/
│   │   └── env.ts
│   ├── ingestion/
│   │   ├── document-parser.ts
│   │   ├── chunker.ts
│   │   └── ingestion.service.ts
│   ├── embeddings/
│   │   ├── embedding.interface.ts
│   │   └── embedding.service.ts
│   ├── retrieval/
│   │   ├── retrieval.interface.ts
│   │   ├── dense-retriever.ts
│   │   ├── keyword-retriever.ts
│   │   └── hybrid-retriever.ts
│   ├── evaluation/
│   │   ├── metrics.ts
│   │   ├── evaluator.ts
│   │   └── benchmark.ts
│   ├── experiments/
│   │   ├── experiment.service.ts
│   │   ├── comparison.service.ts
│   │   └── regression.service.ts
│   ├── db/
│   │   ├── connection.ts
│   │   ├── repositories/
│   │   └── migrations/
│   ├── api/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   └── app.ts
│   ├── cli/
│   │   └── benchmark.ts
│   └── index.ts
├── frontend/
├── datasets/
│   ├── documents/
│   └── evaluation-cases.json
├── reports/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── docs/
│   ├── architecture.md
│   ├── api.md
│   └── metrics.md
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

This is a target structure, not a requirement to create every file at the beginning. Directories should be introduced as their functionality is implemented.

---

# 21. Implementation Principles

The development process shall follow these principles:

1. **Correctness before presentation.** Validate metric calculations before investing heavily in the dashboard.
2. **Measure before optimizing.** Establish a baseline before claiming a retrieval improvement.
3. **Reproducibility by design.** Persist dataset versions and experiment configurations from the beginning.
4. **Modular architecture without premature complexity.** Use clear service boundaries inside a modular monolith.
5. **Failures are data.** Preserve useful error information rather than silently skipping failed cases.
6. **Separate retrieval from generation.** Evaluate each stage independently.
7. **Security from the beginning.** Protect secrets and treat documents as untrusted input.
8. **Honest reporting.** Display actual results and limitations, including negative results.
9. **Test critical logic independently.** Evaluation metrics must be testable without a database or LLM.
10. **Build incrementally.** Each phase must have a working deliverable before the next major phase begins.

---

# 22. Final Product Definition

RAGRE will be considered a successful initial product when a developer can provide a document corpus and a labelled evaluation dataset, execute multiple retrieval configurations, inspect ranked results, calculate meaningful retrieval metrics, compare experiments, investigate regressions, and reproduce the benchmark from its recorded configuration.

The MVP's central deliverable is a reliable benchmark engine supported by a usable interface and a reproducible evaluation workflow.

Its defining characteristic is not that it uses AI. It is that it helps engineers establish, with evidence, whether an AI retrieval system is working well and where it needs improvement.

**Final product principle: Every performance claim should be supported by a reproducible experiment, every metric should have a documented definition, and every identified failure should be inspectable.**
