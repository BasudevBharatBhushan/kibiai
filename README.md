# README.md

# NEXT.JS APPLICATION

---

## PROJECT OVERVIEW


This repository contains a **Next.js full-stack application** built with a structured and scalable architecture.

The application uses:

* **Next.js App Router**
* **React frontend**
* **API routes / server actions**
* **TypeScript**
* **Modular component architecture**
* **Controlled AI-assisted development workflow**


The goal of this project is to maintain:

* clean and scalable code structure
* safe and traceable development changes
* predictable implementation flow
* reusable UI architecture
* maintainable backend logic
* production-ready standards

All workflow artifacts are stored inside:

`/ai-workspace`

### 3. Active State Control
- The file `ai-workspace/active-ticket` must always point to the currently active tickets.
- **Up to two** active tickets are allowed at a time.

The AI agent must always follow:

**CRITICAL RULE: Always review `/ai-workspace/docs/frontend-structure.md` and `/ai-workspace/docs/backend-structure.md` before implementing any new features or components to ensure architectural consistency.**

1. `.agents/rules/rules.md`
2. `.agents/workflow/workflow.md`
3. `/ai-workspace/docs/coding-guidelines.md`
4. `/ai-workspace/docs/frontend-structure.md`
5. `/ai-workspace/docs/backend-structure.md`
6. `/ai-workspace/docs/db-architecture.md` (when required)
7. `/ai-workspace/docs/api-specification.md` (when required)

---

## PROJECT STRUCTURE

```bash
project-root/
├── app/
├── components/
├── lib/
├── services/
├── hooks/
├── types/
├── utils/
├── public/
├── styles/
├── .agents/
├── ai-workspace/
├── middleware.ts
├── next.config.ts
├── package.json
└── README.md
```

---

## APPLICATION AREAS

### Frontend

Located in:

```bash
/app
/components
```

Handles:

* UI pages
* layouts
* dashboards
* forms
* charts
* reports
* client interactions

### Backend

Located in:

```bash
/app/api
/lib
/services
```

Handles:

* APIs
* authentication
* server actions
* database operations
* business logic
* integrations

---

The agent must never implement directly from prompts without ticketing and planning. 

**CRITICAL**: After creating a Ticket and Implementation Plan, the agent **MUST** pause and wait for the developer's explicit approval before starting execution.

**POST-EXECUTION TESTING**: Upon completing implementation, the agent **MUST** run comprehensive tests:
1. **Service Layer**: Test business logic using **Vitest**.
2. **API Routes**: Verify endpoints using **Supertest** or **Vitest**.
3. **End-to-End**: Final UI verification using **Playwright**.

---

## DEVELOPMENT WORKFLOW

All development tasks must follow:

```text
Prompt
↓
Ticket Creation
↓
Implementation Plan
↓
WAIT FOR APPROVAL
↓
Step-by-step Execution
↓
Execution Log Update
↓
Verification
↓
Prepare Test Case File
↓
WAIT FOR TEST APPROVAL
↓
Run Tests
↓
Ticket Completion
```

---

## AI WORKSPACE STRUCTURE

```bash
/ai-workspace
├── docs
├── tickets
├── plans
├── execution-logs
├── tests
├── sql
└── active-ticket
```

---

## FILE NAMING CONVENTIONS

### Tickets

```text
T-001-add-user-role.md
T-002-fix-login-flow.md
```

### Plans

```text
P-001-add-user-role.md
```

### Logs

```text
L-001-add-user-role.md
```

### Tests

```text
TEST-001-add-user-role.md
```

### SQL

```text
001_add_user_role.sql
```

---

## MULTI-TENANT ROUTING (T-014)

KiBiAI uses a **subdomain-based routing** strategy in production to provide isolated experiences for platform admins and client companies.

### Production Routing Table

| Subdomain | Internal Route | Target Audience |
| :--- | :--- | :--- |
| `admin.kibiai.itsb3.xyz` | `/admin` | Platform Administrators |
| `<slug>.kibiai.itsb3.xyz` | `/[company_slug]` | Company Employees & Managers |
| `kibiai.itsb3.xyz` (apex) | `/` | Marketing & Landing |
| `<unknown>.kibiai.itsb3.xyz`| `/invalid-subdomain` | Error handling |

### Local Development
In `localhost`, the application uses **path-based routing** to simplify development:
- Admin: `http://localhost:3000/admin`
- Company: `http://localhost:3000/[company_slug]`

### Middleware Logic
The `middleware.ts` handles the rewrite logic by extracting the subdomain from the `Host` header. It validates dynamic company slugs against the `allowed_subdomains` registry via an internal API call (`/api/subdomains/validate`).

---

## NEXT.JS APPLICATION STRUCTURE

```bash
app/
├── layout.tsx
├── page.tsx
├── login/page.tsx
├── dashboard/page.tsx
├── reports/page.tsx
├── charts/page.tsx
├── settings/page.tsx
├── api/
│   ├── auth/
│   ├── users/
│   ├── reports/
│   └── charts/
```

---

## ARCHITECTURE RULES

### UI Layer

* Pages must remain lightweight
* Move reusable UI into `components`
* Keep client components minimal
* Prefer server components where possible

### Logic Layer

Use:

```text
Page / Route
↓
Service
↓
Repository / DB Layer
```

### Rules

#### API Routes

* Handle request / response
* Validate input
* Call services only

#### Services

* Business logic only
* Reusable across routes

#### Data Layer

* DB queries
* ORM logic
* No business rules

---

## DATABASE SAFETY RULE

The agent must not mutate production database directly.

If schema changes are needed:

1. Create SQL migration
2. Store in `/ai-workspace/sql`
3. Ask developer to execute manually
4. Update DB docs 

---

## TESTING PROCEDURES

### Frontend

```bash
npm run test
npm run test:e2e
```

### Backend

```bash
npm run test:api
```

### Preferred Tools

* Vitest
* Playwright
* Supertest

---

## DEVELOPMENT SETUP

Install dependencies:

```bash
npm install
```

Run dev server:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Start production:

```bash
npm start
```

---

## ENVIRONMENT RULES

* Never hardcode secrets
* Use `.env.local`
* Use environment variables only
* Missing variables must block execution 

---

## EXECUTION SAFETY PRINCIPLES

* Prefer small safe changes
* Avoid unrelated refactors
* Preserve backward compatibility
* Verify before modifying
* Ask for clarification when unclear
* Never guess requirements 

---

## GITIGNORE ARTIFACTS

```text
.next
node_modules
coverage
playwright-report
test-results
dist
logs
```

---

## PURPOSE OF THIS REPOSITORY

This project is intended to support scalable product development using a disciplined engineering workflow with Next.js as the application foundation.
