# T-011 — Template Creation & Setup Wizard

## Status: COMPLETED

## Scope: fullstack

## Summary
Implement the end-to-end "Create Template" flow within the Company Workspace. This includes:
1. A "Create Template" trigger on the Templates list page
2. A Template Creation Modal (name + module selection)
3. A dedicated Setup Wizard page per template (`/[company_slug]/templates/[template_id]/setup`)
4. A visual JSON builder (the setup screen) for building and saving `report_template_setup_json`
5. API routes for: creating a template draft, fetching FileMaker layouts, and fetching layout field metadata
6. Persisting the setup JSON into Supabase `report_templates.report_template_setup_json`

## Motivation
The core lifecycle of KiBiAI starts with Template Setup. Without a setup JSON, the AI has no schema context and cannot generate reports. This is the entry point for all company-level BI work.

## Linked Pages
- App Doc: PAGE 3 (Templates), PAGE 5 (Template Setup Wizard)
- DB: `report_templates`, `modules` tables

## Acceptance Criteria
- [ ] "Create Template" button navigates correctly
- [ ] Template name field is auto-focused on modal open
- [ ] Module can be selected from a dropdown of company modules
- [ ] Setup page loads with pre-populated template metadata in header
- [ ] Host + Protocol section is editable
- [ ] "Add New Database" section allows: entering credentials, fetching tables, selecting layout, adding table with auto-fetched fields
- [ ] Field table is editable: label, type, prefix, suffix, valuelist per field
- [ ] Relationships panel allows add/edit/delete with dynamic field dropdowns
- [ ] "Save Setup" persists to `report_template_setup_json` via API
- [ ] JSON structure matches the exact format specified in the application document
- [ ] OData protocol option is visible but disabled (with tooltip)
- [ ] All API calls go through the Next.js API layer (not direct external URLs)
