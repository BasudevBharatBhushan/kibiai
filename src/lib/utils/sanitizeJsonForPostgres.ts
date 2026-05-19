function cleanString(value: string): string {
  const withoutNulls = value
    .replace(/\u0000/g, "")
    .replace(/\\u0000/gi, "");

  let output = "";
  for (let index = 0; index < withoutNulls.length; index += 1) {
    const code = withoutNulls.charCodeAt(index);
    const next = withoutNulls.charCodeAt(index + 1);

    if (code >= 0xd800 && code <= 0xdbff) {
      if (next >= 0xdc00 && next <= 0xdfff) {
        output += withoutNulls[index] + withoutNulls[index + 1];
        index += 1;
      }
      continue;
    }

    if (code >= 0xdc00 && code <= 0xdfff) continue;
    output += withoutNulls[index];
  }

  return output;
}

export function sanitizeJsonForPostgres<T>(value: T): T {
  if (typeof value === "string") {
    return cleanString(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeJsonForPostgres(item)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        cleanString(key),
        sanitizeJsonForPostgres(entry),
      ])
    ) as T;
  }

  return value;
}
