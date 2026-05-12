# Ticket: T-036-fix-setup-wizard-build-error

## Status
`TODO`

## Description
The Next.js build is failing due to a `TypeError` in `src/components/setup/SetupWizard.tsx`. Specifically, `setSaveError` is called but not defined. This was likely a partial implementation of error handling in the `handleSave` function.

## Error Details
```
./src/components/setup/SetupWizard.tsx:309:5
Type error: Cannot find name 'setSaveError'.

  307 |   const handleSave = async () => {
  308 |     setSaveStatus("saving");
> 309 |     setSaveError(null);
      |     ^
```

## Scope
- `frontend`

## Tasks
- [ ] Define `saveError` state in `SetupWizard.tsx`.
- [ ] Update `handleSave` to correctly set the error message on failure.
- [ ] (Optional) Display the error message in the UI if it exists.
- [ ] Verify build with `npm run build`.
