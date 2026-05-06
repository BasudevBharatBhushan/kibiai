# Ticket: T-026-refine-prompt-suggestions-ui

## Description
Refine the UI/UX for AI-generated prompt suggestions in the ModularChatbot. Suggestions should be vertically stacked, floating above the text area, and collapsible via the help icon. Clicking a suggestion should populate the textarea without sending. Add a refresh option for suggestions.

## Requirements
- [x] Vertically stacked suggestion list.
- [x] Floating above the text area, emerging from the bottom.
- [x] Collapsible toggle using the same `HelpCircle` icon.
- [x] "Refresh" button to regenerate suggestions.
- [x] Clicking a suggestion copies text to the textarea instead of auto-sending.
- [x] Professional, premium aesthetic.

## Scope
- `src/components/chat/ModularChatbot.tsx`

## Status
COMPLETED
