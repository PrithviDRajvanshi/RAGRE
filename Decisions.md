# Decision Record

This file records pivotal choices that shape the work and why they were made. It separates requirements already stated in the PRD from design proposals made while drafting the TRD. Proposed choices are not silently treated as settled product decisions.

## Confirmed by the PRD

### D-001: Make reproducible retrieval evaluation the MVP center

**Status:** Confirmed requirement  
**Decision:** Deliver a benchmark workflow for labeled queries, ranked retrieval results, retrieval metrics, experiment comparison, and failure inspection before expanding into answer generation.

**Why:** The product's value is evidence about retrieval behavior. The PRD explicitly puts retrieval quality and reproducibility first and defers LLM generation evaluation to a later layer.

**Consequence:** Metric correctness, per-case traces, dataset/version identity, and run metadata are core requirements rather than dashboard polish.

### D-002: Use a modular monolith for the initial implementation

**Status:** Confirmed direction  
**Decision:** Keep the initial system in a modular application with clear boundaries between ingestion, embeddings, retrieval, evaluation, experiments, persistence, API, CLI, and frontend.

**Why:** The PRD's initial repository structure and principles call for modular boundaries without premature complexity; distributed execution is a non-goal for the MVP.

**Consequence:** Services and interfaces should support substitution and testing without adding networked services before they are needed.

### D-003: Use the PRD's named initial technology stack

**Status:** Confirmed direction  
**Decision:** TypeScript, Node.js, PostgreSQL, pgvector, and React are the initial stack.

**Why:** These are explicitly named in the PRD. The detailed framework/library choices within that stack remain open.

**Consequence:** The technical design uses PostgreSQL as the source of truth and pgvector for dense vector storage, while leaving specific frameworks, ORM, and UI libraries undecided.

## Proposed in the TRD; validate during implementation

### D-004: Keep metric calculations pure and infrastructure-independent

**Status:** Proposed  
**Decision:** Implement Recall@k, Precision@k, MRR, nDCG@k, and aggregation as deterministic functions separated from database and provider code.

**Why:** This makes metric behavior easy to verify and prevents provider variability from contaminating the core evaluation logic.

**Consequence:** Metric definitions and edge cases must be documented; unit tests can use fixed fixtures without external services.

### D-005: Persist immutable experiment inputs and per-case outcomes

**Status:** Proposed implementation detail  
**Decision:** Each run should reference fixed dataset and evaluation versions, store a configuration snapshot, and retain per-case results; derive aggregate summaries from those results.

**Why:** The PRD requires reproducibility, comparison, and failure investigation. Immutable references provide a practical basis for those capabilities.

**Consequence:** Schema and retention choices need to preserve version identity. Recompute-vs-snapshot policy for aggregates can be finalized with the schema.

### D-006: Start with dense retrieval and add strategies incrementally

**Status:** Proposed sequencing  
**Decision:** Implement dense retrieval first, then keyword/hybrid retrieval and optional reranking as subsequent increments.

**Why:** The PRD defines a phased roadmap and calls out scope risk. A shared retriever contract allows comparison without building every strategy up front.

**Consequence:** The first benchmark demonstrates a narrow but complete flow. Initial embedding provider and database vector index remain open choices.

### D-007: Keep long-running experiment execution behind a service boundary

**Status:** Proposed  
**Decision:** The API should return an experiment ID and expose status/results; the experiment service should not depend on inline execution versus a queue.

**Why:** The PRD requires reliable handling of long-running jobs, but does not select an execution technology. A boundary preserves the option to start simply and add a queue if evidence warrants it.

**Consequence:** Queue selection and deployment topology are deferred; do not imply durable background guarantees until the mechanism is chosen.

### D-008: Keep retrieval quality separate from operational and answer-quality measurements

**Status:** Proposed reporting rule  
**Decision:** Report relevance metrics, latency/errors, and future answer-quality metrics as distinct groups.

**Why:** The PRD emphasizes isolating retrieval from generation failures and measuring quality/latency/cost trade-offs honestly.

**Consequence:** Failed retrievals remain visible as errors rather than silently becoming empty successful results; answer evaluation can be added without changing retrieval metric meanings.

## Still open

These items need a decision when the relevant implementation phase starts: API and frontend frameworks; whether to add a project-specific corpus or general document parsers; chunking defaults for future corpora; pgvector distance/index strategy; metric aggregation and empty-label semantics; experiment queue; import/export formats; and deployment/authentication scope.

