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

  if (typeof record.response === "object" && record.response !== null) {
    // If the top level has response_to_user, use it as a direct response
    if (typeof (record.response as any).response_to_user === "string") {
      directResponses.push((record.response as any).response_to_user.trim());
    }
    return [...directResponses, ...collectResponseToUser(record.response)];
  }

  return directResponses;
}

export function extractAssistantDisplayText(raw: string): string {
  if (!raw) return "";

  const cleanText = raw.replace(/```json\s*|\s*```/g, "").trim();

  try {
    const parsed = JSON.parse(cleanText);

    if (typeof parsed === "object" && parsed !== null) {
      // 1. Try to find the conversational response string first
      const responseLines = collectResponseToUser(parsed);
      if (responseLines.length > 0) {
        return Array.from(new Set(responseLines)).join("\n\n");
      }

      // 2. If it's a raw insight plan, summarize it
      const record = parsed as Record<string, unknown>;
      if (Array.isArray(record.insights)) {
        return (record.response_to_user as string) || `I have generated ${record.insights.length} insight(s) based on your report data. You can find them on the dashboard.`;
      }

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
