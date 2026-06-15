# Company Workspace Implementation Details

This document outlines the architecture and implementation logic for the multi-tenant Company Workspace in KiBiAI.

## 1. Multi-Tenant Routing Strategy
We will use Next.js dynamic routes to provide isolated workspaces for each company.

- **Pattern**: `/[company_slug]`
- **Slug Resolution**: The `company_slug` will be derived from the `company_name` (kebab-case) or a specific `company_handle` if we add one. For now, we will use a normalized version of `company_name`.

### Routes
| Path | Purpose |
|------|---------|
| `/[company_slug]/login` | Branded login page for the company. |
| `/[company_slug]/templates` | Dashboard showing report templates. |
| `/[company_slug]/reports` | History of generated reports. |
| `/[company_slug]/admin` | Company-level settings (staff, roles). |
| `/[company_slug]/template/[id]/setup` | DB connection and field mapping. |
| `/[company_slug]/template/[id]/builder` | AI Report Builder. |

## 2. Tenant Context Persistence
A `CompanyProvider` will be implemented to manage the current tenant's state.

- **Initialization**: On any `/[company_slug]` route, a middleware or layout will:
  1. Extract `company_slug`.
  2. Resolve the `company_id` and metadata (logo, name, status) from the database.
  3. Verify if the company is `Active`.
  4. Store this in a React Context.

```typescript
// CompanyContext.tsx
interface CompanyContextType {
  company: Company;
  isLoading: boolean;
  error: string | null;
}
```

## 3. Branded Authentication
Each company has its own login experience.

- **Logo**: Dynamically fetched from `companies.company_logo`.
- **Logic**: 
  - User enters email/password.
  - Backend verifies credentials against `auth_accounts`.
  - Backend checks if the user belongs to the `company_id` associated with the current `company_slug`.
  - If mismatch, login fails even if credentials are correct for another tenant.

## 4. Module & Template Organization
Templates are the heart of the workspace.

- **Modules**: Companies define modules (Sales, HR, etc.).
- **Filtering**: `SELECT * FROM report_templates WHERE company_id = ? AND module_id = ?`.
- **View**: A grid or list view grouped by module with search capabilities.

## 5. Security & Isolation (RLS)
We will leverage Supabase Row Level Security (RLS) to ensure data isolation at the database layer.

- **Policy**: `CREATE POLICY tenant_isolation ON reports FOR ALL USING (company_id = auth.uid_company_id());`
- **Implementation**: We need to ensure the `auth.jwt()` contains the `company_id`.

## 6. Implementation Steps (Phase 2)

### Step 2.1: Dynamic Layout & Provider
- Create `src/app/[company_slug]/layout.tsx`.
- Create `src/components/providers/CompanyProvider.tsx`.
- Implement API `GET /api/company/resolve/[slug]` to fetch metadata by slug.

### Step 2.2: Branded Login Page
- Implement `src/app/[company_slug]/login/page.tsx`.
- Connect to existing `auth.service.ts` but with company validation.

### Step 2.3: Template Dashboard
- Implement `src/app/[company_slug]/templates/page.tsx`.
- Create `ModuleFilter` and `TemplateCard` components.
- API `GET /api/templates?company_id=...`.

### Step 2.4: Company Admin UI
- Basic staff management and role assignment for the company admin.
- Uses `public.users` and `public.roles` tables.

## 7. Future Proofing
- **Subdomains**: The routing is designed so `/[company_slug]` can easily be mapped to `company_slug.kibiai.com` using Next.js middleware and Vercel platforms.
- **White-labeling**: CSS variables will be driven by company branding colors stored in the DB.
