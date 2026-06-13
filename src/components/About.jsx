import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

export default function About() {
  const sectionRef = useRef(null);
  const imageRef = useRef(null);

  /* parallax on the image */
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const imageY = useTransform(scrollYProgress, [0, 1], [60, -60]);

  /* shared reveal variant */
  const reveal = {
    hidden: { opacity: 0, y: 40 },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.9,
        ease: [0.25, 0.46, 0.45, 0.94],
        delay: i * 0.12,
      },
    }),
  };

  return (
    <section
      id="about"
      ref={sectionRef}
      className="relative overflow-hidden bg-alabaster py-28 md:py-40"
    >
      {/* subtle top border accent */}
      <div className="absolute left-1/2 top-0 h-[1px] w-24 -translate-x-1/2 bg-nude/60" />

      <div className="mx-auto grid max-w-7xl gap-16 px-6 md:grid-cols-12 md:gap-8 lg:px-12">
        {/* ── Text Column ── */}
        <div className="flex flex-col justify-center md:col-span-5">
          {/* Overline */}
          <motion.p
            variants={reveal}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            custom={0}
            className="mb-4 font-body text-[11px] font-semibold uppercase tracking-wide text-nude-dark"
          >
            About the Academy
          </motion.p>

          {/* Heading */}
          <motion.h2
            variants={reveal}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            custom={1}
            className="font-heading text-[clamp(1.8rem,3.8vw,3rem)] leading-[1.12] tracking-tight text-charcoal"
          >
            Empowering Artists
            <br />
            Through{" "}
            <span className="italic text-nude-dark">Sacred</span>{" "}
            Transformation
          </motion.h2>

          {/* Divider */}
          <motion.div
            variants={reveal}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            custom={2}
            className="my-8 h-[1px] w-16 bg-charcoal/15"
          />

          {/* Paragraph 1 */}
          <motion.p
            variants={reveal}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            custom={2}
            className="font-body text-[15px] font-light leading-[1.75] text-charcoal/70"
          >
            Based in Addis Ababa, Ethiopia, Delta SPMU is an outcome-based
            professional training academy specializing in advanced brow
            techniques—including ombré, powder, combo, and nano brows.
          </motion.p>

          {/* Paragraph 2 */}
          <motion.p
            variants={reveal}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            custom={3}
            className="mt-5 font-body text-[15px] font-light leading-[1.75] text-charcoal/70"
          >
            Led by experienced practitioners, we prioritize safety, technical
            mastery, client psychology, and sustainable business education to
            ensure our graduates are prepared for global practice.
          </motion.p>

          {/* Stats row */}
          <motion.div
            variants={reveal}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            custom={4}
            className="mt-10 flex gap-12"
          >
            {[
              { value: "500+", label: "Graduates" },
              { value: "4", label: "Programs" },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="font-heading text-3xl tracking-tight text-charcoal">
                  {stat.value}
                </p>
                <p className="mt-1 font-body text-[11px] font-semibold uppercase tracking-wide text-charcoal/40">
                  {stat.label}
                </p>
              </div>
            ))}
          </motion.div>
        </div>

        {/* ── Image Column ── */}
        <div className="relative md:col-span-7 md:col-start-6">
          {/* Image wrapper with clip-path mask reveal */}
          <motion.div
            initial={{ clipPath: "inset(100% 0 0 0)" }}
            whileInView={{ clipPath: "inset(0% 0 0 0)" }}
            viewport={{ once: true, margin: "0px 0px -100px 0px" }}
            transition={{ duration: 1.2, ease: [0.65, 0, 0.35, 1] }}
            className="relative aspect-[4/5] w-full overflow-hidden md:aspect-[3/4]"
          >
            <motion.img
              ref={imageRef}
              src="/images/about-image.jpg"
              alt="Delta SPMU Academy training session"
              className="absolute inset-0 h-full w-full object-cover"
              style={{ y: imageY }}
            />

            {/* Warm overlay tint */}
            <div className="absolute inset-0 bg-gradient-to-t from-charcoal/20 via-transparent to-transparent" />
          </motion.div>

          {/* Decorative offset frame */}
          <div className="absolute -bottom-4 -right-4 -z-10 hidden h-full w-full border border-nude/40 md:block" />
        </div>
      </div>
    </section>
  );
}
