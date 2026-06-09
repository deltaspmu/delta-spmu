import { motion } from "framer-motion";

const PILLARS = [
  {
    number: "01",
    title: "Clinical Hygiene",
    description:
      "We enforce strict, internationally recognized infection control protocols. You will be trained in proper PPE usage and single-use sterile needle handling.",
  },
  {
    number: "02",
    title: "Business Practice",
    description:
      "We teach sustainable business education. Graduate with a foundational understanding of ethical marketing, client management, and pricing strategies.",
  },
];

export default function Safety() {
  const reveal = {
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

  return (
    <section className="relative overflow-hidden bg-olive-dark py-32 md:py-44">
      <div className="mx-auto max-w-7xl px-6 lg:px-12">
        {/* Header */}
        <div className="mb-20 md:mb-28">
          <motion.p
            variants={reveal}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={0}
            className="mb-4 font-body text-[11px] font-semibold uppercase tracking-wide text-white/65"
          >
            Our Standards
          </motion.p>

          <motion.h2
            variants={reveal}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={1}
            className="max-w-lg font-heading text-[clamp(1.8rem,3.8vw,3rem)] leading-[1.12] tracking-tight text-white"
          >
            Zero Compromise on{" "}
            <br className="hidden md:block" />
            Safety <span className="italic">&</span> Success
          </motion.h2>
        </div>

        {/* Pillars */}
        <div className="grid gap-0 md:grid-cols-2">
          {PILLARS.map((pillar, i) => (
            <motion.div
              key={pillar.number}
              variants={reveal}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "0px 0px -60px 0px" }}
              custom={i + 1}
              className={`relative py-14 md:py-20 ${
                i === 0
                  ? "border-b border-white/15 md:border-b-0 md:border-r md:pr-16 lg:pr-24"
                  : "md:pl-16 lg:pl-24"
              }`}
            >
              {/* Giant background number */}
              <span className="pointer-events-none absolute -top-4 right-4 select-none font-heading text-[clamp(8rem,18vw,14rem)] leading-none text-white/[0.07] md:-top-8">
                {pillar.number}
              </span>

              {/* Content */}
              <div className="relative">
                <div className="mb-8 flex items-center gap-4">
                  <span className="font-body text-[12px] font-semibold uppercase tracking-wide text-white/55">
                    {pillar.number}
                  </span>
                  <div className="h-[1px] w-10 bg-white/25" />
                </div>

                <h3 className="font-heading text-[clamp(1.6rem,2.8vw,2.4rem)] leading-[1.1] tracking-tight text-white">
                  {pillar.title}
                </h3>

                <p className="mt-5 max-w-sm font-body text-[15px] font-light leading-[1.75] text-white/75">
                  {pillar.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
