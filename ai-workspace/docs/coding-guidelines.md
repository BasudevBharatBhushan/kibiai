# CODING GUIDELINES

## Tech Stack
- **Framework**: Next.js 16 (Turbopack, App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4, PostCSS, Radix UI, Skeleton UI
- **Icons**: Lucide React, React Icons
- **Forms/Validation**: Zod
- **API/Utils**: OpenAI, DOMPurify, Lodash, UUID

## General Principles
- **Strict Types**: Always use explicit types or interfaces. Avoid `any`.
- **Component Design**: Favor Functional Components and standard React hooks.
- **Naming Conventions**: 
  - Components: `PascalCase` (e.g., `ButtonContent.tsx`)
  - Hooks: `camelCase` starting with `use` (e.g., `useAuth.ts`)
  - Libs/Utils: `camelCase` (e.g., `dateUtils.ts`)
- **Immutability**: Use spread operators or Lodash for immutable state updates.

## React Patterns
- **Server vs Client**: Use `'use client'` directive only when necessary (interactivity, browser APIs, state).
- **Hooks**: Keep logic in custom hooks to separate UI and business logic.
- **Shadow DOM**: Be cautious when using third-party components that use Shadow DOM (e.g., React Flow, React Grid Layout).

## Styling Guidelines
- Use Tailwind CSS 4 utility classes first.
- For complex interactions, use Radix UI primitives.
- Ensure accessibility (ARIA labels, keyboard navigation).
- Use `cn` (clsx + tailwind-merge) for dynamic class merging.

## Git & Workflow
- Branching: `feature/T-XXX-name`, `fix/T-XXX-name`.
- Follow AI Governance: Ticket → Plan → Approved → Execution → Log → Test.

## Robust API Handling
- **Backend (Route Handlers)**:
  - Always wrap logic in `try/catch` blocks.
  - Return a valid JSON response even on failure using `NextResponse.json`.
  - Include descriptive error messages and appropriate HTTP status codes.
- **Frontend (Data Fetching)**:
  - Never assume an API call returns JSON.
  - Always check `if (!response.ok)` before parsing.
  - Verify the `Content-Type: application/json` header before calling `response.json()`.
  - Handle `SyntaxError` (Unexpected end of JSON input) gracefully by checking response status and body.
  - Log errors with context (URL, Status Code, Status Text) to simplify debugging.

## State Management & Optimization
- **Prevent Infinite Loops**: When providing functions (e.g., `setHeader`, `resetHeader`) via Context, always wrap them in `useCallback` to ensure stable references. This prevents `useEffect` dependency loops in consuming components.
- **Dependency Arrays**: Be meticulous with `useEffect` dependency arrays. Ensure all utilized functions and variables are included, but verify they have stable references (via `useMemo` or `useCallback`) if they are part of a parent component or context.
