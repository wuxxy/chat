import { formatDistanceToNow, isToday, isYesterday, format } from 'date-fns';

/**
 * Format a timestamp into a human-friendly "chat" style string.
 * @param {number} ts - timestamp (like Date.now())
 * @returns {string}
 */
export function prettyTime(ts: string | number | Date) {
  const date = new Date(ts);

  if (isToday(date)) {
    const dist = formatDistanceToNow(date, { addSuffix: true });
    // if it's like "less than a minute ago" → show "just now"
    if (/less than.*minute/.test(dist)) return "just now";
    return dist; // e.g. "5 minutes ago"
  }

  if (isYesterday(date)) {
    return "yesterday";
  }

  // older → fallback to nice date
  return format(date, "yyyy-MM-dd HH:mm");
}