# P-010 — Redesign Workspace Header Component

**Ticket:** T-010-redesign-workspace-header.md  
**Scope:** frontend  
**Created:** 2026-04-27  

---

## Implementation Plan

### Step 1 — Rewrite `WorkspaceHeader.tsx`

**File:** `src/components/WorkspaceHeader.tsx`

Implement the following redesign:

#### Structure Changes:
- Wrap header with `header-glass` effect (white bg, blur backdrop)
- Add a gradient bottom border using a pseudo-element via inline style + className
- Left section: company logo → company name → plan badge (with shimmer via CSS class)
- Center section: breadcrumb nav with divider separator
- Right section: action nav pill (Templates + Home) → divider → "Powered by KiBiAI" logo → divider → user avatar + dropdown
- Mobile: hamburger button that opens a slide-in drawer

#### Color Changes (from purple to blue):
- All `indigo-600` → `blue-600` (`#2563eb`)
- All `indigo-700` → `blue-700` (`#1d4ed8`)
- Badge gradient: `from-blue-600 to-blue-700`
- Avatar ring: `from-blue-600 to-blue-800`
- "Powered by" section uses actual `kibiai.png` logo

#### Scroll Collapse:
- Keep existing `collapsed` state via scroll listener
- Logo fades out on collapse
- Header height transitions: `72px` → `48px`

### Step 2 — Update `agents.md` for components directory

Document the new header architecture.

---

## Files Modified

| File | Change Type |
|------|-------------|
| `src/components/WorkspaceHeader.tsx` | Full rewrite |
| `src/components/agents.md` | Create/update |

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Breaking breadcrumb context | Medium | Preserve `useHeader()` API exactly |
| Company logo fallback breakage | Low | Keep Image/fallback logic |
| Scroll collapse regression | Low | Keep existing scroll listener logic |
