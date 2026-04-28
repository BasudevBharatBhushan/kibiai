function collectResponseToUser(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];

  if (Array.isArray(value)) {
    return value.flatMap(collectResponseToUser);
  }

  const record = value as Record<string, unknown>;
  const directResponses =
    typeof record.response_to_user === "string" && record.response_to_user.trim()
      ? [record.response_to_user.trim()]
      : [];

  if (Array.isArray(record.responses)) {
    return [...directResponses, ...collectResponseToUser(record.responses)];
  }

  return directResponses;
}

export function extractAssistantDisplayText(raw: string): string {
  if (!raw) return "";

  const cleanText = raw.replace(/```json\s*|\s*```/g, "").trim();

  try {
    const parsed = JSON.parse(cleanText);

    if (typeof parsed === "object" && parsed !== null) {
      const responseLines = collectResponseToUser(parsed);
      if (responseLines.length > 0) {
        return responseLines.join("\n\n");
      }

      const record = parsed as Record<string, unknown>;
      if (typeof record.response === "string") return record.response;
      if (typeof record.answer === "string") return record.answer;

      return Object.values(record)
        .map((val) => (typeof val === "string" ? val : JSON.stringify(val)))
        .join("\n\n");
    }

    return String(parsed);
  } catch {
    return raw;
  }
}

// Parses the assistant's response to extract meaningful content
export function parseAssistantResponse(raw: string): string {
  return extractAssistantDisplayText(raw);
}
