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
