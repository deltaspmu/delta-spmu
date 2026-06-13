import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import config from "../config";

export default function FooterCTA() {
  const sectionRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const imageScale = useTransform(scrollYProgress, [0, 1], [1.15, 1]);

  const reveal = {
    hidden: { opacity: 0, y: 30 },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        ease: [0.25, 0.46, 0.45, 0.94],
        delay: i * 0.12,
      },
    }),
  };

  return (
    <>
      {/* ── CTA Section ── */}
      <section
        ref={sectionRef}
        className="relative flex min-h-[85vh] items-center justify-center overflow-hidden"
      >
        {/* Background image */}
        <motion.img
          src="/images/Admissions.jpg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ scale: imageScale }}
        />

        {/* Heavy dark overlay */}
        <div className="absolute inset-0 bg-charcoal/80" />
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal via-transparent to-charcoal/40" />

        {/* Content */}
        <div className="relative z-10 mx-auto max-w-3xl px-6 text-center">
          <motion.div
            variants={reveal}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={0}
            className="mx-auto mb-6 h-[1px] w-12 bg-nude/50"
          />

          <motion.h2
            variants={reveal}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={1}
            className="font-heading text-[clamp(2rem,5vw,3.8rem)] leading-[1.08] tracking-tight text-white"
          >
            Ready to Begin
            <br />
            Your <span className="italic text-nude">Journey</span>?
          </motion.h2>

          <motion.p
            variants={reveal}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={2}
            className="mx-auto mt-6 max-w-lg font-body text-[15px] font-light leading-relaxed text-white/50"
          >
            Join a disciplined, professional learning community committed to
            excellence. Apply today, access the LMS, and start your sacred
            transformation.
          </motion.p>

          <motion.div
            variants={reveal}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={3}
          >
            <a
              href="#admissions"
              className="group mt-10 inline-flex items-center gap-3 bg-nude px-10 py-4 font-body text-[13px] font-semibold uppercase tracking-wide text-white transition-all duration-300 hover:bg-terracotta-dark hover:shadow-[0_20px_60px_rgba(192,112,60,0.3)]"
            >
              Apply for Enrollment
              <svg
                className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
            </a>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-charcoal">
        <div className="mx-auto max-w-7xl px-6 lg:px-12">
          {/* Top border */}
          <div className="h-[1px] w-full bg-white/[0.06]" />

          <div className="grid gap-12 py-16 md:grid-cols-3">
            {/* Brand */}
            <div>
              <a href="#" className="block">
                <img
                  src="/images/Delta-spmu-logo.png"
                  alt="Delta SPMU Academy"
                  className="h-12 w-auto brightness-0 invert"
                />
              </a>
              <p className="mt-3 font-body text-[13px] font-light leading-relaxed text-white/40">
                Professional permanent makeup training academy. Master the art
                of cosmetic tattooing with certified courses.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="font-body text-[11px] font-semibold uppercase tracking-wider text-white/50">
                Quick Links
              </h4>
              <ul className="mt-4 space-y-2.5">
                {config.studentPortalLive && (
                  <>
                    <li>
                      <a href={config.coursesUrl} className="font-body text-[13px] text-white/30 transition-colors hover:text-nude">
                        Browse Courses
                      </a>
                    </li>
                    <li>
                      <a href={config.signupUrl} className="font-body text-[13px] text-white/30 transition-colors hover:text-nude">
                        Create Account
                      </a>
                    </li>
                    <li>
                      <a href={config.loginUrl} className="font-body text-[13px] text-white/30 transition-colors hover:text-nude">
                        Student Login
                      </a>
                    </li>
                  </>
                )}
                <li>
                  <a href="#about" className="font-body text-[13px] text-white/30 transition-colors hover:text-nude">
                    About Us
                  </a>
                </li>
                <li>
                  <a href="#faq" className="font-body text-[13px] text-white/30 transition-colors hover:text-nude">
                    FAQ
                  </a>
                </li>
                <li>
                  <a href="#contact" className="font-body text-[13px] text-white/30 transition-colors hover:text-nude">
                    Contact
                  </a>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="font-body text-[11px] font-semibold uppercase tracking-wider text-white/50">
                Legal
              </h4>
              <ul className="mt-4 space-y-2.5">
                {config.studentPortalLive ? (
                  <>
                    <li>
                      <a href={`${config.studentPortalUrl}/privacy`} className="font-body text-[13px] text-white/30 transition-colors hover:text-nude">
                        Privacy Policy
                      </a>
                    </li>
                    <li>
                      <a href={`${config.studentPortalUrl}/terms`} className="font-body text-[13px] text-white/30 transition-colors hover:text-nude">
                        Terms of Service
                      </a>
                    </li>
                    <li>
                      <a href={`${config.studentPortalUrl}/refund`} className="font-body text-[13px] text-white/30 transition-colors hover:text-nude">
                        Refund Policy
                      </a>
                    </li>
                  </>
                ) : (
                  <li>
                    <span className="font-body text-[13px] text-white/20">
                      Coming soon
                    </span>
                  </li>
                )}
              </ul>
              <p className="mt-6 font-body text-[12px] text-white/20">
                {config.location}
              </p>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="h-[1px] w-full bg-white/[0.06]" />
          <div className="flex flex-col items-center justify-between gap-4 py-8 md:flex-row">
            <div className="flex flex-col items-center gap-1 md:items-start">
              <p className="font-body text-[12px] font-light text-white/25">
                &copy; {config.year} {config.siteName}. All rights reserved.
              </p>
              <p className="font-body text-[11px] font-light text-white/20">
                Powered by Philocom
              </p>
            </div>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="group flex items-center gap-2 font-body text-[11px] uppercase tracking-wide text-white/25 transition-colors duration-300 hover:text-nude"
            >
              Back to top
              <svg
                className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-y-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 15l7-7 7 7"
                />
              </svg>
            </button>
          </div>
        </div>
      </footer>
    </>
  );
}
