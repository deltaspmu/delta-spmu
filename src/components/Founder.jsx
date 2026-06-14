import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
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

/* Focus areas pulled from the academy curriculum — kept factual */
const FOCUS = ["Hygiene & Safety", "Brow Artistry", "Instructor Training"];

export default function Founder() {
  const sectionRef = useRef(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const imageY = useTransform(scrollYProgress, [0, 1], [40, -40]);

  return (
    <section
      id="founder"
      ref={sectionRef}
      className="relative overflow-hidden bg-charcoal py-28 md:py-40"
    >
      {/* Soft warm glow accents */}
      <div className="pointer-events-none absolute -left-32 top-10 h-96 w-96 rounded-full bg-olive/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-terracotta/[0.07] blur-3xl" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-6 md:grid-cols-12 md:gap-12 lg:px-12">
        {/* ── Portrait ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 1, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="relative order-1 mx-auto w-full max-w-sm md:col-span-5 md:max-w-none"
        >
          {/* Arched olive frame behind — echoes the hero portrait */}
          <div className="absolute inset-x-5 -top-4 bottom-4 rounded-t-[150px] bg-olive/15" />

          {/* Portrait */}
          <div className="relative overflow-hidden rounded-t-[150px] rounded-b-2xl shadow-[0_30px_80px_rgba(0,0,0,0.4)]">
            <motion.img
              src="/images/eden-kassahun.jpg"
              alt="Eden Kassahun, Founder & Lead Educator of Delta SPMU Academy"
              className="aspect-[4/5] h-full w-full object-cover object-top"
              style={{ y: imageY }}
            />
            {/* Warm bottom gradient */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-charcoal/70 to-transparent" />
          </div>

          {/* Floating credential seal */}
          <div className="absolute -bottom-5 -right-3 flex h-20 w-20 items-center justify-center rounded-full border border-terracotta/30 bg-charcoal/80 backdrop-blur-sm md:-right-5">
            <div className="flex h-14 w-14 flex-col items-center justify-center rounded-full border border-terracotta/20 text-center">
              <span className="font-heading text-lg leading-none text-terracotta">Δ</span>
              <span className="mt-1 font-body text-[7px] font-semibold uppercase tracking-wide text-white/50">
                Lead Educator
              </span>
            </div>
          </div>
        </motion.div>

        {/* ── Copy ── */}
        <div className="order-2 md:col-span-6 md:col-start-7">
          <motion.p
            custom={0}
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            className="mb-5 font-body text-[11px] font-semibold uppercase tracking-[0.2em] text-terracotta"
          >
            Meet Your Educator
          </motion.p>

          <motion.h2
            custom={1}
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            className="font-heading text-[clamp(2rem,4.5vw,3.6rem)] leading-[1.05] tracking-tight text-white"
          >
            Eden Kassahun
          </motion.h2>

          <motion.p
            custom={2}
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            className="mt-3 font-heading text-[clamp(1rem,1.8vw,1.3rem)] font-light italic text-olive-light"
          >
            Founder &amp; Lead Educator
          </motion.p>

          <motion.div
            custom={3}
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            className="my-8 h-[1px] w-16 bg-terracotta/50"
          />

          <motion.p
            custom={3}
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            className="max-w-xl font-body text-[15px] font-light leading-[1.8] text-white/65"
          >
            As the founder and lead educator of Delta SPMU Academy, Eden guides
            students through the academy&rsquo;s signature curriculum with a deep
            passion for the craft of permanent makeup — from foundational hygiene
            and safety through advanced brow artistry and instructor-level
            training.
          </motion.p>

          {/* Focus chips */}
          <motion.div
            custom={4}
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            className="mt-9 flex flex-wrap gap-3"
          >
            {FOCUS.map((label) => (
              <span
                key={label}
                className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 font-body text-[11px] font-semibold uppercase tracking-wide text-white/55"
              >
                {label}
              </span>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
