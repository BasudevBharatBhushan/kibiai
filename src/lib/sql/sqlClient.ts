// ---------------------------------------------------------------------------
// SQL HTTP client for the Bun SQLite read-only server.
// Pure module — no React, no Next.js server imports.
// Uses the global fetch (available in Node 18+ / Bun / browser).
// ---------------------------------------------------------------------------

import type { SqlConnection, SqlQuery, QueryResult, SchemaResponse } from './types';

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class SqlClientError extends Error {
  readonly status: number;
  readonly serverMessage: string;

  constructor(status: number, serverMessage: string) {
    super(`SqlClientError [${status}]: ${serverMessage}`);
    this.name = 'SqlClientError';
    this.status = status;
    this.serverMessage = serverMessage;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Strip trailing slashes so we can always safely append /path. */
function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function bearerHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Throw a SqlClientError with a human-readable message extracted from the
 * response body (best-effort; falls back to statusText).
 */
async function throwForStatus(response: Response): Promise<never> {
  const contentType = response.headers.get('content-type') ?? '';
  let serverMessage = response.statusText;

  if (contentType.includes('application/json')) {
    try {
      const body = (await response.json()) as Record<string, unknown>;
      if (typeof body['error'] === 'string') {
        serverMessage = body['error'];
      } else if (typeof body['message'] === 'string') {
        serverMessage = body['message'];
      }
    } catch {
      // JSON parse failed — keep statusText
    }
  } else {
    try {
      const text = await response.text();
      if (text.trim().length > 0) serverMessage = text.trim();
    } catch {
      // ignore
    }
  }

  if (response.status === 401) {
    throw new SqlClientError(401, `Unauthorized — check the apiKey. Server said: ${serverMessage}`);
  }
  if (response.status === 403) {
    throw new SqlClientError(403, `Forbidden — only SELECT/WITH queries are permitted. Server said: ${serverMessage}`);
  }
  throw new SqlClientError(response.status, serverMessage);
}

/** Parse the success body and normalise to QueryResult. */
async function parseQueryResponse(response: Response): Promise<QueryResult> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new SqlClientError(
      response.status,
      `Expected application/json from server but got: ${contentType}`,
    );
  }

  const body = (await response.json()) as Record<string, unknown>;

  const rows = Array.isArray(body['rows'])
    ? (body['rows'] as Record<string, unknown>[])
    : [];

  const rowCount =
    typeof body['rowCount'] === 'number'
      ? body['rowCount']
      : rows.length;

  const columns = Array.isArray(body['columns'])
    ? (body['columns'] as string[])
    : rows.length > 0
      ? Object.keys(rows[0])
      : [];

  return { rows, rowCount, columns };
}

// ---------------------------------------------------------------------------
// SELECT-only guard
// ---------------------------------------------------------------------------

/**
 * Strips leading block comments (/* ... *\/) and line comments (--),
 * then checks that the first significant keyword is SELECT or WITH.
 * Throws SqlClientError(403, ...) if the guard fails.
 */
export function assertReadOnly(sql: string): void {
  // Remove block comments
  let stripped = sql.replace(/\/\*[\s\S]*?\*\//g, ' ');
  // Remove line comments
  stripped = stripped.replace(/--[^\r\n]*/g, ' ');
  // Find first non-whitespace token
  const match = stripped.trimStart().match(/^([A-Za-z]+)/);
  const firstKeyword = match ? match[1].toUpperCase() : '';

  if (firstKeyword !== 'SELECT' && firstKeyword !== 'WITH') {
    throw new SqlClientError(
      403,
      `Client-side SELECT guard rejected the query. First keyword was "${firstKeyword || '(empty)'}". Only SELECT and WITH queries are allowed.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ClientOptions {
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Execute a parameterized SELECT (or WITH …) query against the Bun server.
 * Applies the SELECT-only guard before sending.
 */
export async function runQuery(
  connection: SqlConnection,
  query: SqlQuery,
  opts?: ClientOptions,
): Promise<QueryResult> {
  assertReadOnly(query.sql);

  const url = `${normalizeBaseUrl(connection.host)}/query`;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: bearerHeaders(connection.apiKey),
      body: JSON.stringify({ sql: query.sql, params: query.params }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    await throwForStatus(response);
  }

  return parseQueryResponse(response);
}

/**
 * Fetch the database schema (tables, columns, indexes, foreign keys).
 * Requires Bearer auth.
 */
export async function fetchSchema(
  connection: SqlConnection,
  opts?: ClientOptions,
): Promise<SchemaResponse> {
  const url = `${normalizeBaseUrl(connection.host)}/schema`;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: bearerHeaders(connection.apiKey),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    await throwForStatus(response);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new SqlClientError(
      response.status,
      `Expected application/json from /schema but got: ${contentType}`,
    );
  }

  return (await response.json()) as SchemaResponse;
}

/**
 * Lightweight liveness check — no auth required.
 * Returns true on 2xx, false on any error (network or non-2xx).
 */
export async function checkHealth(
  connection: SqlConnection,
  opts?: ClientOptions,
): Promise<boolean> {
  const url = `${normalizeBaseUrl(connection.host)}/health`;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
