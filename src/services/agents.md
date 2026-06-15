# Services Module

## Overview
This directory contains server-side service classes that encapsulate business logic and database interactions. These services are typically used by API routes.

## Services

### CompanyService (`company.service.ts`)
Handles company resolution and metadata.
- **`resolveCompanyBySlug(slug: string)`**: Resolves a workspace slug to a full company object.
    - **Resolution Order**:
        1. `allowed_subdomains` table (source of truth).
        2. Case-insensitive exact match on `company_name`.
        3. Case-insensitive prefix match on `company_name`.
    - **Data Returned**: Includes company metadata and current active license plan.

## Architecture
- All services should use `createAdminClient` for database operations to ensure they can perform cross-tenant lookups when necessary (e.g., during login/resolution).
- Services should return clean interfaces defined at the top of the file.
