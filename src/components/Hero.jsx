import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import config from "../config";

const NAV_LINKS = [
  { label: "Home", href: "#" },
  { label: "Programs", href: "#programs" },
  { label: "LMS Portal", href: "#lms" },
  { label: "Admissions", href: "#admissions" },
  { label: "FAQ", href: "#faq" },
  { label: "Contact", href: "#contact" },
];

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
    <section className="relative h-screen w-full overflow-hidden">
      {/* ── Background Video ── */}
      <video
        className="absolute inset-0 h-full w-full object-cover"
        src="/videos/hero-bg.mp4"
        autoPlay
        loop
        muted
        playsInline
      />

      {/* ── Overlay ── */}
      <div className="absolute inset-0 bg-charcoal/70" />

      {/* ── Navigation ── */}
      <nav
        className={`fixed top-0 left-0 z-50 w-full transition-all duration-500 ${
          scrolled
            ? "bg-charcoal/80 backdrop-blur-md shadow-lg"
            : "bg-transparent"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-12">
          {/* Logo */}
          <a href="#" className="block">
            <img
              src="/images/Delta-spmu-logo.png"
              alt="Delta SPMU Academy"
              className="h-12 w-auto brightness-0 invert"
            />
          </a>

          {/* Desktop Links */}
          <ul className="hidden items-center gap-10 md:flex">
            {NAV_LINKS.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  className="font-body text-[13px] font-light uppercase tracking-wide text-white/80 transition-colors duration-300 hover:text-nude"
                >
                  {link.label}
                </a>
              </li>
            ))}
            {config.studentPortalLive && (
              <li>
                <a
                  href={config.loginUrl}
                  className="rounded-sm border border-nude/40 px-4 py-2 font-body text-[12px] font-semibold uppercase tracking-wide text-nude transition-colors duration-300 hover:bg-nude hover:text-charcoal"
                >
                  Sign In
                </a>
              </li>
            )}
          </ul>

          {/* Mobile Hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="relative z-50 flex h-8 w-8 flex-col items-center justify-center gap-[5px] md:hidden"
            aria-label="Toggle menu"
          >
            <span
              className={`block h-[1.5px] w-5 bg-white transition-all duration-300 ${
                menuOpen ? "translate-y-[6.5px] rotate-45" : ""
              }`}
            />
            <span
              className={`block h-[1.5px] w-5 bg-white transition-all duration-300 ${
                menuOpen ? "opacity-0" : ""
              }`}
            />
            <span
              className={`block h-[1.5px] w-5 bg-white transition-all duration-300 ${
                menuOpen ? "-translate-y-[6.5px] -rotate-45" : ""
              }`}
            />
          </button>
        </div>

        {/* Mobile Menu */}
        <div
          className={`absolute left-0 top-full w-full overflow-hidden bg-charcoal/95 backdrop-blur-xl transition-all duration-500 md:hidden ${
            menuOpen ? "max-h-[28rem]" : "max-h-0"
          }`}
        >
          <ul className="flex flex-col items-center gap-6 py-10">
            {NAV_LINKS.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="font-body text-sm uppercase tracking-wide text-white/90 transition-colors duration-300 hover:text-nude"
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
                    className="font-body text-sm uppercase tracking-wide text-nude transition-colors duration-300 hover:text-white"
                  >
                    Sign In
                  </a>
                </li>
                <li>
                  <a
                    href={config.signupUrl}
                    onClick={() => setMenuOpen(false)}
                    className="font-body text-sm uppercase tracking-wide text-nude transition-colors duration-300 hover:text-white"
                  >
                    Sign Up
                  </a>
                </li>
              </>
            )}
          </ul>
        </div>
      </nav>

      {/* ── Hero Content ── */}
      <div className="relative z-10 flex h-full items-center">
        <div className="mx-auto w-full max-w-7xl px-6 lg:px-12">
          {/* Overline */}
          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0}
            className="mb-5 font-body text-[11px] font-semibold uppercase tracking-wide text-nude"
          >
            Addis Ababa&rsquo;s Premier Academy
          </motion.p>

          {/* Headline */}
          <motion.h1
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={1}
            className="max-w-3xl font-heading text-[clamp(2.2rem,5.5vw,4.5rem)] leading-[1.08] tracking-tight text-white"
          >
            Master the Art of{" "}
            <span className="text-nude">Permanent Makeup</span>{" "}
            at Delta SPMU Academy
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={2}
            className="mt-6 max-w-xl font-body text-[15px] font-light leading-relaxed text-white/70"
          >
            Addis Ababa&rsquo;s premier training academy for advanced cosmetic
            tattooing. Elevate your career with our internationally recognized
            blended learning programs.
          </motion.p>

          {/* CTAs */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={3}
            className="mt-10 flex flex-wrap gap-4"
          >
            {config.studentPortalLive && (
              <a
                href={config.coursesUrl}
                className="group inline-flex items-center gap-2 bg-nude px-8 py-3.5 font-body text-[13px] font-semibold uppercase tracking-wide text-charcoal transition-all duration-300 hover:bg-nude-dark hover:shadow-lg"
              >
                Start Learning
                <svg
                  className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </a>
            )}

            <a
              href="#programs"
              className={`group inline-flex items-center gap-2 px-8 py-3.5 font-body text-[13px] font-semibold uppercase tracking-wide transition-all duration-300 ${
                config.studentPortalLive
                  ? "border border-white/30 text-white hover:border-white hover:bg-white/10"
                  : "bg-nude text-charcoal hover:bg-nude-dark hover:shadow-lg"
              }`}
            >
              Explore Programs
              <svg
                className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </a>

            <a
              href="#admissions"
              className="inline-flex items-center border border-white/30 px-8 py-3.5 font-body text-[13px] font-semibold uppercase tracking-wide text-white transition-all duration-300 hover:border-white hover:bg-white/10"
            >
              Admissions Process
            </a>
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.8, duration: 1 }}
            className="absolute bottom-10 left-1/2 -translate-x-1/2"
          >
            <div className="flex flex-col items-center gap-2">
              <span className="font-body text-[10px] uppercase tracking-widest text-white/40">
                Scroll
              </span>
              <div className="h-10 w-[1px] animate-pulse bg-gradient-to-b from-white/40 to-transparent" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
