# Proposal for Architecture Migration: PostgreSQL as Primary Reporting Database

## Executive Summary
This document outlines a proposed architectural shift for the KiBiAI reporting engine. Currently, the system queries the FileMaker Data API directly to generate reports. We propose mirroring the necessary FileMaker data into a PostgreSQL (Supabase) database and repointing the reporting engine to query PostgreSQL directly. 

This migration will eliminate the most significant bottlenecks in the current system (specifically around 50k+ row datasets), collapse the backend codebase by approximately 80%, and enable real-time dashboard capabilities that are fundamentally impossible with the current architecture.

## 1. Current Architecture & Limitations

The current reporting flow is linear and highly dependent on Node.js memory:
1. Client requests a report.
2. Backend makes a paginated API call to FileMaker (limited to 5,000 records per request).
3. Backend fetches joined table data in separate API calls.
4. Backend stitches data together in Node.js RAM (O(n×m) complexity).
5. Backend calculates summaries and group totals in JavaScript.
6. Backend pushes the entire dataset to the browser via SSE.

### Critical Bottlenecks
*   **Browser/Memory Freezes (The 50k+ Row Problem):** Node.js struggles to hold, join, and process 50,000+ records in memory. Browsers crash when receiving datasets this large.
*   **Latency:** Fetching data via REST, stitching in JS, and calculating summaries takes 30-90 seconds for large datasets.
*   **"Generate" Button Dependency:** Because processing is so expensive, changing a single filter (e.g., modifying a date range) requires the user to click "Generate" and wait another 30-90 seconds for a full re-fetch and re-stitch.

## 2. Proposed Architecture: PostgreSQL as Source

In the new architecture, FileMaker remains the source of truth for business operations, but data is synced (via ETL/Sync process) to PostgreSQL for reporting.

The reporting engine collapses into a simple SQL Query Builder:
1. Client requests a report page.
2. Backend dynamically constructs standard SQL queries (`SELECT`, `JOIN`, `WHERE`, `GROUP BY`, `LIMIT`) based on the report configuration.
3. PostgreSQL executes the query and returns exactly what is needed (e.g., Page 1 of 100 rows, plus summary totals).
4. Backend sends the small, paginated response to the client.

## 3. Key Improvements & ROI

### A. Infinite Scalability & Zero JS Processing
*   **Current State:** Node.js joins and aggregates data in memory.
*   **Future State:** We eliminate all JavaScript data stitching, joining, and math. PostgreSQL handles joins via optimized database indexes and aggregations via native SQL (`SUM`, `COUNT`, `GROUP BY ROLLUP`). Node.js memory usage drops to near zero.

### B. Instant Interactivity (Dashboards vs. Static Reports)
*   **Current State:** Changing a filter requires a full 30-90 second regeneration.
*   **Future State:** Changing a filter simply updates the `WHERE` clause in the SQL query. PostgreSQL returns the new paginated results and updated summaries in ~1-3 seconds. The "Generate" button can be removed; the report becomes a live, interactive dashboard.

### C. True Pagination at the Database Level
*   **Current State:** We must fetch everything to calculate totals, then figure out pagination.
*   **Future State:** We use SQL `LIMIT` and `OFFSET`. The database only returns the 100 rows the user is currently looking at, completely eliminating browser freezing.

### D. Massive Codebase Reduction
Migrating to PostgreSQL allows us to delete approximately 1,200 lines of complex, error-prone backend logic:
*   ❌ Delete the custom in-memory stitch engine.
*   ❌ Delete the custom JavaScript summary and sub-total generators.
*   ❌ Delete complex FileMaker pagination and token management loops.
*   ✅ **Replace with:** A single, clean `buildReportSQL()` function (~100 lines) and a paginated API route.

## 4. Implementation Phases (Statement of Work)

This migration can be executed in two distinct phases to minimize risk.

### Phase 1: Data Sync Pipeline (ETL)
*   **Objective:** Establish a robust pipeline to mirror required FileMaker layouts to PostgreSQL tables.
*   **Tasks:**
    *   Define schema mapping from FileMaker to PostgreSQL.
    *   Implement an initial bulk import script.
    *   Establish a delta-sync mechanism (e.g., webhooks from FileMaker, or scheduled polling based on modification timestamps) to keep PostgreSQL up-to-date.
*   **Deliverable:** A live PostgreSQL database that accurately reflects the FileMaker data needed for reporting.

### Phase 2: Engine Refactoring
*   **Objective:** Rewrite the Node.js backend to query PostgreSQL instead of the FileMaker Data API.
*   **Tasks:**
    *   Build the `buildReportSQL()` utility to translate the JSON report config into safe, parameterized SQL (using Supabase RPCs to prevent SQL injection).
    *   Replace the current `/generate-report` endpoint with a fast, SQL-backed API.
    *   Implement database-level pagination.
    *   Update the frontend to handle live, paginated data instead of large SSE streams.
*   **Deliverable:** A vastly faster, interactive reporting experience.

## 5. Conclusion
While the current architecture (FileMaker API + Node.js processing) was sufficient for MVP and smaller datasets, it has hit a hard architectural ceiling. By shifting the computational load to PostgreSQL, we are not just fixing bugs; we are moving from a fragile, batch-processing model to a modern, robust, real-time analytics architecture. The upfront cost of building the sync pipeline will be immediately recovered in backend simplicity, performance, and user experience.
