export function formatUserPrompt(input: string) {
  const trimmed = input.trim();

  if (trimmed.endsWith(".json")) {
    return trimmed;
  }

  return `${trimmed}.json`;
}
