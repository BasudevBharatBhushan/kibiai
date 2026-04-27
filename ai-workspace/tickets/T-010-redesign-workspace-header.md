# T-010 — Redesign Workspace Header Component

**Status:** COMPLETED  
**Scope:** frontend  
**Created:** 2026-04-27  

---

## Objective

Redesign the `WorkspaceHeader.tsx` component to match the layout and visual structure from the HTML design reference (`html_designs/header_component_html.html`), while applying the application's **KiBiAI Blue** theme instead of the purple scheme used in the design.

## Requirements

1. **Layout Structure** (from design reference):
   - LEFT: Company logo (real logo image, not icon) + Company name + Plan badge below it with shimmer animation
   - CENTER: Breadcrumb navigation (left-aligned after logo)
   - Spacer (flex-1)
   - RIGHT: Action nav buttons (Templates, Home) + divider + "Powered by KiBiAI" logo block + divider + User avatar dropdown

2. **Styling Changes**:
   - Use glassmorphism-style sticky header with blur backdrop
   - Apply a gradient border at the bottom of the header
   - Replace indigo/purple theme with the application blue theme (`#2563eb`, `#1d4ed8`)
   - Use proper KiBiAI logo image for "Powered by" section (not SVG icon)
   - Plan badge should have shimmer animation
   - Avatar ring with blue gradient
   - Dropdown menus with smooth animation (opacity + translateY + scale)
   - Sign out button turns red on hover

3. **Keep Existing Functionality**:
   - Scroll-collapse behavior (header shrinks on scroll down)
   - Company logo display with fallback
   - Breadcrumb rendering from `useHeader()` context
   - Sign out navigation
   - `useCompany()` and `useHeader()` hooks

4. **Mobile**:
   - Mobile hamburger menu button
   - Mobile drawer with overlay

## Acceptance Criteria

- [ ] Header renders with glass effect and gradient bottom border
- [ ] Company logo displayed correctly (falls back to building icon if none)
- [ ] Plan badge shows with shimmer animation
- [ ] Breadcrumbs render left-aligned after logo section
- [ ] Action buttons (Templates, Home) styled in blue pill
- [ ] "Powered by KiBiAI" uses the logo image (kibiai.png)
- [ ] User dropdown works with avatar + name
- [ ] Sign out triggers logout flow
- [ ] Scroll collapse still works
- [ ] Mobile menu drawer works
