# Implementation Plan: P-026-refine-prompt-suggestions-ui

## Objective
Upgrade the prompt suggestion UI in `ModularChatbot.tsx` to a vertical, floating, and interactive list.

## Proposed Changes

### 1. `src/components/chat/ModularChatbot.tsx`
- **State Management**:
  - Keep `showPrompts` for toggling.
  - Keep `aiSuggestions`.
- **UI Refactoring**:
  - Move the suggestion container to be absolutely positioned above the input area.
  - Use `flex-col` for vertical stacking.
  - Style with rounded corners, subtle borders, and a backdrop-blur (glassmorphism).
  - Add a "Refresh" icon/button within the suggestion header or footer.
- **Refresh Logic**:
  - Create a `refreshSuggestions` function that re-sends the initialization prompt to the AI.
- **Interaction Change**:
  - Update `selectPrompt` to call `setInput(text)` and `inputRef.current?.focus()` instead of `sendMessageToAI(text)`.
- **Icon Toggle**:
  - Ensure the `HelpCircle` icon toggles the suggestions.

### 2. Styling
- Enhance the `chatbot.css` if needed, or use inline Tailwind classes for the floating effect.

## Verification Plan
- [ ] Toggle suggestions using the help icon.
- [ ] Verify suggestions appear in a vertical list above the input.
- [ ] Click a suggestion and verify it populates the textarea without sending.
- [ ] Click refresh and verify suggestions are updated.
- [ ] Check responsive behavior (should not break on mobile).

## Safety Check
- No destructive changes.
- Purely UI/UX enhancement.
