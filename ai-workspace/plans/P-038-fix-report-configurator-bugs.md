# Implementation Plan: P-038 - Fix Report Configurator Bugs

## Overview
Implement fixes in the Report Configurator to properly react to AI responses, ensuring filter UI updates and generation logs stream correctly.

## Step 1: Update `ReportFiltersSection.tsx`
- Refactor the initialization `useEffect` to watch `state.config.date_range_fields` and `state.config.filters`.
- Extract a comparison mechanism to ensure `dateRows` and `filterRows` are only updated from `state.config` if they structurally differ (to avoid infinite loops with the sync `useEffect`).
- This ensures that when the AI Copilot pushes a new configuration, the form fields update immediately.

## Step 2: Update `fetchLivePreview` in `configurator/page.tsx`
- Remove the auto-invocation of `fetchLivePreview()` in the `useEffect` on mount when `data.config_json` exists but `data.preview_data_json` is absent.
- Refactor `fetchLivePreview` to use `fetch` targeting `/api/templates/${templateId}/generate/stream`.
- Reset `processingLogs` before making the request.
- Parse the SSE stream to populate `state.processingLogs` so the loading UI can display the steps.
- Dispatch `SET_REPORT_PREVIEW` when the stream sends the `done` event containing `report_structure_json`.
## Step 3: Verify and Lint
- Run `npm run lint` and `npm run build` after changes to ensure type safety and build success.
