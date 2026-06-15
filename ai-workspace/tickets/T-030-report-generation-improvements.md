# T-030 — Report Generation: Comprehensive Improvements

**Status**: COMPLETED
**Scope**: fullstack
**Created**: 2026-05-06

## Summary
Multi-part improvement to the report generation system covering:
1. Bug: Stream route missing setup_id reusable setup fallback
2. Feature: Live SSE streaming logs in Admin Configurator during "Update"
3. Cleanup: Delete dead SubmitToolbar.tsx
4. AI System Instruction: Enforce config rules & fix field-overlap/grouping duplication rule
5. Config Sanitization: Auto-sanitize/fix AI-generated config before saving/rendering
6. Auto-initialize fix: Trigger suggestions only when no preview data exists, not on new thread
7. New thread context: Verify predefinedPrompt (schema+config) is correctly passed on new thread

## Acceptance Criteria
- [ ] Stream route fallback for reusable setup_id works
- [ ] Admin "Update" shows live log panel (SSE stream)
- [ ] SubmitToolbar.tsx deleted
- [ ] System instruction updated with field-overlap rule + removed non-essential verbosity
- [ ] sanitizeReportConfig() function strips invalid cross-section fields
- [ ] autoInitialize triggers ONLY when preview_data is absent
- [ ] New thread correctly sends predefinedPrompt with full schema+config context
