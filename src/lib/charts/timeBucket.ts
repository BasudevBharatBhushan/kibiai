export type TimeBucket = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'day_of_week';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Buckets a raw date string value into a display label based on the requested bucket.
 * Returns the original value if it cannot be parsed as a date.
 *
 * Bucket sort keys are prefixed with an ISO-like string so they sort chronologically
 * even after label formatting.
 */
export function bucketDate(rawValue: string | undefined | null, bucket: TimeBucket): string {
  if (!rawValue) return '';
  const d = new Date(rawValue);
  if (isNaN(d.getTime())) return String(rawValue); // not a date — pass through

  switch (bucket) {
    case 'day':
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    case 'week': {
      const jan1 = new Date(d.getFullYear(), 0, 1);
      const weekNum = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
      return `${d.getFullYear()}-W${pad(weekNum)}`;
    }
    case 'month':
      return `${d.getFullYear()}-${MONTH_NAMES[d.getMonth()]}`;
    case 'quarter': {
      const q = Math.floor(d.getMonth() / 3) + 1;
      return `${d.getFullYear()}-Q${q}`;
    }
    case 'year':
      return `${d.getFullYear()}`;
    case 'day_of_week':
      return DAY_NAMES[d.getDay()];
    default:
      return String(rawValue);
  }
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
