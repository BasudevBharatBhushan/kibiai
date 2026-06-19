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
- **Strict Isolation Rules (T-035)**:
  - If a user is logged in to a specific company, attempting to access any other company's URL or the apex domain will instantly redirect them back to their authorized workspace.
  - If a logged-in user hits `/login`, they are immediately redirected to their dashboard.
  - If a logged-out user attempts to access a protected URL, they are cleanly redirected to the exact login page for that workspace (e.g., `/[company_slug]/login`).
- **Linking**:
  - When displaying links to other workspaces (e.g., in the Admin Panel), use the `NEXT_PUBLIC_BASE_DOMAIN` environment variable to construct the full subdomain URL.
  - See `CompanyDetails.tsx` for a reference implementation of environment-aware link construction.

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
