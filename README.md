# RAGRE (RAG Reliability Engine)

Minimal TypeScript scaffold for a local SciFact retrieval benchmark project.

## Setup

1. Start PostgreSQL with pgvector: `docker compose up -d`
2. Copy `.env.example` to `.env`.
3. Install dependencies: `npm install`
4. Check the database: `npm run db:check`
5. Run the tests: `npm test`
