import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

const STEPS = [
  {
    number: "01",
    title: "eLearning (Theory)",
    description:
      "Master the fundamentals—skin anatomy, color theory, infection control, and client consultation—through our structured online Learning Management System (LMS) at your own pace.",
    accent: "from-nude/20 to-transparent",
  },
  {
    number: "02",
    title: "Practical Training",
    description:
      "Transition to our Addis Ababa facility for hands-on instruction. Practice on artificial skin before moving to supervised live-model procedures.",
    accent: "from-charcoal/5 to-transparent",
  },
  {
    number: "03",
    title: "Certification",
    description:
      "Build your professional portfolio and demonstrate competency to earn your globally recognized Delta SPMU Certification.",
    accent: "from-nude/20 to-transparent",
  },
];

function StepCard({ step }) {
  const cardRef = useRef(null);

  const reveal = {
    hidden: { opacity: 0, y: 50 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        ease: [0.25, 0.46, 0.45, 0.94],
      },
    },
  };

  return (
    <motion.div
      ref={cardRef}
      variants={reveal}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.4 }}
      className="group relative"
    >
      <div className={`relative overflow-hidden border border-charcoal/[0.06] bg-gradient-to-br ${step.accent} p-10 transition-all duration-500 hover:border-nude/50 md:p-14`}>
        {/* Large background number */}
        <span className="absolute -right-3 -top-6 font-heading text-[8rem] leading-none text-charcoal/[0.03] transition-colors duration-500 group-hover:text-nude/10 md:text-[10rem]">
          {step.number}
        </span>

        {/* Step number */}
        <div className="mb-8 flex items-center gap-4">
          <span className="font-body text-[12px] font-semibold uppercase tracking-wide text-nude-dark">
            Step {step.number}
          </span>
          <div className="h-[1px] w-8 bg-nude" />
        </div>

        {/* Title */}
        <h3 className="font-heading text-[clamp(1.5rem,2.5vw,2.2rem)] leading-[1.15] tracking-tight text-charcoal">
          {step.title}
        </h3>

        {/* Description */}
        <p className="mt-5 max-w-lg font-body text-[15px] font-light leading-[1.75] text-charcoal/60">
          {step.description}
        </p>

        {/* Bottom accent line */}
        <div className="mt-10 h-[1px] w-0 bg-nude transition-all duration-700 group-hover:w-full" />
      </div>
    </motion.div>
  );
}

export default function HowItWorks() {
  const sectionRef = useRef(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  /* Vertical progress line in the sticky column */
  const lineHeight = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <section
      ref={sectionRef}
      className="relative bg-alabaster"
    >
      {/* Top divider */}
      <div className="mx-auto max-w-7xl px-6 lg:px-12">
        <div className="h-[1px] w-full bg-charcoal/[0.06]" />
      </div>

      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-28 md:grid-cols-12 md:gap-8 md:py-40 lg:px-12">
        {/* ── Sticky Left Column ── */}
        <div className="md:col-span-5 lg:col-span-4">
          <div className="md:sticky md:top-32">
            {/* Overline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="mb-4 font-body text-[11px] font-semibold uppercase tracking-wide text-nude-dark"
            >
              How It Works
            </motion.p>

            {/* Heading */}
            <motion.h2
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.8,
                ease: [0.25, 0.46, 0.45, 0.94],
                delay: 0.1,
              }}
              className="font-heading text-[clamp(1.8rem,3.8vw,3rem)] leading-[1.12] tracking-tight text-charcoal"
            >
              Flexible Online Theory.
              <br />
              <span className="italic text-nude-dark">Rigorous</span>{" "}
              In-Person Practice.
            </motion.h2>

            {/* Progress line — desktop only */}
            <div className="relative mt-12 hidden h-48 w-[1px] bg-charcoal/[0.06] md:block">
              <motion.div
                className="absolute left-0 top-0 w-full origin-top bg-nude"
                style={{ height: lineHeight }}
              />
            </div>
          </div>
        </div>

        {/* ── Scrolling Right Column ── */}
        <div className="flex flex-col gap-8 md:col-span-7 lg:col-start-6">
          {STEPS.map((step) => (
            <StepCard key={step.number} step={step} />
          ))}
        </div>
      </div>
    </section>
  );
}
