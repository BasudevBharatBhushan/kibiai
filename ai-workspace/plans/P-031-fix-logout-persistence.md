# Implementation Plan: P-031-fix-logout-persistence
## Ticket: T-031-fix-logout-persistence

### Phase 1: Logic Update
1.  **Modify `src/utils/auth.ts`**:
    *   Update `deleteSession` to use `cookieStore.set` with `maxAge: 0` and the appropriate `domain` and `path`.
    *   This ensures the cross-subdomain cookie is correctly cleared.

### Phase 2: Documentation
1.  **Create `src/utils/agents.md`**:
    *   Document the authentication strategy (JWT, Cookies, Multi-tenancy).
    *   Explain the importance of the `domain` flag in cookie operations.

### Phase 3: Verification
1.  **Manual Test**:
    *   In the next turn, I will ask the user to verify if logout now works as expected on the live site after I apply the changes (if I had access to a live environment, but I don't, so I'll trust the logic).
    *   Check for any side effects on localhost.
2.  **Build Check**:
    *   Run `npm run build` to ensure no regressions.

## Proposed Changes

### `src/utils/auth.ts`
```typescript
export async function deleteSession() {
  const cookieStore = await cookies();
  const isProd = process.env.NODE_ENV === 'production';
  const domain = process.env.NEXT_PUBLIC_BASE_DOMAIN;

  cookieStore.set(COOKIE_NAME, '', {
    path: '/',
    maxAge: 0,
    ...(isProd && domain && !domain.includes('localhost') ? { domain: `.${domain}` } : {})
  });
}
```

---
**Approval Required**: Please approve this plan to proceed with the implementation.
