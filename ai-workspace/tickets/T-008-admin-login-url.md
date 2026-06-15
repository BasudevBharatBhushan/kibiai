# T-008: Admin UI Enhancement - Company Login URL

## Status
COMPLETED

## Scope
`frontend`

## Objective
Add a feature in the Platform Admin dashboard to display, copy, and open the workspace login URL for each company.

## Requirements
1. **URL Generation**: Compute the workspace login URL based on the company name (slug normalization: lowercase, hyphenated).
2. **UI Integration**: Add a "Workspace Login" section in `CompanyDetails.tsx`.
3. **Copy to Clipboard**: Implement a copy-to-clipboard button with success feedback.
4. **Open in New Tab**: Implement an "Open Workspace" button.
5. **Company Logo Upload**:
   - Add a logo upload field in the Platform Admin panel.
   - Implement storage logic to save logos to Supabase `company-logos` bucket.
6. **Branding Logic Enforcement**:
   - **Login Page**: Company Logo (Top) + KiBiAI Logo (Bottom).
   - **Workspace Layout**: Company Logo (Left) + KiBiAI Logo (Right).
   - Enforce consistent source for KiBiAI logo (`@/assets/kibiai.png`).
7. **Visual Polish**: Ensure the implementation matches the premium aesthetic.

## Linked Plan
`ai-workspace/plans/P-008-admin-login-url.md`
