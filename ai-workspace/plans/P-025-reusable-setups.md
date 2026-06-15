# P-025: Reusable Report Template Setups

## 1. Overview
This plan outlines the implementation of reusable database setup configurations for report templates. Currently, every template has its own `report_template_setup_json` in the `report_templates` table. We will extract this into a dedicated `report_template_setups` table and allow templates to link to these shared configurations.

## 2. Database Schema Changes

### 2.1 New Table: `report_template_setups`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `setup_id` | uuid | PK, DEFAULT gen_random_uuid() | |
| `company_id` | uuid | FK -> companies | Multi-tenant isolation |
| `module_id` | uuid | FK -> modules | Associated module |
| `setup_name` | varchar(180) | NOT NULL | User-defined name |
| `setup_json` | jsonb | NOT NULL | The actual configuration |
| `created_by_user_id` | uuid | FK -> users | |
| `created_on` | timestamptz | DEFAULT now() | |
| `updated_on` | timestamptz | DEFAULT now() | |

### 2.2 Modify `report_templates`
- Add `setup_id` column (uuid, FK -> `report_template_setups`, NULLABLE).
- Keep `report_template_setup_json` for backward compatibility or for one-off overrides.

### 2.3 RLS Policies
- `SELECT`: Users in the same company.
- `INSERT`: Users in the same company.
- `UPDATE`: Users in the same company.
- `DELETE`: Users in the same company (or restrictive).

## 3. API Implementation

### 3.1 New Endpoints
- `GET /api/company/setups?company_id=...&module_id=...`: List saved setups.
- `POST /api/company/setups`: Create a new saved setup.
- `GET /api/company/setups/[id]`: Get specific setup details.
- `PUT /api/company/setups/[id]`: Update a saved setup.

### 3.2 Updated Endpoints
- `POST /api/company/templates`: Add `setup_id` to the request body. If provided, link the new template to this setup.
- `GET /api/company/templates/[id]/setup`: If `setup_id` is present on the template, merge/override the setup data from the `report_template_setups` table.

## 4. Frontend Implementation

### 4.1 `CreateTemplateModal.tsx`
- Add a dropdown or selector to "Start from a saved setup".
- Fetch setups based on the selected module.
- If selected, pass `setup_id` to the template creation API.

### 4.2 `SetupWizard.tsx`
- Add a "Save as Reusable Setup" button in the actions area.
- Trigger a simple naming popup/dialog.
- Call `POST /api/company/setups` with the current `config` JSON.

### 4.3 UI Polish
- Ensure the setup list in the modal looks premium (vibrant colors, clean typography).
- Use glassmorphism for the naming popup.

## 5. Step-by-Step Execution Plan

### Step 1: Database Migration
- [ ] Create `025_reusable_setups.sql`.
- [ ] Ask user to execute it in Supabase.
- [ ] Update `db-architecture.md`.

### Step 2: Backend Services & API
- [ ] Create `src/services/setupService.ts`.
- [ ] Create API routes in `src/app/api/company/setups/`.
- [ ] Update template creation API to handle `setup_id`.

### Step 3: Frontend - Reusing Setups
- [ ] Modify `CreateTemplateModal` to include setup selection.
- [ ] Test template creation with an existing setup.

### Step 4: Frontend - Saving Setups
- [ ] Modify `SetupWizard` to include "Save as Reusable" functionality.
- [ ] Implement the naming popup.
- [ ] Test saving a setup from the wizard.

### Step 5: Verification & Cleanup
- [ ] Run `npm run lint` and `npm run build`.
- [ ] Verify multi-tenant isolation.
- [ ] Log changes in `ai-workspace/execution-logs/`.

## 6. Verification Plan
- **Unit Tests**: Test `setupService` for CRUD operations.
- **Integration Tests**: Verify template creation with `setup_id`.
- **UI Tests**: Manual walkthrough of saving and reusing setups.
