import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  MapPin,
  Mail,
  Facebook,
  Instagram,
  Youtube,
  ArrowRight,
  GraduationCap,
  Sparkles,
  BadgeCheck,
  Briefcase,
} from "lucide-react";
import config from "../config";

const NAV_LINKS = [
  { label: "Home", href: "#" },
  { label: "Programs", href: "#programs" },
  {
    label: "LMS Portal",
    href: config.studentPortalLive ? config.studentPortalUrl : "#programs",
    external: config.studentPortalLive,
  },
  { label: "Admissions", href: "#admissions" },
  { label: "FAQ", href: "#faq" },
  { label: "Contact", href: "#contact" },
];

const SOCIALS = [
  { label: "Facebook", href: "https://facebook.com", Icon: Facebook },
  { label: "Instagram", href: "https://instagram.com", Icon: Instagram },
  { label: "YouTube", href: "https://youtube.com", Icon: Youtube },
];

const FEATURES = [
  { label: "Expert Trainers", Icon: GraduationCap },
  { label: "Practical Learning", Icon: Sparkles },
  { label: "Certified Courses", Icon: BadgeCheck },
  { label: "Career Support", Icon: Briefcase },
];

/* TikTok isn't in lucide — small inline glyph keeps the row complete */
function TikTok({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.5 3a5.6 5.6 0 0 0 3.9 3.4v2.7a8.3 8.3 0 0 1-3.9-1.1v5.9a5.9 5.9 0 1 1-5.9-5.9c.3 0 .6 0 .9.1v2.8a3.1 3.1 0 1 0 2.2 3V3h2.8Z" />
    </svg>
  );
}

