/**
 * Delta SPMU Academy — Marketing Site Configuration
 *
 * Portal URLs are env-overridable so the marketing site can ship to Vercel
 * staging (pointing at vercel.app URLs) before DNS is configured, and then
 * switch to learn.deltaspmu.com / admin.deltaspmu.com later without code
 * changes.
 */
const studentPortalUrl =
  import.meta.env.VITE_STUDENT_PORTAL_URL || 'https://learn.deltaspmu.com';
const adminPortalUrl =
  import.meta.env.VITE_ADMIN_PORTAL_URL || 'https://admin.deltaspmu.com';
// Same-origin by default: vercel.json rewrites /api → the environment's Frappe
// host, which keeps the browser on one origin and avoids CORS entirely (the
// student and admin portals resolve their API the same way).
const apiUrl = import.meta.env.VITE_API_URL ?? '';

const config = {
  // Portal toggle — defaults to true. Set VITE_STUDENT_PORTAL_LIVE=false on
  // the marketing Vercel project to hide portal links if the portal is down.
  studentPortalLive: import.meta.env.VITE_STUDENT_PORTAL_LIVE !== 'false',

  // Analytics is opt-in per environment. Default OFF so preview deployments —
  // which resolve the /api rewrite to the PRODUCTION backend — never pollute
  // real traffic numbers. Set VITE_ANALYTICS=true on the live projects only.
  analyticsEnabled: import.meta.env.VITE_ANALYTICS === 'true',

  // URLs
  studentPortalUrl,
  adminPortalUrl,
  apiUrl,

  // Student portal routes
  signupUrl: `${studentPortalUrl}/register`,
  loginUrl: `${studentPortalUrl}/login`,
  coursesUrl: `${studentPortalUrl}/courses`,

  // Branding
  siteName: 'Delta SPMU Academy',
  tagline: 'Sacred Transformation',
  location: 'Bole, Redwan Bldg — Addis Ababa',
  email: 'deltaspmu@gmail.com',
  year: new Date().getFullYear(),
};

export default config;
