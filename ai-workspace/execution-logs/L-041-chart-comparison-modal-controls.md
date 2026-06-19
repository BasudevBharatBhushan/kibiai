# L-041 Chart Comparison Modal Controls

## Log
- Started frontend task for chart comparison modal controls and spacing.
- Added reusable comparison view actions in `CompareModal`.
- Added chart panel inner bounds and modal spacing updates in `dashboard.css`.
- Cleaned local `CompareModal` lint issues around explicit `any`, unused imports, and hook dependencies.
- Ran focused ESLint on touched comparator TSX files: passed.
- Ran `npx tsc --noEmit`: passed.
- Ran `npm run lint`: failed because `next lint` is interpreted as a `lint` project directory by the installed Next.js CLI.
- Ran `npm run build`: failed before app compilation due to Turbopack internal errors outside the changed files.
- Ran `graphify update .`: completed.
