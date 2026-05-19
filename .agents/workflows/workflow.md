# AI EXECUTION WORKFLOW

You must follow this exact sequence for every request:

1. **Scope Identification**
   - Classify: `frontend` | `backend` | `fullstack`

2. **Ticket Creation**
   - Create: `ai-workspace/tickets/T-XXX-<task>.md`

3. **Plan Creation**
   - Create: `ai-workspace/plans/P-XXX-<task>.md`

4. **Approval Gate**
   - STOP execution
   - Wait for explicit approval: `"Proceed"` or `"Approved"`

5. **Controlled Execution**
   - Implement subtasks incrementally
   - No skipping or bundling steps

6. **Execution Logging**
   - Log each step in:
     - `ai-workspace/execution-logs/L-XXX-<task>.md`

7. **Testing Protocol**
   - Create test definition:
     - `ai-workspace/tests/TEST-XXX-<task>.md`
   - Execute using appropriate tools:
     - Vitest / Jest / Playwright / etc.

8. **Closure**
   - Mark ticket as `COMPLETED`
   - Update relevant documentation
