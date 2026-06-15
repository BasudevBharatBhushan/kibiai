# T-013: Fix Vercel Build Error (Supabase & Env Vars)

## Problem
The Vercel build is failing during the prerendering of `/admin` and other pages because:
1.  Supabase client is initialized at the module level in `PaymentSection.tsx`, which throws an error if `NEXT_PUBLIC_SUPABASE_URL` is missing.
2.  `requireEnv` helper throws errors at the module level if environment variables like `FM_HOST` are missing during the build phase.
3.  Strict `!` assertions in Supabase client helpers cause crashes when variables are undefined.

## Goals
- Prevent build-time crashes due to missing environment variables.
- Ensure Supabase client is initialized safely.
- Make `requireEnv` more resilient during the build phase.

## Status
- [x] Identify root causes (PaymentSection.tsx, requireEnv, Supabase helpers)
- [x] Move Supabase client initialization inside component
- [x] Make `requireEnv` non-throwing during build
- [x] Remove strict assertions in Supabase helpers
- [x] Fix OPENAI_API_KEY build error in `src/lib/ai/client.ts`
- [ ] Verify build locally (simulated)
