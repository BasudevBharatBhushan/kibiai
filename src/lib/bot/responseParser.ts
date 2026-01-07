// Parses the assistant's response to extract meaningful content
export function parseAssistantResponse(raw: string): string {
  if (!raw) return "";

  const cleanText = raw.replace(/```json\s*|\s*```/g, "").trim();

  try {
    const parsed = JSON.parse(cleanText);

    if (typeof parsed === "object" && parsed !== null) {
      if (typeof parsed.response === "string") return parsed.response;
      if (typeof parsed.answer === "string") return parsed.answer;
      
      return Object.values(parsed)
        .map((val) => (typeof val === "string" ? val : JSON.stringify(val)))
        .join("\n\n");
    }

    return String(parsed);
  } catch (e) {
    return raw;
  }
}