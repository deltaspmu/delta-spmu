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
      delay: i * 0.15,
    },
  }),
};

const pillars = [
  {
    number: "01",
    title: "Client Psychology",
    description:
      "Master the art of understanding client desires, managing expectations, and building trust through ethical consultation.",
  },
  {
    number: "02",
    title: "Premium Positioning",
    description:
      "Implement value-based pricing strategies that reflect your expertise and attract discerning clientele.",
  },
  {
    number: "03",
    title: "Ethical Marketing",
    description:
      "Build a sustainable, high-income practice through transparent marketing that elevates the industry standard.",
  },
];

export default function BusinessEdge() {
  const sectionRef = useRef(null);
  const imageRef = useRef(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  const imageScale = useTransform(scrollYProgress, [0, 0.5], [1.15, 1]);
  const imageClip = useTransform(scrollYProgress, [0.05, 0.4], [100, 0]);
  const textY = useTransform(scrollYProgress, [0, 1], [80, -40]);

  return (
    <section
      ref={sectionRef}
      className="relative bg-alabaster overflow-hidden"
    >
      {/* Editorial oversized background text */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
        <motion.span
          className="font-heading text-charcoal/[0.03] whitespace-nowrap leading-none"
          style={{
            fontSize: "clamp(8rem, 20vw, 22rem)",
            y: textY,
          }}
        >
          MASTERY
        </motion.span>
      </div>

      <div className="relative max-w-[1400px] mx-auto">
        {/* Top editorial heading — full-width dramatic type */}
        <div className="px-6 md:px-12 pt-28 md:pt-40 pb-16 md:pb-24">
          <motion.p
            custom={0}
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            className="font-body text-xs tracking-[0.3em] uppercase text-nude-dark mb-6"
          >
            Business Education
          </motion.p>

          <motion.h2
            custom={1}
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            className="font-heading text-charcoal leading-[0.95] max-w-5xl"
            style={{ fontSize: "clamp(2.4rem, 5.5vw, 5rem)" }}
          >
            Mastery Beyond
            <br />
            <span className="text-nude-dark">the Needle</span>
          </motion.h2>
        </div>

        {/* Split editorial layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
          {/* Left — Image reveal */}
          <div className="relative h-[50vh] md:h-[75vh] lg:h-auto overflow-hidden">
            <motion.div
              ref={imageRef}
              className="absolute inset-0"
              style={{
                scale: imageScale,
                clipPath: imageClip.get
                  ? undefined
                  : "inset(0% 0 0 0)",
              }}
            >
              <motion.div
                className="absolute inset-0"
                initial={{ clipPath: "inset(100% 0 0 0)" }}
                whileInView={{ clipPath: "inset(0% 0 0 0)" }}
                viewport={{ once: true, amount: 0.1 }}
                transition={{
                  duration: 1.4,
                  ease: [0.65, 0, 0.35, 1],
                }}
              >
                <motion.img
                  src="/images/business.jpg"
                  alt="Business education and ethical practice at Delta SPMU Academy"
                  className="w-full h-full object-cover"
                  style={{ scale: imageScale }}
                />
              </motion.div>
            </motion.div>

            {/* Image overlay gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-alabaster/20 pointer-events-none" />
            <div className="absolute bottom-0 left-0 right-0 h-1/4 bg-gradient-to-t from-alabaster/30 to-transparent pointer-events-none lg:hidden" />
          </div>

          {/* Right — Text + Pillars */}
          <div className="px-6 md:px-12 lg:px-16 py-16 md:py-24 flex flex-col justify-center">
            <motion.p
              custom={0}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              className="font-body text-charcoal/70 text-base md:text-lg leading-relaxed max-w-lg mb-14"
            >
              Technical skill is only half the equation. Our curriculum
              integrates client psychology, ethical consultation practices, and
              sustainable business education. Learn to manage client
              expectations, implement premium pricing, and execute ethical
              marketing to build a high-income aesthetic practice.
            </motion.p>

            {/* Pillar cards — editorial numbered list */}
            <div className="space-y-0">
              {pillars.map((pillar, i) => (
                <motion.div
                  key={pillar.number}
                  custom={i + 1}
                  variants={fadeUp}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.3 }}
                  className="group border-t border-charcoal/[0.08] py-8 flex gap-6 items-start"
                >
                  <span className="font-heading text-nude text-3xl md:text-4xl leading-none mt-1 shrink-0">
                    {pillar.number}
                  </span>
                  <div>
                    <h3 className="font-heading text-charcoal text-lg md:text-xl mb-2 group-hover:text-nude-dark transition-colors duration-300">
                      {pillar.title}
                    </h3>
                    <p className="font-body text-sm md:text-base text-charcoal/55 leading-relaxed max-w-md">
                      {pillar.description}
                    </p>
                  </div>
                </motion.div>
              ))}
              {/* Bottom border for last item */}
              <div className="border-t border-charcoal/[0.08]" />
            </div>
          </div>
        </div>

        {/* Bottom spacing */}
        <div className="h-20 md:h-32" />
      </div>
    </section>
  );
}
