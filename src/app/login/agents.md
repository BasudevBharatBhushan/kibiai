# MODULE: GLOBAL LOGIN / WORKSPACE RESOLUTION

## Overview
This module handles the global entryway of the platform (`/login`). Since the platform is multi-tenant and uses subdomains in production, this page helps users locate their specific company workspace.

## Core Logic & Redirection
1. **Active Session Check**:
   - On mount, the component queries the session endpoint (`/api/auth/me`).
   - If a valid session is active:
     - Platform Admins: Redirected to `/admin` (or the `admin` subdomain).
     - Workspace Users: Redirected to their company workspace (`/${user.companySlug}` on localhost, or `https://${user.companySlug}.${baseDomain}` in production).
   - During the session check, a spinner is displayed to prevent flashing the login form.
2. **Workspace Location**:
   - If no session is active, the user is presented with a form to enter their company's workspace slug.
   - Upon submitting the slug, they are redirected to the company-branded login page:
     - Localhost: `/${slug}/login`
     - Production: `https://${slug}.${baseDomain}/login`
