## Directory Structure
- `src/components/layout/`: Global layout components.
  - `Header.tsx`: The primary navigation header.
  - `AppShell.tsx`: The main application wrapper (Shell).
  - `PageContainer.tsx`: Handles max-width and X-axis alignment.
- `src/components/ui/`: Atomic UI components.
- `src/components/providers/`: Context providers.

---

## Key Components

### `layout/Header.tsx`
**Purpose:** Reorganized and redesigned global header.
- **Conditional Visibility**: Hidden on login pages.
- **Skeleton Support**: Implements pulse animations during data fetching.
- **Dynamic Content**: Shows company name, plan_name, and breadcrumbs.
- **User Profile**: Displays user first name (derived from email) and role.

### `layout/AppShell.tsx`
**Purpose:** The single common wrapper for the application.
- Embeds the `Header`.
- Wraps content in `PageContainer`.
- Ensures consistent layout across all feature modules.

### `layout/PageContainer.tsx`
**Purpose:** Ensures the main body content follows the exact X-axis margins of the Header (`max-w-[1600px]`, responsive padding).

**Architecture:**
- `useCompany()` → fetches company data (name, logo, plan_name) via `CompanyProvider`
- `useHeader()` → reads breadcrumb items set by individual pages via `HeaderContext`
- Scroll-collapse: listens to `window.scroll` and collapses header height from `64px` → `46px` when scrolling down past 60px
- User dropdown: click-toggle with outside-click dismissal
- Mobile drawer: slide-in right panel with overlay

**Styling approach:** Inline `<style>` block with scoped `.wh-*` CSS classes for:
- `wh-glass` — glassmorphism backdrop blur
- `wh-border-gradient::after` — animated gradient bottom border
- `plan-shimmer` — shimmer sweep animation on plan badge
- `wh-avatar-ring` — gradient ring around avatar
- `wh-dropdown` — smooth opacity + scale transition on dropdown
- `wh-mobile-drawer` — translateX slide animation

**Plan badge:**
- Reads from `company.plan_name` (mapped from `plan_name` DB column via `company.service.ts`)
- Falls back to `company.plan` if `plan_name` is null
- Colors assigned by plan keyword: Teams→blue, Pro→purple, Starter→sky, Enterprise→dark

**"Powered by":**
- Uses `kibiai.png` static image asset from `@/assets/kibiai.png`

---

### `CompanyProvider.tsx`
**Purpose:** React context that fetches and exposes `company` data (id, name, logo, status, plan, plan_name) for any component within a workspace route.

Fetches from: `GET /api/company/resolve/[slug]`

---

### `ToastContext.tsx`
Global toast notification context.

---

### `CompanyDetails.tsx`
Admin UI for editing company profile, logo, and workspace login URL.

---

### `CompanyList.tsx`
Admin table listing all companies with status and plan information.

---

### `LicenseInfo.tsx`
Displays subscription/license details for a company workspace.

---

### `providers/`
Context providers wrapping the application layout.

---

## Data Flow

```
CompanyProvider (fetch /api/company/resolve/[slug])
  → useCompany() → WorkspaceHeader (name, logo, plan_name)

HeaderContext (setBreadcrumbs called by page)
  → useHeader() → WorkspaceHeader (breadcrumbs array)
```
