---
trigger: manual
---

# 🚨 CRITICAL AI BOOTSTRAP LAWS (MUST RUN FIRST)

## 1. MANDATORY GRAPHIFY MCP DISCOVERY & TOKEN-EFFICIENT ANALYSIS

If this rule file is loaded, referenced, or attached, the AI agent **MUST IMMEDIATELY** prioritize the **Graphify MCP Server** over recursive file reading, grep-heavy exploration, or manual tree traversal.

The primary purpose of Graphify is:
- Reduce token consumption
- Avoid unnecessary file reads
- Build architectural awareness before implementation
- Navigate dependencies intelligently

### Mandatory Steps

1. **CHECK FOR ACTIVE GRAPHIFY MCP TOOLS**
   - Immediately inspect the active tools list for:
     - `mcp_graphify_graph_stats`
     - `mcp_graphify_query_graph`
     - `mcp_graphify_get_node`
     - `mcp_graphify_shortest_path`

2. **FIRST ACTION RULE**
   - The FIRST architectural or contextual action of every task MUST be:
     - `mcp_graphify_graph_stats`
       OR
     - `mcp_graphify_query_graph`

3. **GRAPH-FIRST DISCOVERY**
   - Before opening files, the agent MUST:
     - Discover module relationships
     - Trace imports and dependencies
     - Identify related services/components/routes
     - Determine execution flow
   - Use:
     - `mcp_graphify_query_graph`
     - `mcp_graphify_shortest_path`
     - `mcp_graphify_get_node`

4. **MINIMIZE TOKEN USAGE**
   - Never read entire files unless absolutely required.
   - Prefer:
     - AST summaries
     - Symbol-level extraction
     - Dependency tracing
     - Focused node inspection
   - Avoid repetitive reads of previously analyzed files.

5. **FALLBACK POLICY**
   - Use `grep`, recursive scans, or broad file reads ONLY if:
     - Graphify is unavailable
     - Exact literal matching is required
     - AST graph lacks required context

6. **POST-IMPLEMENTATION GRAPH UPDATE**
   - After code modifications:
     ```bash
     graphify update .
     ```
   - This MUST be executed to keep the knowledge graph synchronized.

---

# 2. AI OPERATIONAL LAWS

## 2.1 Mandatory Context Initialization

Before ANY implementation or modification, the AI agent MUST read:

- `README.md`
- `.agents/workflows/workflow.md`
- `agents.md` (nearest module first)
- All files inside:
  - `ai-workspace/docs/`
- `ai-workspace/active-ticket`

No implementation may begin without full contextual awareness.

---

## 2.1.1 agents.md Context Continuity

Every major module MUST contain an `agents.md` file documenting:

- Architecture
- Execution flow
- Important dependencies
- Current limitations
- State assumptions
- Known technical debt

### Rules

1. CHECK FIRST
   - Before editing a module, the agent MUST search for the nearest `agents.md`.

2. UPDATE ALWAYS
   - If architecture, logic, or flow changes:
     - Update the corresponding `agents.md`.

3. CREATE IF MISSING
   - If absent, create one before implementation completion.

4. KEEP CONCISE
   - `agents.md` should prioritize:
     - High-signal architectural context
     - Dependency flow
     - Important caveats
   - Avoid verbose explanations.

---

# 3. STRICT TICKETING SYSTEM (MANDATORY)

## 3.1 No Work Without Ticketing

The AI agent MUST NOT perform implementation work unless ALL of the following exist:

- Ticket:
  - `ai-workspace/tickets/`
- Implementation Plan:
  - `ai-workspace/plans/`
- Active ticket registration:
  - `ai-workspace/active-ticket`

If missing:
1. Create ticket
2. Create implementation plan
3. Register active ticket
4. STOP and request approval

No coding may begin before approval.

---

## 3.2 Ticket Lifecycle

Every ticket MUST contain:

- Ticket ID
- Scope classification
- Objective
- Constraints
- Acceptance criteria
- Dependencies
- Status

### Allowed Status Values

- `TODO`
- `IN_PROGRESS`
- `BLOCKED`
- `COMPLETED`

Status transitions MUST be updated continuously.

---

## 3.3 Scope Classification

Every task MUST explicitly define:

- `frontend`
- `backend`
- `fullstack`

The AI agent MUST NOT modify unrelated modules outside the declared scope.

---

## 3.4 Planning Requirements

Implementation plans MUST include:

- Architectural impact
- Affected modules
- Graphify-discovered dependencies
- Step-by-step execution
- Validation strategy
- Rollback considerations

Plans should optimize for:
- Minimal file touches
- Minimal token usage
- Minimal architectural disruption

---

## 3.5 Active Ticket Discipline

- `ai-workspace/active-ticket` MUST always reflect current active work.
- Maximum:
  - 2 active tickets simultaneously

If limit exceeded:
- STOP execution

---

# 4. EXECUTION & VERIFICATION RULES

## 4.1 Stepwise Execution

Implementation MUST occur incrementally.

After EACH subtask:
- Verify correctness
- Log progress
- Update ticket status if needed

No large unverified execution batches allowed.

---

## 4.2 Execution Logging

All implementation activity MUST be logged inside:

```txt
ai-workspace/execution-logs/