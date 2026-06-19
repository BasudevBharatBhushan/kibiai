# Ticket: T-001-chatbot-report-integration

## Title
Integrate ModularChatbot into Reports Page and Sync Configuration

## Description
We need to integrate the existing `ModularChatbot` component into the `kibiai/reports` page to handle AI-driven report generation based on the multi-table ERP setup. The AI will output JSON configurations for the report, which should automatically populate the `reportConfig` state and trigger rendering. 

The chatbot should implement the predefined prompt workflows (Type 1 Initialization, Type 2 Request, Type 3 Setup Update, Type 4 Config Update).
Additionally, the conversation ID from the chatbot must be saved to the database at `MultiTableReport::OpenAI_AssistantThreadID`.

## Requirements
1. Modify `ModularChatbot.tsx` to support callbacks for when an AI response contains JSON configurations (`onAssistantResponse`) and when a new conversation starts (`onConversationIdChange`).
2. Update `src/app/reports/page.tsx` to include the `ModularChatbot`.
3. Handle System Instructions using the established guidelines for reports.
4. Manage `predefined_prompt` switching in `page.tsx` based on user interactions (New chat vs. Manual config edit).
5. Extract `configJson` from the chatbot response and apply it to the `reportConfig` state automatically.
6. Ensure that `conversationId` is persisted via an API route (using FileMaker) to `MultiTableReport::OpenAI_AssistantThreadID`.

## Status
COMPLETED
