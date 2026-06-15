# T-039: Refactor fetchFmRecord Batching

## Context
When running report generation, the internal `fetchFmRecord` engine uses the FileMaker Data API to query related records (`_find` endpoint) by constructing a `query` array using `p_keys`. For large datasets (e.g., 2,000+ primary keys), it sends all conditions in a single, massive payload. This causes FileMaker to hang, return 0 records, or result in 504 Gateway Timeouts, bringing the report generator to a standstill.

## Objective
Refactor `fetchFmRecord` to chunk large `p_keys` arrays into smaller, manageable batches for the FileMaker Data API, and use `Promise.all()` to execute these batches concurrently (with reasonable rate limiting/concurrency control).

## Requirements
- Identify the maximum safe batch size for FileMaker `_find` queries (e.g., 100-200 queries per request).
- Chunk the `p_keys` array based on this limit.
- Map the chunks to separate HTTP requests using `Promise.all()`.
- Aggregate the data results and `foundCount` across all batch promises before flattening the records and returning them to the orchestrator.
- Ensure backwards compatibility with small requests (where chunking is just a single batch).
- Apply similar batching or parallel execution to the OData protocol if applicable, though primarily Data API is affected here.

## Out of Scope
- Changing the `processFetchOrder` logic or how relationships are defined.
- Optimizing FileMaker server performance directly.

## Implementation Plan
See `ai-workspace/plans/P-039-refactor-fetchfmrecord.md`.
