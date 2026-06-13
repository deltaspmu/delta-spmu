import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import config from "../config";

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

const items = [
  {
    id: "eligibility",
    title: "Eligibility Requirements",
    content:
      "Applicants must be at least 18 years of age. No prior cosmetic experience is required for entry into our Foundation Certification program.",
  },
  {
    id: "advanced",
    title: "Advanced Program Entry",
    content:
      "Enrollment in Advanced or Master Artist programs requires demonstrated prior completion of relevant foundational training or equivalent professional clinical experience.",
  },
  {
    id: "process",
    title: "The Enrollment Process",
    content:
      "Submit your official application for review. Upon approval, you will gain immediate access to our digital LMS platform to begin your theoretical modules before attending practical sessions in Addis Ababa.",
  },
];

function AccordionItem({ item, index, isOpen, onToggle }) {
  return (
    <motion.div
      custom={index + 2}
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      className={`border-b transition-colors duration-500 ${
        isOpen ? "border-nude/60" : "border-charcoal/[0.08]"
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-6 py-7 md:py-9 text-left group cursor-pointer"
      >
        <div className="flex items-center gap-5 md:gap-8">
          <span
            className={`font-heading text-2xl md:text-3xl leading-none transition-colors duration-500 ${
              isOpen ? "text-nude" : "text-charcoal/20"
            }`}
          >
            {String(index + 1).padStart(2, "0")}
          </span>
          <h3
            className={`font-heading text-lg md:text-xl transition-colors duration-500 ${
              isOpen ? "text-nude-dark" : "text-charcoal"
            } group-hover:text-nude-dark`}
          >
            {item.title}
          </h3>
        </div>

        {/* Toggle icon */}
        <div className="relative w-6 h-6 shrink-0">
          <motion.span
            className="absolute top-1/2 left-0 w-full h-px bg-charcoal/40 -translate-y-1/2"
            animate={{ rotate: isOpen ? 0 : 0 }}
          />
          <motion.span
            className="absolute top-1/2 left-0 w-full h-px bg-charcoal/40 -translate-y-1/2"
            animate={{ rotate: isOpen ? 0 : 90 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
          />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{
              height: "auto",
              opacity: 1,
              transition: {
                height: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
                opacity: { duration: 0.4, delay: 0.15 },
              },
            }}
            exit={{
              height: 0,
              opacity: 0,
              transition: {
                height: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
                opacity: { duration: 0.2 },
              },
            }}
            className="overflow-hidden"
          >
            <div className="pl-[calc(1.25rem+1rem)] md:pl-[calc(2.25rem+2rem)] pb-8 md:pb-10 pr-2 md:pr-12">
              <p className="font-body text-sm md:text-base text-charcoal/60 leading-relaxed max-w-xl">
                {item.content}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function Admissions() {
  const [openId, setOpenId] = useState(items[0].id);

  const toggle = (id) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <section id="admissions" className="relative bg-alabaster overflow-hidden py-28 md:py-40">
      {/* Subtle decorative accent */}
      <motion.div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-24 bg-gradient-to-b from-transparent via-nude/30 to-transparent"
        initial={{ scaleY: 0 }}
        whileInView={{ scaleY: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94] }}
      />

      <div className="relative max-w-[900px] mx-auto px-6 md:px-12">
        {/* Header */}
        <div className="text-center mb-16 md:mb-24">
          <motion.p
            custom={0}
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            className="font-body text-xs tracking-[0.3em] uppercase text-nude-dark mb-6"
          >
            Begin Your Journey
          </motion.p>

          <motion.h2
            custom={1}
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            className="font-heading text-charcoal leading-[1.05]"
            style={{ fontSize: "clamp(2.2rem, 4.5vw, 3.8rem)" }}
          >
            Admissions &{" "}
            <span className="text-nude-dark">Eligibility</span>
          </motion.h2>

          <motion.div
            custom={2}
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            className="w-16 h-px bg-nude/50 mx-auto mt-8"
          />
        </div>

        {/* Accordion */}
        <div className="border-t border-charcoal/[0.08]">
          {items.map((item, index) => (
            <AccordionItem
              key={item.id}
              item={item}
              index={index}
              isOpen={openId === item.id}
              onToggle={() => toggle(item.id)}
            />
          ))}
        </div>

        {/* CTA */}
        <motion.div
          custom={5}
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          className="mt-16 md:mt-20 text-center"
        >
          <a
            href={config.studentPortalLive ? config.signupUrl : "#contact"}
            className="inline-block font-body text-xs tracking-[0.25em] uppercase px-10 py-4 border border-charcoal/15 text-charcoal hover:bg-charcoal hover:text-alabaster transition-all duration-500"
          >
            Apply Now
          </a>
        </motion.div>
      </div>
    </section>
  );
}
