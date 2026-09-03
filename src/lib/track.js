/**
 * Marketing-site analytics — first-party event collector.
 *
 * The site is a static single-page app, so nothing about visitor behaviour was
 * measurable before this: people arrive, some click through to the student
 * portal, and everything in between was invisible. This sends a handful of
 * anonymous events to the Frappe backend, which the admin portal renders as the
 * acquisition funnel.
 *
 * Deliberately small: no vendor script, no cookies, no PII, no IP stored. A
 * random id in localStorage distinguishes repeat visitors, and that's all.
 */
import config from "../config";

const VISITOR_KEY = "deltaspmu_vid";
const SESSION_KEY = "deltaspmu_sid";
const PAGEVIEW_KEY = "deltaspmu_pv_sent";

// Section anchors in document order. The numeric prefix makes "how far down did
// they get" sortable server-side without the dashboard needing to know the page
// layout — add a section here and the chart picks it up.
const SECTIONS = [
  "top",
  "about",
  "founder",
  "programs",
  "admissions",
  "faq",
  "contact",
];

/** Storage can throw (Safari private mode, embedded webviews, blocked cookies). */
function safeStorage(store, key, makeValue) {
  try {
    const existing = store.getItem(key);
    if (existing) return existing;
    const created = makeValue();
    store.setItem(key, created);
    return created;
  } catch {
    // No storage: still emit events, just without a stable id. Visitor counts
    // degrade toward session counts rather than the page breaking.
    return makeValue();
  }
}

function randomId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function deviceClass() {
  const ua = navigator.userAgent || "";
  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua)) return "tablet";
  if (/Mobi|Android|iPhone|iPod|IEMobile|Opera Mini/i.test(ua)) return "mobile";
  return "desktop";
}

let context = null;

function getContext() {
  if (context) return context;
  const params = new URLSearchParams(window.location.search);
  context = {
    visitor_id: safeStorage(window.localStorage, VISITOR_KEY, randomId),
    session_id: safeStorage(window.sessionStorage, SESSION_KEY, randomId),
    device: deviceClass(),
    referrer: document.referrer || "",
    utm_source: params.get("utm_source") || "",
    utm_medium: params.get("utm_medium") || "",
    utm_campaign: params.get("utm_campaign") || "",
  };
  return context;
}

/**
 * Send one event. Fire-and-forget: never awaited, never throws into the page.
 *
 * GET, not POST, on purpose — these fire during page unload, where the only
 * transport that survives is a keepalive request, and keepalive/sendBeacon
 * cannot set the CSRF header a Frappe POST requires. The backend endpoint
 * documents the same tradeoff.
 */
export function track(event, label = "") {
  if (!config.analyticsEnabled) return;
  try {
    const query = new URLSearchParams({
      event,
      label,
      path: window.location.pathname,
      ...getContext(),
    });
    fetch(`${config.apiUrl}/api/method/lms.lms.site_analytics.track?${query}`, {
      method: "GET",
      keepalive: true,
      credentials: "omit",
    }).catch(() => {});
  } catch {
    // Analytics must never break the marketing site.
  }
}

/** One page_view per session, not per mount — React StrictMode mounts twice in dev. */
function trackPageView() {
  try {
    if (window.sessionStorage.getItem(PAGEVIEW_KEY)) return;
    window.sessionStorage.setItem(PAGEVIEW_KEY, "1");
  } catch {
    // Storage blocked: accept a possible duplicate rather than losing the view.
  }
  track("page_view");
}

/**
 * Watch how far down the page people actually get.
 *
 * Reports once, on the way out, with the deepest section reached — not an event
 * per scroll tick. The page is one long scroll, so this is the closest thing it
 * has to a "did they reach the programs?" metric.
 */
function trackScrollDepth() {
  let deepest = -1;

  // Default threshold (0): a section counts as reached the moment any of it
  // scrolls into view. A percentage threshold looks stricter but silently fails
  // on the sections that matter — Programs is 1510px tall, so on a phone it can
  // never occupy 40% of the viewport and would never register at all.
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const index = SECTIONS.indexOf(entry.target.id);
      if (index > deepest) deepest = index;
    }
  });

  for (const id of SECTIONS) {
    const el = document.getElementById(id);
    if (el) observer.observe(el);
  }

  let sent = false;
  const flush = () => {
    if (sent || deepest < 0) return;
    sent = true;
    observer.disconnect();
    track("scroll_depth", `${deepest}-${SECTIONS[deepest]}`);
  };

  // Two triggers, because neither alone is reliable. visibilitychange is the
  // only signal mobile Safari fires when the user switches apps, but it also
  // fires when someone merely tabs away and comes back — so it must check for
  // "hidden". pagehide covers the actual teardown (closing the tab, following a
  // CTA to the portal), which is the common exit here and does not always
  // produce a visibilitychange first. `sent` keeps it to one event either way.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
  window.addEventListener("pagehide", flush);
}

/**
 * One delegated listener for every CTA, rather than an onClick prop threaded
 * through eight components. Mark a link with data-cta="..." and it's tracked.
 */
function trackCtaClicks() {
  document.addEventListener("click", (event) => {
    const el = event.target.closest?.("[data-cta]");
    if (el) track("cta_click", el.dataset.cta);
  });
}

let started = false;

/**
 * Wire up the collector from the app entry point.
 *
 * Waits for `load` because the scroll observer needs React's sections to exist
 * in the DOM, and guards against a second call so StrictMode's double-invoke in
 * dev can't register two click listeners and double every CTA count.
 */
export function initAnalytics() {
  if (!config.analyticsEnabled || started) return;
  started = true;

  const start = () => {
    trackPageView();
    trackScrollDepth();
    trackCtaClicks();
  };

  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
}
