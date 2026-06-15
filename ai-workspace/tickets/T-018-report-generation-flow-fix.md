# T-018 — Fix Report Generation, Auto-Save & Inline Chart Modal

**Status:** TODO  
**Scope:** fullstack  
**Created:** 2026-04-29  

---

## Problem Statement

The current report generation flow has three critical gaps:

1. **`report_template_data_json` is mutated on every user generate** — This field is meant to be the admin-configured preview snapshot, not a live data cache. User-triggered generation should never touch `report_templates`.

2. **Reports are only saved when the user clicks "Save to History"** — Every generation should auto-create a `reports` record (the user never needs to think about saving).

3. **Chart `DashboardGrid` is initialized with an empty dataset** — Charts render empty because `DashboardProvider` starts with `initialDataset=[]` and never receives the fresh rows from the newly generated report.

4. **Charts rendered inline below the report** — Should open in a clean modal with `DashboardGrid` and live data, triggered by a "View Charts" button after generation.

---

## Acceptance Criteria

- [ ] `POST /api/templates/[template_id]/generate` NEVER updates `report_template_data_json` or touches the `report_templates` table
- [ ] Every generation auto-inserts a row in `reports`; `report_name` = `TitleHeader.MainHeading` from `report_structure_json`
- [ ] No "Save to History" button visible in the generate page UI
- [ ] After generation: a "View Charts" button appears in the save bar
- [ ] Clicking "View Charts" opens a full-screen modal containing `DashboardGrid`
- [ ] `DashboardProvider` inside the modal is initialized with the fresh `report_data_json` rows as `initialDataset`
- [ ] Chart schemas (`chart_templates`) for the template are loaded and passed as `initialSchemas` to the modal's `DashboardProvider`
- [ ] The modal is dismissible
