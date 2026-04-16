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

## State Management
- **Local State**: `useState`, `useReducer`.
- **Global State**: React Context API.
- **Data Fetching**: Next.js Fetch API with server components or client-side SWR/Query (if implemented).

## Navigation
- Use Next.js `Link` for internal routing.
- Prefer programmatic navigation via `useRouter` when necessary.
