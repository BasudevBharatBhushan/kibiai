---
trigger: always_on
---

# AI OPERATIONAL LAWS

### 1. Context Enforcement
Before performing any task, you MUST read:
- `README.md`
- `.agents/workflows/workflow.md`
- `agents.md` (if present in the current module/directory)
- All files in `ai-workspace/docs/`
- `ai-workspace/active-ticket`

#### 1.1 Context Continuity (agents.md)
- Every significant module must have an `agents.md` file documenting its architecture, logic, and state.
- **READ FIRST**: You MUST check for an `agents.md` in the directory of any file you are modifying before starting work.
- **UPDATE ALWAYS**: Whenever you finish a task that changes a module's logic, architecture, or data flow, you MUST update the corresponding `agents.md`.
- **CREATE IF MISSING**: If you are working on a module that lacks an `agents.md`, you must create one as part of the task.
No action is allowed without full context awareness.

---

### 2. Ticket Discipline
- No implementation is allowed without:
  - A Ticket (`ai-workspace/tickets/`)
  - An Implementation Plan (`ai-workspace/plans/`)
- **PAUSE FOR APPROVAL**: After creating a Ticket and Implementation Plan, the agent MUST ALWAYS pause and ask for the developer's approval before proceeding with any code execution.
- Ticket statuses must be strictly maintained:
  - `TODO`, `IN_PROGRESS`, `COMPLETED`, `BLOCKED`

---

### 3. Active State Control
- The file `ai-workspace/active-ticket` must always point to the currently active tickets.
- **Up to two** active tickets are allowed at a time.

---

### 4. Stepwise Execution & Verification
- Execute one subtask at a time.
- After each step:
  - Verify correctness
  - Log the change in `ai-workspace/execution-logs/`
- No batch or untracked execution is allowed.

---

### 5. Data & System Safety
- No direct CRUD operations on production databases.
- All database changes must be written as SQL scripts in:
  - `ai-workspace/sql/`
- Never expose or hardcode secrets.
- Always use environment variables (`process.env` or equivalent).
- If required environment variables are missing → STOP execution.

---

### 6. Scope Isolation
- Every task must be classified as:
  - `frontend`, `backend`, or `fullstack`
- Do not modify unrelated modules outside defined scope.

### 7. Completion Verification
- Whenever implementation is complete, you MUST do an `eslint` and `build` check (e.g. `npm run lint` and `npm run build`).
- This ensures your implementation is syntactically correct and passes eslint rules.

---

### 8. Temporary Scripts & Scratchpad
- All temporary or one-off scripts MUST be placed in a `/tmp` or `/temp` folder in the project root.
- The `/tmp` and `/temp` folders MUST be added to `.gitignore`.
- Temporary scripts MUST NEVER contain hardcoded secrets or sensitive values. Always use environment variables or retrieve them dynamically.

---

### 9. Robust API Handling
- **Backend**: Always wrap route handlers in `try/catch` blocks and ensure a valid JSON response is returned even on failure (e.g., using `NextResponse.json`).
- **Frontend**: Never assume an API call returns JSON. Always check `if (!response.ok)` and verify the `Content-Type` header before calling `response.json()` to avoid "Unexpected end of JSON input" errors. Always log or display descriptive errors including the status code.