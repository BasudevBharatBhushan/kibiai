# P-026: Chatbot Suggestions and Initialization Refinement

## Context
The user wants the Report Builder chatbot to automatically suggest reports if no config is present. They also want the prompt suggestions (chips) to appear below the input field and be toggled by the help icon.

## Proposed Changes

### 1. Frontend: Report Builder Initialization (`src/app/[company_slug]/templates/[template_id]/configurator/page.tsx`)
- Modify `buildPredefinedPrompt` to include a clear instruction: `"Suggest me prompt related to it."` when no configuration exists.
- This will ensure the AI follows the `TYPE 1: REPORT INITIALIZATION` logic in its instruction set.

### 2. Frontend: ModularChatbot UI (`src/components/chat/ModularChatbot.tsx`)
- **Move Suggestions Rail**: Relocate the `showPromptRail` section to be below the input form container.
- **Trigger Logic**: The `showPrompts` state is already toggled by the help icon. I'll ensure it works as expected and shows the suggestions in the new location.
- **AI Suggestions**: Add logic to handle dynamic `report_suggestions` or `chart_suggestions` returned by the AI in the chat history.

### 3. Frontend: Automatic Initialization
- In `ModularChatbot`, add an `useEffect` that checks if:
    - `conversationId` is null.
    - `messages` is empty.
    - `predefinedPrompt` is present.
- If all true, automatically send a hidden initialization message to get suggestions.

### 4. Styling
- Update `chatbot.css` to accommodate the new suggestion layout.

## Verification Plan
- [ ] Open a new report template (no config).
- [ ] Verify that the chatbot automatically sends the schema and returns suggestions.
- [ ] Verify that clicking the question icon toggles the suggestion rail.
- [ ] Verify that the rail appears below the input field.
- [ ] Verify that suggestions are interactive.
