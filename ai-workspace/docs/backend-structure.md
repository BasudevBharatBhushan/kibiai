# BACKEND STRUCTURE

## Overview
- **Execution Environment**: Next.js Server Components and Route Handlers (API).
- **Database**: **Supabase (PostgreSQL)**.
- **ORM/Client**: Supabase Server SDK (`@supabase/ssr`).

## API Routes (`src/app/api/`)
- **Endpoint Naming**: Standard RESTful conventions (e.g., `api/company/staff`).
- **Authorization**: All routes must verify sessions via `getSession()` from `@/utils/auth`.
- **Scoping**: Every business entity (Staff, Modules, Templates) MUST be scoped by `company_id`.
- **Request Validation**: Use **Zod** or explicit checks for required fields.
- **Response Format**: `{ success: boolean, data?: any, error?: string }`.
- **Error Handling**: Use standard HTTP status codes (401 for Unauthorized, 400 for Bad Request, 500 for Server Error).

## Common API Client (`src/utils/apiClient.ts`)
- **Requirement**: ALL frontend components MUST use the `apiClient` instead of raw `fetch`.
- **Automatic Scoping**: The client automatically injects `companyId` into query parameters (GET) and request bodies (POST/PUT) when provided in the options.
- **Error Handling**: Centralized error management; throws descriptive errors with status codes.

## Database Interaction
- **Admin Client**: Use `createAdminClient()` for bypass-RLS operations in internal APIs.
- **Safety**: Never expose service role keys to the client.
- **Relational Integrity**: Use foreign keys to maintain relationships between `companies`, `users`, `modules`, and `report_templates`.

## AI Service Integration
- OpenAI/Deepseek integration for report generation and chart analysis.
- Keep prompts versioned and isolated in service layers.
