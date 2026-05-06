# FRONTEND STRUCTURE

## Directory Layout (`src/`)
- `app/`: Next.js App Router (pages, layouts, api routes).
- `components/`: 
  - `ui/`: Shared, atomic components (Radix, Shadcn style).
  - `features/`: Complex, feature-specific components.
  - `layouts/`: Global and shared layout structures.
- `assets/`: Static assets (images, fonts, raw styles).
- `constants/`: Hardcoded configs, enums, global static data.
- `context/`: React context providers (Auth, Theme, etc.).
- `lib/`: Configuration for external libraries (MongoDB client, OpenAI, etc.).
- `styles/`: Global CSS and Tailwind configs.
- `hooks/`: Custom React hooks.

## Component Guidelines
- **Skeleton Loaders**: Every component MUST implement a skeleton-based loader state (`isLoading`) to ensure a smooth, premium user experience. Avoid using "Loading..." text or empty states.

## State Management
- **Local State**: `useState`, `useReducer`.
- **Global State**: React Context API.
- **Data Fetching**: ALL frontend components MUST use the `apiClient` from `@/utils/apiClient` instead of raw `fetch`. The client automatically handles companyId scoping and error standardization.

## Navigation
- Use Next.js `Link` for internal routing.
- Prefer programmatic navigation via `useRouter` when necessary.

### Subdomain-Based Routing (Production)
In production, the application utilizes subdomains to isolate the **Admin Panel** and **Company Workspaces**.

- **Reserved Subdomains**:
  - `admin`: Redirects internally to `/admin`.
- **Company Subdomains**:
  - `<company-slug>`: Redirects internally to `/[company_slug]`.
- **Implementation**:
  - Managed by `middleware.ts` using `NextResponse.rewrite()`.
  - **Localhost Rule**: Subdomain logic is bypassed on `localhost`; use path-based routing (`/admin` or `/[slug]`).
- **Linking**:
  - When displaying links to other workspaces (e.g., in the Admin Panel), use the `NEXT_PUBLIC_BASE_DOMAIN` environment variable to construct the full subdomain URL.
  - See `CompanyDetails.tsx` for a reference implementation of environment-aware link construction.

### Authentication & Redirection Rules
The application enforces strict role-based and state-based redirection via `middleware.ts` and root-level routes.

- **Role-Based Entry Points**:
  - **Platform Admins**: Automatically redirected to the `admin` subdomain/route when hitting the **Apex domain** (`/`) or the main entry point on localhost.
  - **Company Users**: Redirected to their specific company templates page (`/[company_slug]/templates`) after login.
- **Cross-Subdomain Flexibility**:
  - **IMPORTANT**: Platform admins are allowed to access and operate within any company subdomain workspace (e.g., `us-spice-mills.kibiai.itsb3.xyz`). 
  - **NEVER** force a platform admin from a valid company subdomain back to the `admin` subdomain automatically, as they may be using the company workspace as a superadmin.
- **Auth Guards**:
  - Unauthenticated requests to protected routes are redirected to the `/login` page of the **current subdomain**.
- **Session Lifespan**:
  - Sessions (JWT and Cookie) are long-lived (**30 days**).
- **Auto Sign-out**:
  - The `apiClient` monitors for `401 Unauthorized` responses and triggers an automatic redirect to `/login`.
  - An idle listener in `AccessControlContext` validates the session after 30 minutes of inactivity.

## Branding & Logo Usage
- **KiBiAI Logo**: Always use the official KiBiAI logo for consistent branding. Source: `@/assets/kibiai.png`.
- **Company Branding**:
  - **Login Pages**: Company Logo (Top/Primary) + KiBiAI Logo (Bottom/Small "Powered by").
  - **Internal Dashboard**: Company Logo (Top-Left) + KiBiAI Logo (Top-Right or Header-End).
- **Logo Storage**: Company-specific logos must be uploaded and stored in the dedicated Supabase storage bucket (`company-logos`) and referenced via their public URL in the `companies.company_logo` column.

## Header & Navigation Standards
- **Selection Underlines**: Menu items in the header MUST use a full-width underline effect on hover and when active. This is implemented via `::after` with a `width: 100%` transition.
- **Global Actions**: Critical dashboard-level actions (e.g., "Admin Dashboard") MUST be placed in the global Header next to primary navigation (Home, Templates) for consistent accessibility.
- **Legacy Blue Theme**: The primary application theme uses "Legacy Blue" (`#2563eb`, Tailwind `blue-600`). All primary buttons, selection highlights, and brand marks MUST use this color.
- **Powered by Branding**: The "Powered by KiBiAI" section MUST use the legacy blue theme.
  - **Logo**: 32x32px container (w-8 h-8), no background container, direct logo image usage.
  - **Typography**: "Powered by" (Small, uppercase, tracking-widest), "KiBiAI" (Bold, legacy blue).
- **Alignment**: Every page body MUST use the `PageContainer` component to ensure X-axis alignment with the header content (max-width 1600px).
- **Scrollbars**: All major scrollable containers (panels, dashboards, configurators) MUST use the `.scrollbar-minimal` utility class (defined in `globals.css`) to ensure a light, narrow, and nearly invisible aesthetic consistent across the application.
