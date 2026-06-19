# P-013: Fix Vercel Build Error

## Overview
This plan addresses the build failures in Vercel by making environment variable access and client initialization more robust.

## Proposed Changes

### 1. `src/lib/utils/utility.ts`
- Modify `requireEnv` to log a warning and return an empty string instead of throwing an error when an environment variable is missing. This prevents module-level imports from crashing the build.

### 2. `src/utils/supabase/client.ts`
- Update `createClient` to check for `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Provide empty string fallbacks to `createBrowserClient` to prevent it from throwing.

### 3. `src/utils/supabase/server.ts`
- Update `createClient` and `createAdminClient` to use fallback empty strings instead of strict `!` assertions.

### 4. `src/components/PaymentSection.tsx`
- Move the `supabase` client initialization from the module level into the `PaymentSection` component.

### 5. `src/lib/utils/filemaker.ts`
- Replace the top-level `FM_BASE_URL` constant with a `getFmBaseUrl()` function to ensure it's evaluated only when needed.

## Verification Plan
1. Run `npm run lint` to check for syntax errors.
2. Simulate a build environment by unsetting key variables and running a build-like command (if possible).
3. The user will need to trigger a new Vercel deployment to verify the fix in the actual environment.
