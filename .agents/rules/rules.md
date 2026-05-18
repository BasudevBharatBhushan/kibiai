---
trigger: manual
---

# 🚨 CRITICAL AI BOOTSTRAP LAWS (MUST RUN FIRST)

## 1. MANDATORY GRAPHIFY MCP DISCOVERY

If this rule file is loaded, referenced, or attached, the AI agent **MUST IMMEDIATELY** prioritize the **Graphify MCP Server** over traditional `grep` or manual file tree tools.

### Mandatory Steps:
1. **CHECK FOR ACTIVE GRAPHIFY MCP TOOLS**:
   - Immediately inspect the active tools list for `mcp_graphify_graph_stats`, `mcp_graphify_query_graph`, `mcp_graphify_get_node`, and `mcp_graphify_shortest_path`.
2. **INITIALIZATION CALL (FIRST ACTION OF THE TURN)**:
   - Your very first tool call for any architectural, discovery, or contextual question **MUST** be calling `mcp_graphify_graph_stats` or `mcp_graphify_query_graph` to verify the state of the workspace graph.
3. **USE GRAPHIFY BEFORE ALL OTHER SEARCH TOOLS**:
   - For *any* question regarding codebase flow, file-to-file relationships, or system dependencies, you **MUST** call `mcp_graphify_query_graph` or `mcp_graphify_shortest_path` **before** running any generic search tools.
   - Only fall back to `grep_search` if Graphify is offline, or if a precise literal text pattern match inside a single file is required.
4. **KEEP GRAPH CURRENT**:
   - After completing any code modifications in this session, run the background terminal command `graphify update .` in the terminal to keep the AST knowledge graph up-to-date.

---

# 2. AI OPERATIONAL LAWS

## 2.1 Context Enforcement
Before performing any task, you MUST read:
- `README.md`
- `.agents/workflows/workflow.md`
- `agents.md` (if present in the current module/directory)
- All files in `ai-workspace/docs/`
- `ai-workspace/active-ticket`

### 2.1.1 Context Continuity (agents.md)
- Every significant module must have an `agents.md` file documenting its architecture, logic, and state.
- **READ FIRST**: You MUST check for an `agents.md` in the directory of any file you are modifying before starting work.
- **UPDATE ALWAYS**: Whenever you finish a task that changes a module's logic, architecture, or data flow, you MUST update the corresponding `agents.md`.
- **CREATE IF MISSING**: If you are working on a module that lacks an `agents.md`, you must create one as part of the task.
No action is allowed without full context awareness.

---

## 2.2 Ticket Discipline
- No implementation is allowed without:
  - A Ticket (`ai-workspace/tickets/`)
  - An Implementation Plan (`ai-workspace/plans/`)
- **PAUSE FOR APPROVAL**: After creating a Ticket and Implementation Plan, the agent MUST ALWAYS pause and ask for the developer's approval before proceeding with any code execution.
- Ticket statuses must be strictly maintained:
  - `TODO`, `IN_PROGRESS`, `COMPLETED`, `BLOCKED`

---

## 2.3 Active State Control
- The file `ai-workspace/active-ticket` must always point to the currently active tickets.
- **Up to two** active tickets are allowed at a time.

---

## 2.4 Stepwise Execution & Verification
- Execute one subtask at a time.
- After each step:
  - Verify correctness
  - Log the change in `ai-workspace/execution-logs/`
- No batch or untracked execution is allowed.

---

## 2.5 Data & System Safety
- No direct CRUD operations on production databases.
- All database changes must be written as SQL scripts in:
  - `ai-workspace/sql/`
- Never expose or hardcode secrets.
- Always use environment variables (`process.env` or equivalent).
- If required environment variables are missing → STOP execution.

---

## 2.6 Scope Isolation
- Every task must be classified as:
  - `frontend`, `backend`, or `fullstack`
- Do not modify unrelated modules outside defined scope.

---

## 2.7 Completion Verification
- Whenever implementation is complete, you MUST do an `eslint` and `build` check (e.g. `npm run lint` and `npm run build`).
- This ensures your implementation is syntactically correct and passes eslint rules.

---

## 2.8 Temporary Scripts & Scratchpad
- All temporary or one-off scripts MUST be placed in a `/tmp` or `/temp` folder in the project root.
- The `/tmp` and `/temp` folders MUST be added to `.gitignore`.
- Temporary scripts MUST NEVER contain hardcoded secrets or sensitive values. Always use environment variables or retrieve them dynamically.

---

## 2.9 Robust API Handling
- **Backend**: Always wrap route handlers in `try/catch` blocks and ensure a valid JSON response is returned even on failure (e.g., using `NextResponse.json`).
- **Frontend**: Never assume an API call returns JSON. Always check `if (!response.ok)` and verify the `Content-Type` header before calling `response.json()` to avoid "Unexpected end of JSON input" errors. Always log or display descriptive errors including the status code.


