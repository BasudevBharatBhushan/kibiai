# Implementation Plan: Chatbot to Reports Integration (T-001)

## Overview
This plan details how we will incorporate the `ModularChatbot` into the `src/app/reports/page.tsx` to drive the report generation process, replacing the manual input of the JSON configuration with AI-generated configurations.

## Step-by-Step Implementation

### Phase 1: Enhance `ModularChatbot.tsx`
We need `ModularChatbot` to communicate state changes back to its parent.
1. Add `onAssistantResponse?: (parsedResponse: string, rawResponse: any) => void;` to `ModularChatbotProps`.
2. Add `onConversationIdChange?: (id: string | null) => void;` to `ModularChatbotProps`.
3. Within `handleSend`, after parsing the assistant response, call `onAssistantResponse(assistantText, res)`.
4. Within `handleSend` and `handleNewChat`, call `onConversationIdChange` whenever the `conversationId` updates or is cleared.

### Phase 2: Embed Chatbot in `src/app/reports/page.tsx`
1. **Layout Update:**
   Reorganize the layout of `page.tsx` to be a 2-column or split layout:
   - Left side/Sidebar: `ModularChatbot` component.
   - Right side: The existing manual JSON textarea overrides and the `DynamicReport` preview.
2. **Setup Variables:**
   - Link `reportSetup` state to act as the `SetupJson`.
   - Link `reportConfig` state to the Chatbot's generated config.
3. **Chatbot Callbacks:**
   - Implement `onAssistantResponse`. When triggered, string match or extract the JSON block (or attempt to `JSON.parse` the response). If it finds `"db_defination"`, set the JSON to `reportConfig` and optionally trigger `startFetchProcess()`.
4. **Predefined Prompts Management:**
   - When a chat starts (no conversation ID), compute the Type 1 Predefined Prompt dynamically: `"Here is my DB Schema - {reportSetup} Suggest me prompt related to it."`.
   - If the user edits the `reportConfig` text area actively, set a flag so the next message includes the Type 4 Predefined Prompt: `"Here is my updated config - {reportConfig}"`.

### Phase 3: Database Sync for Conversation ID
1. Fetch the `recordId` from url search params if available (e.g. `?recordId=xxx`).
2. When `onConversationIdChange((id) => ...)` is triggered, invoke an API route (e.g., `/api/filemaker-report/thread` or update the existing filemaker routes) to write the `OpenAI_AssistantThreadID` into the `MultiTableReport` database entry.
3. Note: The `recordId` handling will ensure that we associate the generated AI thread back directly to the FileMaker record in context.

### Phase 4: Validations & Polish
1. Ensure system instructions strictly match `reports-system-instruction.txt`. Import the string from a constants file (e.g. `src/constants/reportsSystemInstruction.ts`).
2. Provide fallback parsing heuristics if the AI outputs text wrapping the JSON (e.g., \`\`\`json ... \`\`\`).
3. Ensure the UI feels responsive: the AI fetches should seamlessly overlap with the `ReportDataFetcher` execution without freezing the user experience.

## Tracking
- **Ticket**: `T-001-chatbot-report-integration`
- **Assigned**: AI Agent + User
