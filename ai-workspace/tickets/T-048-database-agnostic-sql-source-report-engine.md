# Ticket: T-048 - Database-Agnostic SQL Source Report Engine

- **Ticket ID**: T-048
- **Scope Classification**: fullstack
- **Status**: TODO
- **Objective**: Design and implement a database-agnostic SQL source architecture for KiBiAI reports so report templates can query PostgreSQL, MySQL/MariaDB, SQL Server, and future SQL-compatible databases directly, without limiting the source architecture to PostgreSQL mirrors.

## Constraints

- Preserve KiBiAI Supabase/PostgreSQL as the application control database for tenants, users, templates, reports, charts, permissions, and audit metadata.
- Treat customer/source databases as read-only data sources.
- Do not store plaintext source database passwords inside `report_template_setup_json` or `report_template_setups.setup_json`.
- Preserve tenant isolation through `company_id` checks in all KiBiAI metadata APIs.
- Preserve backward compatibility for existing FileMaker setup JSON and generated reports until a separate deprecation plan is approved.
- Do not allow user-authored raw SQL execution in V1.

## Acceptance Criteria

1. A versioned setup model supports SQL source connections by provider, connection reference, schema/table/column metadata, relationships, labels, and display formatting.
2. A server-only source adapter layer can test connections, introspect schema metadata, and execute safe parameterized queries for supported SQL providers.
3. The report engine can translate existing `ReportConfigJSON` concepts into a validated provider-neutral query specification, then compile it to provider-specific SQL.
4. Pagination, totals, grouping, sorting, filters, date ranges, and supported calculated fields execute at the source database layer where possible.
5. Saved reports remain immutable by default through paginated snapshot persistence in KiBiAI storage, instead of storing huge row arrays in `reports.report_data_json`.
6. Existing FileMaker report generation remains available during migration.
7. Unit, integration, API, and E2E validation cover at least one small dataset and one large dataset path.

## Dependencies

- Supabase schema migrations for source connection metadata, schema cache, query runs, and paginated report result rows.
- Driver dependencies for approved V1 SQL providers.
- A decision on which secret storage option to use in production: Supabase Vault, external KMS, or app-managed envelope encryption.
- Network access from the deployed KiBiAI runtime to customer source databases, or an approved connector/agent alternative.
