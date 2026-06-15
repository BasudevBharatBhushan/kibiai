# P-039: Implementation Plan for fetchFmRecord Batching

## Context
See `ai-workspace/tickets/T-039-refactor-fetchfmrecord.md`.

## Step-by-Step Implementation

### Step 1: Implement Array Chunking Helper
- Add a small helper function `chunkArray(array, size)` inside `src/lib/utils/utility.ts` to divide the `p_keys` array into smaller arrays (e.g., of size 100).

### Step 2: Refactor Data API `_find` Logic
- Modify the `fetchFmRecord` function's Data API section where `p_keys` are processed.
- Instead of creating a single `queries` array and sending one request, determine if chunking is needed (e.g., `p_keys.length > 0`).
- Create an array of `fetchUrl` promises.
  - Iterate through the chunks of `p_keys`.
  - For each chunk, construct the `query` array with `offset: 1` and `limit: 5000`.
  - Push the `fetch(fetchUrl, ...)` promise to a `requestPromises` array.
- Use `Promise.all(requestPromises)` to run the batches concurrently.
  - To prevent overloading the Node server or FileMaker, consider processing them in sequential batches if the number of chunks is extremely large, but a single `Promise.all` with 20-30 chunks (for ~2000 records at 100 per chunk) should be safe.

### Step 3: Aggregate Batch Results
- After `Promise.all` resolves, iterate through all responses.
- Check each response for errors (handling the specific 500 / 401 empty result quirk).
- Parse the JSON for successful responses.
- Combine the `data` arrays from all responses into a single flat array.
- Sum up the `foundCount` values (or just use the length of the final merged array) to return an accurate `recordCount`.

### Step 4: Refactor OData API Logic
- The OData logic currently creates a massive batch request (`$batch`) with potentially thousands of parts.
- Refactor the OData `$batch` logic to also chunk the `p_keys` (e.g., 50-100 operations per `$batch` request) and send multiple `$batch` requests via `Promise.all()`.
- Aggregate the parsed OData results similarly.

### Step 5: Testing
- Run `test_configurator_generation.js` with `data-api`.
- Validate that the response completes without timing out, and the number of records returned matches the expected total.
- Run the test again with `o-data-api` to ensure OData chunking is successful and performs better than the hanging state.

## Status
- [ ] Step 1: Implement Array Chunking Helper
- [ ] Step 2: Refactor Data API `_find` Logic
- [ ] Step 3: Aggregate Batch Results
- [ ] Step 4: Refactor OData API Logic
- [ ] Step 5: Testing
