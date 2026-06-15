# Implementation Plan: P-022-homepage-redirect

## 1. Objective
Replace the current homepage content with an automatic redirect to the `kibiz-systems-inc` templates workspace.

## 2. Changes

### 2.1 Update `src/app/page.tsx`
- Replace the existing `HomePage` component with a redirect.
- Use `next/navigation`'s `redirect` function for server-side redirection (if it's a server component) or `router.push`/`useEffect` (if it's a client component).
- Since the current file is `"use client"`, I will use `redirect` from `next/navigation` which works in both server and client components in Next.js 13+.

## 3. Implementation Steps
1. Open `src/app/page.tsx`.
2. Remove the legacy JSX content.
3. Call `redirect('/kibiz-systems-inc/templates')`.

## 4. Verification
1. Navigate to `http://localhost:3000/`.
2. Confirm it immediately redirects to `http://localhost:3000/kibiz-systems-inc/templates`.

## 5. Approval Gate
- [ ] Redirect works as expected.
- [ ] No more legacy links to `/reports` on the landing page.
