import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

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

const faqs = [
  {
    id: "experience",
    question: "Do I need prior experience to enroll?",
    answer:
      "No prior cosmetic or beauty experience is required for our core brow certifications. Our curriculum is designed to take you from fundamentals through to clinical-level proficiency with structured, hands-on training.",
  },
  {
    id: "duration",
    question: "How long are the training programs?",
    answer:
      "Program duration varies by certification. Our Ombré Brows Artistry certification is an intensive, video-led course you begin online and complete with in-person practical training; other certifications add their own clinical hours and specialized modules.",
  },
  {
    id: "online",
    question: "Is there an online learning component?",
    answer:
      "Yes. Upon enrollment approval, you receive immediate access to our digital LMS platform where you complete theoretical modules before attending in-person practical sessions at our Addis Ababa campus.",
  },
  {
    id: "certification",
    question: "What certification will I receive?",
    answer:
      "Graduates receive a Delta SPMU Academy professional certification recognized within the industry. Our certification validates your competency in semi-permanent makeup techniques, safety protocols, and client consultation practices.",
  },
  {
    id: "cost",
    question: "What are the tuition fees and payment options?",
    answer:
      "Tuition varies by program level. We offer flexible payment plans and early enrollment discounts. Contact our admissions team for detailed pricing and to discuss the payment structure that works best for you.",
  },
  {
    id: "materials",
    question: "Are training materials and equipment included?",
    answer:
      "All essential training materials, practice supplies, and access to professional-grade equipment are included in your tuition. You will work with the same instruments and pigments used in professional clinical settings.",
  },
];

function FAQItem({ item, index, isOpen, onToggle }) {
  return (
    <motion.div
      custom={index + 2}
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      className={`border-b transition-colors duration-500 ${
        isOpen ? "border-white/20" : "border-white/[0.06]"
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 md:gap-6 py-7 md:py-9 text-left group cursor-pointer"
      >
        <div className="flex items-center gap-3 md:gap-8">
          <span
            className={`font-heading text-2xl md:text-3xl leading-none transition-colors duration-500 ${
              isOpen ? "text-nude" : "text-white/15"
            }`}
          >
            {String(index + 1).padStart(2, "0")}
          </span>
          <h3
            className={`font-heading text-lg md:text-xl transition-colors duration-500 ${
              isOpen ? "text-nude" : "text-white/80"
            } group-hover:text-nude`}
          >
            {item.question}
          </h3>
        </div>

        {/* Toggle icon */}
        <div className="relative w-6 h-6 shrink-0">
          <motion.span
            className="absolute top-1/2 left-0 w-full h-px bg-white/30 -translate-y-1/2"
            animate={{ rotate: isOpen ? 0 : 0 }}
          />
          <motion.span
            className="absolute top-1/2 left-0 w-full h-px bg-white/30 -translate-y-1/2"
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
            <div className="pl-[calc(1.75rem+1.25rem)] md:pl-[calc(2.25rem+2rem)] pb-8 md:pb-10 pr-4 md:pr-12">
              <p className="font-body text-sm md:text-base text-white/45 leading-relaxed max-w-xl">
                {item.answer}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function FAQ() {
  const [openId, setOpenId] = useState(faqs[0].id);

  const toggle = (id) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <section id="faq" className="relative bg-charcoal overflow-hidden py-28 md:py-40">
      {/* Subtle decorative accent */}
      <motion.div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-24 bg-gradient-to-b from-transparent via-nude/20 to-transparent"
        initial={{ scaleY: 0 }}
        whileInView={{ scaleY: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94] }}
      />

      {/* Large ghost text */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 select-none font-heading text-[clamp(6rem,18vw,16rem)] leading-none text-white/[0.02] uppercase tracking-wide"
      >
        FAQ
      </div>

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
            Common Questions
          </motion.p>

          <motion.h2
            custom={1}
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            className="font-heading text-white leading-[1.05]"
            style={{ fontSize: "clamp(2.2rem, 4.5vw, 3.8rem)" }}
          >
            Frequently Asked{" "}
            <span className="text-nude italic">Questions</span>
          </motion.h2>

          <motion.div
            custom={2}
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            className="w-16 h-px bg-nude/30 mx-auto mt-8"
          />
        </div>

        {/* FAQ Accordion */}
        <div className="border-t border-white/[0.06]">
          {faqs.map((item, index) => (
            <FAQItem
              key={item.id}
              item={item}
              index={index}
              isOpen={openId === item.id}
              onToggle={() => toggle(item.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
