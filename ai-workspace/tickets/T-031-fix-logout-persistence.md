# Ticket: T-031-fix-logout-persistence
## Status: COMPLETED
## Description
Users are remaining authenticated even after clicking logout. This is because the `kibiai_session` cookie is set on the apex domain (`.kibiai.itsb3.xyz`) in production, but the `deleteSession` function does not specify the domain when attempting to clear it. Consequently, the browser retains the domain-level cookie.

## Requirements
- Update `deleteSession` to explicitly clear the cookie for the apex domain if configured.
- Ensure the logout behavior is consistent across localhost and production.
- Document the auth utility logic in an `agents.md` file.

## Scope: backend
