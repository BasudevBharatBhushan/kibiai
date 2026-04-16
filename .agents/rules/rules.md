---
trigger: always_on
---

# AI OPERATIONAL LAWS

### 1. Context Enforcement
Before performing any task, you MUST read:
- `README.md`
- `.agents/workflows/workflow.md`
- All files in `ai-workspace/docs/`
- `ai-workspace/active-ticket`

No action is allowed without full context awareness.

---

### 2. Ticket Discipline
- No implementation is allowed without:
  - A Ticket (`ai-workspace/tickets/`)
  - An Implementation Plan (`ai-workspace/plans/`)
- Ticket statuses must be strictly maintained:
  - `TODO`, `IN_PROGRESS`, `COMPLETED`, `BLOCKED`

---

### 3. Active State Control
- The file `ai-workspace/active-ticket` must always point to the currently active ticket.
- Only one active ticket is allowed at a time.

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
