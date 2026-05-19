# Ticket: T-038 - Fix Report Configurator Bugs

## Status: COMPLETED

## Description
The Report Configurator page has two main issues when a user triggers an AI prompt:
1. **Filters & Date Ranges Not Re-loading**: The `ReportFiltersSection` component only initializes its state on mount, failing to react when the AI updates the global report config.
2. **Missing Live Logs on Prompting**: The `fetchLivePreview` function calls the standard `/generate` endpoint instead of the `/generate/stream` endpoint and does not clear `processingLogs`, leading to a stuck loading overlay with 0 steps.

## Scope
- `frontend`

## Requirements
- `ReportFiltersSection` must re-populate its `dateRows` and `filterRows` whenever `state.config.date_range_fields` or `state.config.filters` change.
- `fetchLivePreview` in the configurator page must use `/api/templates/[id]/generate/stream` to fetch the preview and stream the logs to `state.processingLogs` so the UI correctly reflects the generation steps.
