import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight } from "lucide-react";

const PROGRAMS = [
  {
    number: "01",
    title: "Foundation Certification",
    description:
      "No prior experience required. Learn the core scientific and technical basics: infection control, brow mapping, safe machine handling, and simulated practice.",
  },
  {
    number: "02",
    title: "Advanced Certification",
    description:
      "Deepen your artistry. Master specialized techniques like nano hairstrokes, shading gradients, and complex case management.",
  },
  {
    number: "03",
    title: "Master Artist Program",
    description:
      "The highest level. Refine precision, tackle severe asymmetry, and develop industry leadership.",
  },
  {
    number: "04",
    title: "Instructor Licensing",
    description:
      "Cultivate your skills to become an educator. Learn to train the next generation of artists.",
  },
  {
    number: "05",
    title: "Professional Bridal Makeup",
    description:
      "Master long-lasting, camera-ready bridal artistry: skin prep, flawless base, sculpting, eyes and brows, client consultation, and the business of bridal beauty.",
  },
];

function ProgramCard({ program, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -60px 0px" }}
      transition={{
        duration: 0.7,
        ease: [0.25, 0.46, 0.45, 0.94],
        delay: index * 0.1,
      }}
      className="h-full"
    >
      <motion.div
        whileHover={{ scale: 1.015 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="group relative flex h-full flex-col justify-between overflow-hidden bg-charcoal p-8 transition-all duration-500 hover:shadow-[inset_0_0_60px_rgba(209,191,174,0.05),0_25px_80px_rgba(0,0,0,0.25)] md:p-10 lg:p-12"
      >
        {/* Hover border reveal — all four sides */}
        <div className="pointer-events-none absolute inset-0 border border-transparent transition-colors duration-700 group-hover:border-nude/20" />
        {/* Top accent line */}
        <div className="absolute left-0 top-0 h-[1.5px] w-0 bg-gradient-to-r from-nude via-nude-dark to-transparent transition-all duration-700 ease-out group-hover:w-full" />

        <div>
          {/* Number badge */}
          <div className="mb-10 flex items-center gap-4">
            <span className="flex h-8 w-8 items-center justify-center border border-white/[0.08] font-body text-[11px] font-semibold text-nude/70 transition-colors duration-500 group-hover:border-nude/30 group-hover:text-nude">
              {program.number}
            </span>
            <div className="h-[1px] w-0 bg-nude/30 transition-all duration-700 group-hover:w-12" />
          </div>

          {/* Title */}
          <h3 className="font-heading text-[clamp(1.5rem,2.5vw,2rem)] leading-[1.1] tracking-tight text-white">
            {program.title}
          </h3>

          {/* Description */}
          <p className="mt-5 font-body text-[14px] font-light leading-[1.75] text-white/40 transition-colors duration-500 group-hover:text-white/60">
            {program.description}
          </p>
        </div>

        {/* Bottom CTA */}
        <div className="mt-10 flex items-center gap-3 border-t border-white/[0.05] pt-6 transition-colors duration-500 group-hover:border-nude/15">
          <span className="font-body text-[11px] font-semibold uppercase tracking-wide text-white/30 transition-colors duration-300 group-hover:text-nude">
            Learn More
          </span>
          <ArrowRight className="h-3.5 w-3.5 text-white/30 transition-all duration-300 group-hover:translate-x-2 group-hover:text-nude" />
        </div>

        {/* Ghost number */}
        <span className="pointer-events-none absolute -bottom-6 -right-3 select-none font-heading text-[8rem] leading-none text-white/[0.015] transition-colors duration-700 group-hover:text-nude/[0.04] lg:text-[10rem]">
          {program.number}
        </span>
      </motion.div>
    </motion.div>
  );
}

function ImageTile() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "-12%"]);
  const imageScale = useTransform(scrollYProgress, [0, 0.5, 1], [1.15, 1.05, 1]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, clipPath: "inset(8% 8% 8% 8%)" }}
      whileInView={{ opacity: 1, clipPath: "inset(0% 0% 0% 0%)" }}
      viewport={{ once: true, margin: "0px 0px -60px 0px" }}
      transition={{ duration: 1.4, ease: [0.65, 0, 0.35, 1] }}
      className="relative h-full min-h-[400px] overflow-hidden md:min-h-0"
    >
      <motion.img
        src="/images/Academic programs.jpg"
        alt="Delta SPMU Academy student practicing brow techniques"
        className="absolute inset-0 h-full w-full object-cover"
        style={{ y: imageY, scale: imageScale }}
      />

      {/* Cinematic overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-charcoal/60 via-charcoal/5 to-charcoal/20" />
      <div className="absolute inset-0 bg-nude/[0.04] mix-blend-multiply" />

      {/* Bottom caption */}
      <div className="absolute bottom-0 left-0 right-0 p-8 md:p-10">
        <div className="mb-3 h-[1px] w-10 bg-white/20" />
        <p className="font-body text-[10px] font-semibold uppercase tracking-widest text-white/50">
          Addis Ababa Campus
        </p>
        <p className="mt-1.5 font-heading text-xl leading-tight text-white/90">
          Where precision meets artistry
        </p>
      </div>
    </motion.div>
  );
}

export default function Programs() {
  return (
    <section id="programs" className="relative bg-charcoal py-20 sm:py-28 md:py-40">
      <div className="mx-auto max-w-7xl px-6 lg:px-12">
        {/* Section header */}
        <div className="mb-20 flex flex-col items-start justify-between gap-8 md:mb-28 md:flex-row md:items-end">
          <div>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="mb-4 font-body text-[11px] font-semibold uppercase tracking-wide text-nude/60"
            >
              Academic Programs
            </motion.p>

            <motion.h2
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.8,
                ease: [0.25, 0.46, 0.45, 0.94],
                delay: 0.1,
              }}
              className="max-w-xl font-heading text-[clamp(1.8rem,3.8vw,3rem)] leading-[1.12] tracking-tight text-white"
            >
              Progressive Training for{" "}
              <span className="italic text-nude">Every Stage</span>{" "}
              of Your Career
            </motion.h2>
          </div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="max-w-xs font-body text-[13px] font-light leading-relaxed text-white/35"
          >
            Five professional certifications spanning permanent makeup and bridal artistry — from fundamentals to mastery.
          </motion.p>
        </div>

        {/* ── Grid — 5 program cards + 1 image tile in a 3×2 layout ──
             Desktop:
             ┌──────────┬──────────┬──────────┐
             │ Card 01  │ Card 02  │ Card 03  │
             ├──────────┼──────────┼──────────┤
             │ Card 04  │ Card 05  │  IMAGE   │
             └──────────┴──────────┴──────────┘
        */}
        <div className="grid gap-2 md:grid-cols-12 md:auto-rows-[minmax(320px,1fr)]">
          {/* Row 1 */}
          <div className="md:col-span-4">
            <ProgramCard program={PROGRAMS[0]} index={0} />
          </div>
          <div className="md:col-span-4">
            <ProgramCard program={PROGRAMS[1]} index={1} />
          </div>
          <div className="md:col-span-4">
            <ProgramCard program={PROGRAMS[2]} index={2} />
          </div>

          {/* Row 2 */}
          <div className="md:col-span-4">
            <ProgramCard program={PROGRAMS[3]} index={3} />
          </div>
          <div className="md:col-span-4">
            <ProgramCard program={PROGRAMS[4]} index={4} />
          </div>
          <div className="md:col-span-4">
            <ImageTile />
          </div>
        </div>
      </div>
    </section>
  );
}
