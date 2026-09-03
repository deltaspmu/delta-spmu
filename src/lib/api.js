/**
 * Minimal Frappe client for the marketing site.
 *
 * The site is otherwise static — this exists solely so the contact form can
 * actually deliver a lead. Requests go to a same-origin /api path that
 * vercel.json rewrites to the Frappe backend, so there is no CORS surface.
 */
import config from "../config";

let csrfToken = null;

/**
 * Frappe requires a CSRF token on POST. It is bound to the session cookie, so
 * the token fetch and the POST must both send credentials. Guests get a valid
 * token from this endpoint too. Cached for the page's lifetime.
 */
async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  const res = await fetch(`${config.apiUrl}/api/method/lms.lms.api.get_csrf_token`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Could not start a secure session.");
  const body = await res.json();
  const message = body?.message;
  csrfToken = (typeof message === "string" ? message : message?.csrf_token) || null;
  if (!csrfToken) throw new Error("Could not start a secure session.");
  return csrfToken;
}

/** Pull a human-readable reason out of Frappe's error envelope. */
function errorFrom(body, fallback) {
  if (typeof body?.message === "string" && body.message) return body.message;
  try {
    const parsed = JSON.parse(body?._server_messages || "[]");
    if (parsed.length) {
      const first = JSON.parse(parsed[0]);
      if (first?.message) return String(first.message).replace(/<[^>]*>/g, "");
    }
  } catch {
    // Fall through to the generic message.
  }
  return fallback;
}

/**
 * Deliver a contact-form submission to the operations inbox.
 *
 * `subject` must be one of the keys the backend knows (general | courses |
 * technical | payment) — anything else is silently relabelled "Website Contact
 * Form" server-side. The backend has no phone parameter, so the caller folds
 * the phone number into the message body rather than dropping it.
 *
 * @throws {Error} with a displayable message when delivery fails.
 */
export async function submitContactForm({ name, email, subject, message }) {
  const token = await getCsrfToken();
  const res = await fetch(`${config.apiUrl}/api/method/lms.lms.api.submit_contact_form`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-Frappe-CSRF-Token": token,
    },
    body: JSON.stringify({ name, email, subject, message }),
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    // A stale token is the one failure worth not making the visitor retype
    // their message for — drop it so the next attempt fetches a fresh one.
    if (res.status === 403) csrfToken = null;
    throw new Error(
      errorFrom(body, "We could not deliver your message. Please try again in a moment."),
    );
  }
  return body?.message ?? body;
}
