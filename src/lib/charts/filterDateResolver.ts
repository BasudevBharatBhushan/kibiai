/**
 * Resolves relative date tokens in v2 chart filter strings.
 *
 * Supported tokens:
 *   TODAY
 *   TODAY - X Days
 *   TODAY - X Months
 *   TODAY - X Years
 *   REPORT_START
 *   REPORT_END
 *
 * @param filterRule  - raw string e.g. "Invoice Date: >=TODAY - 3 Months"
 * @param reportStart - ISO date string from report context (optional)
 * @param reportEnd   - ISO date string from report context (optional)
 * @returns the filter string with tokens replaced by concrete ISO date strings
 */
export function resolveFilterDates(
  filterRule: string,
  reportStart?: string,
  reportEnd?: string
): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return filterRule.replace(
    /\b(TODAY(?:\s*-\s*(\d+)\s*(Days?|Months?|Years?))?|REPORT_START|REPORT_END)\b/gi,
    (token) => {
      const t = token.trim().toUpperCase();

      if (t === 'REPORT_START') {
        return reportStart ?? toIsoDate(today);
      }
      if (t === 'REPORT_END') {
        return reportEnd ?? toIsoDate(today);
      }

      // TODAY or TODAY - X Unit
      const match = t.match(/^TODAY\s*-\s*(\d+)\s*(DAY|MONTH|YEAR)/i);
      if (!match) return toIsoDate(today); // plain TODAY

      const amount = parseInt(match[1], 10);
      const unit = match[2].toUpperCase();
      const d = new Date(today);

      if (unit.startsWith('DAY'))   d.setDate(d.getDate() - amount);
      if (unit.startsWith('MONTH')) d.setMonth(d.getMonth() - amount);
      if (unit.startsWith('YEAR'))  d.setFullYear(d.getFullYear() - amount);

      return toIsoDate(d);
    }
  );
}

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