export default function Hero() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* ── animation variants ── */
  const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94], delay: i * 0.15 },
    }),
  };

  return (
    <section id="top" className="relative overflow-hidden bg-alabaster">
      {/* ── Decorative sage wash ── */}
      <div className="pointer-events-none absolute -right-32 -top-32 h-[34rem] w-[34rem] rounded-full bg-olive/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-tan/20 blur-3xl" />

      {/* ── Fixed Header (utility bar + nav) ── */}
      <header className="fixed top-0 left-0 z-50 w-full">
        {/* Utility bar — collapses on scroll */}
        <div
          className={`overflow-hidden bg-olive text-alabaster transition-all duration-500 ${
            scrolled ? "max-h-0 opacity-0" : "max-h-14 opacity-100"
          }`}
        >
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-2.5 lg:px-12">
            <div className="flex items-center gap-6 font-body text-[12px] font-light">
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" strokeWidth={1.75} />
                {config.location}
              </span>
              <a
                href={`mailto:${config.email}`}
                className="hidden items-center gap-1.5 transition-opacity hover:opacity-75 sm:flex"
              >
                <Mail className="h-3.5 w-3.5" strokeWidth={1.75} />
                {config.email}
              </a>
            </div>
            <div className="flex items-center gap-4">
              {SOCIALS.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="transition-opacity hover:opacity-75"
                >
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </a>
              ))}
              <a
                href="https://tiktok.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="TikTok"
                className="transition-opacity hover:opacity-75"
              >
                <TikTok className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>

        {/* Main nav */}
        <nav
          className={`w-full transition-all duration-500 ${
            scrolled
              ? "bg-alabaster/95 shadow-[0_8px_30px_rgba(47,61,42,0.08)] backdrop-blur-md"
              : "bg-alabaster/70 backdrop-blur-sm"
          }`}
        >
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-12">
            {/* Logo */}
            <a href="#top" className="block">
              <img
                src="/images/Delta-spmu-logo.png"
                alt="Delta SPMU Academy"
                className="h-11 w-auto"
              />
            </a>

            {/* Desktop Links */}
            <ul className="hidden items-center gap-8 lg:flex">
              {NAV_LINKS.map((link, i) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    {...(link.external
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                    className={`font-body text-[13px] font-medium uppercase tracking-wide transition-colors duration-300 hover:text-terracotta ${
                      i === 0 ? "text-terracotta" : "text-charcoal/80"
                    }`}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
              {config.studentPortalLive && (
                <>
                  <li>
                    <a
                      href={config.loginUrl}
                      className="inline-flex items-center gap-2 rounded-sm border border-terracotta px-5 py-2.5 font-body text-[12px] font-semibold uppercase tracking-wide text-terracotta transition-colors duration-300 hover:bg-terracotta hover:text-white"
                    >
                      Sign In
                    </a>
                  </li>
                  <li>
                    <a
                      href={config.coursesUrl}
                      className="inline-flex items-center gap-2 rounded-sm bg-terracotta px-5 py-2.5 font-body text-[12px] font-semibold uppercase tracking-wide text-white transition-colors duration-300 hover:bg-terracotta-dark"
                    >
                      Enroll Now
                    </a>
                  </li>
                </>
              )}
            </ul>

            {/* Mobile Hamburger */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="relative z-50 flex h-8 w-8 flex-col items-center justify-center gap-[5px] lg:hidden"
              aria-label="Toggle menu"
            >
              <span
                className={`block h-[1.5px] w-5 bg-charcoal transition-all duration-300 ${
                  menuOpen ? "translate-y-[6.5px] rotate-45" : ""
                }`}
              />
              <span
                className={`block h-[1.5px] w-5 bg-charcoal transition-all duration-300 ${
                  menuOpen ? "opacity-0" : ""
                }`}
              />
              <span
                className={`block h-[1.5px] w-5 bg-charcoal transition-all duration-300 ${
                  menuOpen ? "-translate-y-[6.5px] -rotate-45" : ""
                }`}
              />
            </button>
          </div>

          {/* Mobile Menu */}
          <div
            className={`overflow-hidden border-t border-charcoal/5 bg-alabaster/98 backdrop-blur-xl transition-all duration-500 lg:hidden ${
              menuOpen ? "max-h-[28rem]" : "max-h-0"
            }`}
          >
            <ul className="flex flex-col items-center gap-6 py-10">
              {NAV_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    {...(link.external
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                    onClick={() => setMenuOpen(false)}
                    className="font-body text-sm uppercase tracking-wide text-charcoal/80 transition-colors duration-300 hover:text-terracotta"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
              {config.studentPortalLive && (
                <>
                  <li>
                    <a
                      href={config.loginUrl}
                      onClick={() => setMenuOpen(false)}
                      className="font-body text-sm uppercase tracking-wide text-terracotta transition-colors duration-300 hover:text-charcoal"
                    >
                      Sign In
                    </a>
                  </li>
                  <li>
                    <a
                      href={config.signupUrl}
                      onClick={() => setMenuOpen(false)}
                      className="font-body text-sm uppercase tracking-wide text-terracotta transition-colors duration-300 hover:text-charcoal"
                    >
                      Sign Up
                    </a>
                  </li>
                  <li>
                    <a
                      href={config.coursesUrl}
                      onClick={() => setMenuOpen(false)}
                      className="mt-2 inline-flex items-center gap-2 rounded-sm bg-terracotta px-6 py-3 font-body text-sm font-semibold uppercase tracking-wide text-white transition-colors duration-300 hover:bg-terracotta-dark"
                    >
                      Enroll Now
                    </a>
                  </li>
                </>
              )}
            </ul>
          </div>
        </nav>
      </header>

      {/* ── Hero Content ── */}
      <div className="relative z-10 mx-auto grid min-h-screen max-w-7xl grid-cols-1 items-center gap-12 px-6 pb-16 pt-36 lg:grid-cols-2 lg:gap-8 lg:px-12 lg:pt-40">
        {/* ── Left: copy ── */}
        <div className="order-2 lg:order-1">
          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0}
            className="mb-5 font-body text-[12px] font-semibold uppercase tracking-wide text-terracotta"
          >
            Welcome to Delta SPMU Academy
          </motion.p>

          <motion.h1
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={1}
            className="font-heading text-[clamp(2.4rem,5.5vw,4.6rem)] leading-[1.05] tracking-tight text-charcoal"
          >
            Master the Art of{" "}
            <span className="text-terracotta">Permanent Makeup</span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={2}
            className="mt-5 font-heading text-[clamp(1.1rem,2vw,1.6rem)] font-light italic leading-snug text-olive-dark"
          >
            Empowering Beauty. Inspiring Futures.
          </motion.p>

          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={3}
            className="mt-6 max-w-xl font-body text-[15px] font-light leading-relaxed text-charcoal/65"
          >
            Addis Ababa&rsquo;s premier training academy for advanced cosmetic
            tattooing. Elevate your career with our internationally recognized
            blended learning programs.
          </motion.p>

          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={4}
            className="mt-10 flex flex-wrap gap-4"
          >
            <a
              href={config.studentPortalLive ? config.coursesUrl : "#programs"}
              className="group inline-flex items-center gap-2 bg-olive px-8 py-3.5 font-body text-[13px] font-semibold uppercase tracking-wide text-white transition-all duration-300 hover:bg-olive-dark hover:shadow-lg"
            >
              {config.studentPortalLive ? "Start Learning" : "Explore Programs"}
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </a>

            <a
              href={config.studentPortalLive ? "#programs" : "#admissions"}
              className="group inline-flex items-center gap-2 border border-charcoal/25 px-8 py-3.5 font-body text-[13px] font-semibold uppercase tracking-wide text-charcoal transition-all duration-300 hover:border-charcoal hover:bg-charcoal hover:text-white"
            >
              {config.studentPortalLive ? "Explore Programs" : "Admissions"}
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </a>
          </motion.div>
        </div>

        {/* ── Right: image + feature badges ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.2 }}
          className="relative order-1 mx-auto w-full max-w-md lg:order-2 lg:max-w-none lg:pr-20"
        >
          {/* Arched sage frame behind */}
          <div className="absolute inset-x-6 -top-4 bottom-0 rounded-t-[180px] bg-olive/15 lg:inset-x-10" />

          {/* Portrait */}
          <div className="relative overflow-hidden rounded-t-[180px] rounded-b-2xl shadow-[0_30px_80px_rgba(47,61,42,0.18)]">
            <img
              src="/images/Hero_Image.jpg"
              alt="Permanent makeup artist at work"
              className="aspect-[4/5] h-full w-full object-cover"
            />
          </div>

          {/* Feature badges — wrap below the portrait on mobile (no overflow),
              float as a column over the image on large screens. */}
          <div className="mt-5 flex flex-wrap justify-center gap-3 lg:absolute lg:right-0 lg:top-1/2 lg:mt-0 lg:-translate-y-1/2 lg:flex-col lg:flex-nowrap lg:justify-start lg:-right-2">
            {FEATURES.map(({ label, Icon }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: 0.6,
                  ease: [0.25, 0.46, 0.45, 0.94],
                  delay: 0.6 + i * 0.12,
                }}
                className="flex items-center gap-2.5 rounded-full bg-white/95 py-2 pl-2 pr-4 shadow-[0_10px_30px_rgba(47,61,42,0.12)] backdrop-blur-sm"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tan/60 text-charcoal">
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <span className="font-body text-[10px] font-semibold uppercase leading-tight tracking-wide text-charcoal">
                  {label}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