When one is resolved, add a dated record with the chosen option, alternatives, evidence, and consequences. Update the matching open item in [TRD.md](TRD.md) so this log and the design stay aligned.

## Decisions added while narrowing the PRD

### D-009: Position the product as a focused retrieval benchmark tool

**Status:** Project positioning  
**Decision:** Describe RAGRE as a lightweight, self-hosted, reproducibility-first tool centered on retrieval comparisons using PostgreSQL/pgvector. Treat it as a focused engineering project, not a feature-for-feature alternative to Ragas, DeepEval, TruLens, Phoenix, or LangSmith.

**Why:** Those products already cover meaningful parts of evaluation, tracing, and experimentation. The defensible project goal is to demonstrate one concrete workflow and a Postgres-native retrieval baseline, without claiming that competitors lack self-hosting or reproducibility features.

**Consequence:** The PRD explicitly allows users to stay with existing tools if they meet their needs. This differentiation remains a hypothesis to validate, not a claim of superiority.

### D-010: Limit the solo MVP to Phases 0–3 plus a thin UI

**Status:** Scope commitment  
**Decision:** The committed slice is project foundation, evaluation core, corpus import/dense retrieval, persistence/comparison, and a minimal UI to start a run and inspect aggregate/per-query results. Broader dashboard pages, additional retrieval strategies, CI regression gates, and answer evaluation are stretch work.

**Why:** The original scope spans more work than a solo project can reliably finish. A narrow end-to-end deliverable protects the core value: reproducible retrieval measurements and inspectable outcomes.

**Consequence:** The PRD's broad functional requirements and full-product acceptance criteria remain vision/stretch scope; Section 3.4 and the solo release gate define completion for the first release.

### D-011: Use BEIR SciFact as the initial fixed benchmark corpus

**Status:** Initial dataset choice  
**Decision:** Use the published SciFact test split, with its corpus, 300 test queries, relevance judgments, and upstream identifiers, as the first benchmark. Keep a small fixture for automated verification and document the upstream release, hashes, and attribution/license terms.

**Why:** It replaces an unspecified document collection with a named retrieval benchmark that has existing labels and can be reproduced. Its scientific-claim domain is intentionally narrow.

**Consequence:** Report results as SciFact retrieval results, not as evidence of performance on enterprise policy corpora or general RAG tasks. Check redistribution terms before including the full dataset in the repository.

### D-012: Estimate the solo release at roughly 8–11 weeks

**Status:** Planning estimate  
**Decision:** Plan for about 8–11 weeks at 10–15 hours per week (roughly 90–155 estimated hours), including integration buffer.

**Why:** A phase-by-phase estimate makes the solo scope reviewable while acknowledging unknowns in corpus import, vector search, and UI integration.

**Consequence:** This is a planning range, not a delivery promise. If the estimate slips, preserve benchmark correctness and reproducibility and defer interface breadth.

### D-013: Use a local embedding model for the first dense retriever

**Status:** Chosen for the solo MVP  
**Decision:** Use [`onnx-community/all-MiniLM-L6-v2-ONNX`](https://huggingface.co/onnx-community/all-MiniLM-L6-v2-ONNX) through `@huggingface/transformers`, with mean pooling, normalization, and 384-dimensional vectors.

**Why:** Local inference avoids per-request embedding API charges for indexing the roughly 5,000 SciFact abstracts and keeps the initial workflow usable without provider credentials. The model has a Transformers.js-compatible ONNX version.

**Consequence:** Download and cache model files locally, record the model/revision and pooling configuration, and use the same model for corpus and query embeddings. Results are a benchmark for this model and corpus, not a general quality claim. Additional embedding providers remain future work.

### D-014: Calibrate nDCG@10 with the published SciFact BM25 run

**Status:** Release-gate check  
**Decision:** Score the canonical BEIR SciFact BM25 rankings against the test qrels with the project evaluator and require nDCG@10 to agree with the official BEIR evaluator within 0.001. Record the published value (0.665) and Anserini/Lucene settings (k1=0.9, b=0.4), as documented in the [BEIR paper](https://arxiv.org/abs/2104.08663).

**Why:** Hand-calculated unit examples verify edge cases, while a published ranked run checks the implementation against a real benchmark and its relevance labels.

**Consequence:** Keep this evaluator calibration separate from any PostgreSQL-native ranking; tokenization and scoring differences can change retrieval rankings and scores.
