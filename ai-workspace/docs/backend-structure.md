# BACKEND STRUCTURE

## Overview
- **Execution Environment**: Next.js Server Components and Route Handlers (API).
- **Library**: `mongodb` (Native Node.js driver).

## API Routes (`src/app/api/`)
- Endpoint naming: Standard RESTful conventions (e.g., `api/users/[id]`).
- Request Validation: Always use **Zod** to validate incoming payloads (`req.json()`).
- Error Handling: Use standard HTTP status codes.
- Response Format: `{ success: boolean, data?: any, error?: string }`.

## Database Interaction
- DB initialization is centralized in `src/lib/mongodb.ts`.
- Use a singleton pattern for the MongoDB client to prevent multiple connections in serverless environments.
- Prefer standard CRUD methods over complex aggregations unless necessary for performance.

## AI Service Integration
- OpenAI client is used for core AI features.
- Keep prompt templates separate and versioned (or in specific service files).
- Implement appropriate rate-limiting and error handling for external API calls.
