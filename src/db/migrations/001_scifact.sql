CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE documents (
  id text PRIMARY KEY,
  title text,
  text text NOT NULL
);

CREATE TABLE queries (
  id text PRIMARY KEY,
  text text NOT NULL
);

CREATE TABLE qrels (
  query_id text NOT NULL REFERENCES queries(id) ON DELETE CASCADE,
  doc_id text NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  grade integer NOT NULL,
  PRIMARY KEY (query_id, doc_id)
);

CREATE TABLE doc_embeddings (
  doc_id text NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  model text NOT NULL,
  embedding vector(384) NOT NULL,
  PRIMARY KEY (doc_id, model)
);
