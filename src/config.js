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
const apiUrl = import.meta.env.VITE_API_URL || 'https://api.deltaspmu.com';

const config = {
  // Portal toggle — defaults to true. Set VITE_STUDENT_PORTAL_LIVE=false on
  // the marketing Vercel project to hide portal links if the portal is down.
  studentPortalLive: import.meta.env.VITE_STUDENT_PORTAL_LIVE !== 'false',

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
  location: 'Addis Ababa, Ethiopia',
  email: 'info@deltaspmu.com',
  year: new Date().getFullYear(),
};

export default config;
