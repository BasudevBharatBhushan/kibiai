# Ticket: T-046 Bypass Company Check for Platform Admin

- **Ticket ID**: T-046
- **Scope Classification**: backend
- **Objective**: Bypass strict `company_id` matching in template configuration and generation endpoints for platform admins, allowing them to view and manage templates globally.
- **Status**: TODO

## Context
When a `platform_admin` logs into a specific workspace, their session is scoped to that company's ID. However, when navigating across different company subdomains (which share the wildcard session cookie), or switching workspaces in localhost, their `session.companyId` may either be undefined or mismatched with the company context of the templates they are viewing. This causes the configurator config/generate APIs to return `Template not found` (404), even though the platform admin should have universal access.

## Constraints
- Do not affect standard `company_user` authorization; they must still be strictly isolated to their own `company_id`.
- Ensure correct database logging (e.g. `changed_by_user_id`, `generated_by_user_id`, `company_id` for versions and reports) still resolves correctly for platform admins based on the **template's** actual company ID instead of the session's company ID.

## Acceptance Criteria
1. `GET /api/templates/[template_id]/config`: Platform admins can load template configurations across all company scopes.
2. `POST /api/templates/[template_id]/config`: Platform admins can update template configurations across all company scopes.
3. `POST /api/templates/[template_id]/generate`: Platform admins can generate reports and persist them across all company scopes.
4. `POST /api/templates/[template_id]/generate/stream`: Platform admins can stream report generation and persist results across all company scopes.
5. All operations for regular `company_user` accounts must remain strictly scoped to their own company workspace.

## Dependencies
- None
