export interface ScifactDocument {
  id: string;
  title: string | null;
  text: string;
}

export interface ScifactQuery {
  id: string;
  text: string;
}

export interface ScifactQrel {
  queryId: string;
  docId: string;
  grade: number;
}

function parseJsonLines<T>(input: string, parseLine: (value: unknown, line: number) => T): T[] {
  return input
    .split(/\r?\n/)
    .flatMap((rawLine, index) => {
      if (!rawLine.trim()) return [];

      let value: unknown;
      try {
        value = JSON.parse(rawLine);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Invalid JSON on line ${index + 1}: ${message}`);
      }

      return [parseLine(value, index + 1)];
    });
}

export function parseCorpusJsonl(input: string): ScifactDocument[] {
  return parseJsonLines(input, (value, line) => {
    if (!value || typeof value !== "object") {
      throw new Error(`Invalid corpus row on line ${line}: expected an object.`);
    }

    const row = value as Record<string, unknown>;
    if (typeof row._id !== "string" || typeof row.text !== "string") {
      throw new Error(`Invalid corpus row on line ${line}: _id and text must be strings.`);
    }
    if (row.title !== undefined && row.title !== null && typeof row.title !== "string") {
      throw new Error(`Invalid corpus row on line ${line}: title must be a string or null.`);
    }

    return {
      id: row._id,
      title: typeof row.title === "string" ? row.title : null,
      text: row.text,
    };
  });
}

export function parseQueriesJsonl(input: string): ScifactQuery[] {
  return parseJsonLines(input, (value, line) => {
    if (!value || typeof value !== "object") {
      throw new Error(`Invalid query row on line ${line}: expected an object.`);
    }

    const row = value as Record<string, unknown>;
    if (typeof row._id !== "string" || typeof row.text !== "string") {
      throw new Error(`Invalid query row on line ${line}: _id and text must be strings.`);
    }

    return { id: row._id, text: row.text };
  });
}

export function parseQrelsTsv(input: string): ScifactQrel[] {
  const lines = input.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];

  const header = lines[0]!.split("\t");
  if (header[0] !== "query-id" || header[1] !== "corpus-id" || header[2] !== "score") {
    throw new Error("Invalid qrels header: expected query-id, corpus-id, score.");
  }

  return lines.slice(1).map((line, index) => {
    const columns = line.split("\t");
    if (columns.length !== 3 || !columns[0] || !columns[1]) {
      throw new Error(`Invalid qrels row on line ${index + 2}: expected three tab-separated columns.`);
    }

    const grade = Number(columns[2]);
    if (!Number.isInteger(grade)) {
      throw new Error(`Invalid qrels grade on line ${index + 2}: expected an integer.`);
    }

    return { queryId: columns[0], docId: columns[1], grade };
  });
}

export function selectTestQueries(
  queries: ScifactQuery[],
  qrels: ScifactQrel[],
): ScifactQuery[] {
  const queryIdsInQrels = new Set(qrels.map((qrel) => qrel.queryId));
  const queryById = new Map(queries.map((query) => [query.id, query]));
  const missingIds = [...queryIdsInQrels].filter((id) => !queryById.has(id));
  if (missingIds.length > 0) {
    throw new Error(`Qrels reference query IDs missing from queries.jsonl: ${missingIds.join(", ")}`);
  }

  return queries.filter((query) => queryIdsInQrels.has(query.id));
}
