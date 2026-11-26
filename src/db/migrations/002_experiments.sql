CREATE TABLE experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  status text NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'completed_with_errors', 'failed')),
  config jsonb NOT NULL,
  dataset_manifest jsonb NOT NULL,
  embedding_model text NOT NULL,
  app_version text,
  started_at timestamptz,
  completed_at timestamptz,
  aggregate_metrics jsonb,
  latency jsonb,
  error_summary text
);

CREATE TABLE experiment_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id uuid NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  query_id text NOT NULL REFERENCES queries(id),
  status text NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
  retrieved jsonb,
  metrics jsonb,
  flags jsonb,
  embedding_ms integer,
  search_ms integer,
  error_category text,
  error_message text,
  UNIQUE (experiment_id, query_id)
);
