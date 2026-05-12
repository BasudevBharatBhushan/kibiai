# Ticket: T-036-fix-setup-wizard-build-error

## Status
`COMPLETED`

## Description
The Next.js build is failing due to multiple TypeErrors:
1. In `src/components/setup/SetupWizard.tsx`, `setSaveError` is called but not defined.
2. In `src/utils/auth.ts`, `headers()` is called without await, which is required in Next.js 15.

## Error Details
```
./src/components/setup/SetupWizard.tsx:309:5
Type error: Cannot find name 'setSaveError'.
```
```
./src/utils/auth.ts:37:59
Type error: Property 'get' does not exist on type 'Promise<ReadonlyHeaders>'.
```

## Scope
- `fullstack`

## Tasks
- [x] Define `saveError` state in `SetupWizard.tsx`.
- [x] Update `handleSave` to correctly set the error message on failure.
- [ ] Fix `headers()` await in `src/utils/auth.ts`.
- [ ] Verify build with `npm run build`.
