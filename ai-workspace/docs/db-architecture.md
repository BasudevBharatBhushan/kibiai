# DB ARCHITECTURE

## Database System: MongoDB

## Pattern
- **Schema-less Flexibilty**: While MongoDB is schema-less, we enforce validation at the **application layer** using Zod.
- **Reference Pattern**: Use IDs for relationships between collections. Avoid deep embedding unless data is small and tightly coupled.

## Core Collections (Preliminary)
- `users`: Profile data, authentication info.
- `tickets`: Linked to AI Governance (optional integration).
- `analysis_results`: Stored results for AI analysis.
- `system_config`: App-wide settings.

## Integration
- Always use environment variables for `MONGODB_URI`.
- Connection should follow the `lib/mongodb` pattern to handle hot-reloading in dev.
