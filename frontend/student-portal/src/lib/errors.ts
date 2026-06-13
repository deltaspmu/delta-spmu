/**
 * Extract the best human-readable message from a Frappe/axios error.
 *
 * Frappe returns rich error payloads that axios flattens to the useless
 * "Request failed with status code NNN". This digs out the real message,
 * trying sources in order of usefulness and never throwing on bad input:
 *
 *   1. response.data._server_messages — a JSON STRING whose value is a JSON
 *      ARRAY of JSON STRINGS, each an object with a `message` field. Multiple
 *      messages are joined with newlines; HTML tags are stripped.
 *   2. response.data.exception — "frappe.exceptions.XxxError: message"; the
 *      leading "frappe.exceptions.XxxError: " prefix is removed.
 *   3. response.data.message — when it is a plain string.
 *   4. err.message — the raw axios/Error message.
 *   5. A generic fallback.
 */
export function extractFrappeError(err: unknown): string {
  const FALLBACK = 'Something went wrong. Please try again.';

  // Narrow `err` to something with an optional axios-shaped `response.data`
  // and an optional `message`, without assuming axios is the source.
  const e = err as
    | {
        response?: { data?: unknown };
        message?: unknown;
      }
    | null
    | undefined;

  const data = e?.response?.data as
    | {
        _server_messages?: unknown;
        exception?: unknown;
        message?: unknown;
      }
    | undefined;

  const stripHtml = (s: string): string =>
    s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

  // 1. _server_messages — JSON string -> array of JSON strings -> { message }
  if (data && typeof data._server_messages === 'string') {
    try {
      const arr = JSON.parse(data._server_messages);
      if (Array.isArray(arr)) {
        const messages = arr
          .map((item) => {
            if (typeof item !== 'string') return '';
            try {
              const parsed = JSON.parse(item) as { message?: unknown };
              return typeof parsed?.message === 'string' ? parsed.message : '';
            } catch {
              // Item wasn't JSON — treat it as a plain message string.
              return item;
            }
          })
          .map((m) => stripHtml(m))
          .filter((m) => m.length > 0);
        if (messages.length > 0) return messages.join('\n');
      }
    } catch {
      // Malformed _server_messages — fall through to the next source.
    }
  }

  // 2. exception — strip the "frappe.exceptions.XxxError: " prefix
  if (data && typeof data.exception === 'string' && data.exception.trim()) {
    const exc = data.exception.replace(/^[\w.]*?(?:Error|Exception):\s*/, '').trim();
    if (exc) return stripHtml(exc);
  }

  // 3. response.data.message — only when it is a plain string
  if (data && typeof data.message === 'string' && data.message.trim()) {
    return stripHtml(data.message);
  }

  // 4. axios / Error message
  if (typeof e?.message === 'string' && e.message.trim()) {
    return e.message;
  }

  // 5. final generic fallback
  return FALLBACK;
}
