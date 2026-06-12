import { useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Phone, Mail, Clock, Send } from "lucide-react";

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

const contactInfo = [
  {
    icon: MapPin,
    label: "Visit Us",
    value: "Bole, Redwan Bldg, 4th Floor",
    detail: "Near Eden Mall, Addis Ababa",
  },
  {
    icon: Phone,
    label: "Call Us",
    value: "+251 951 777 888",
    detail: "Mon - Sat, 9:00 AM - 6:00 PM",
  },
  {
    icon: Mail,
    label: "Email Us",
    value: "deltaspmu@gmail.com",
    detail: "We respond within 24 hours",
  },
  {
    icon: Clock,
    label: "Office Hours",
    value: "Mon - Sat: 9 AM - 6 PM",
    detail: "Sunday: Closed",
  },
];

export default function Contact() {
  const [formState, setFormState] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    setFormState((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 4000);
    setFormState({ name: "", email: "", phone: "", subject: "", message: "" });
  };

  const inputClasses =
    "w-full bg-transparent border-b border-charcoal/10 py-3 font-body text-sm text-charcoal placeholder:text-charcoal/30 focus:border-nude-dark focus:outline-none transition-colors duration-500";

  return (
    <section id="contact" className="relative bg-alabaster overflow-hidden py-28 md:py-40">
      {/* Subtle decorative accent */}
      <motion.div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-24 bg-gradient-to-b from-transparent via-nude/30 to-transparent"
        initial={{ scaleY: 0 }}
        whileInView={{ scaleY: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94] }}
      />

      <div className="relative max-w-7xl mx-auto px-6 md:px-12">
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
            Get in Touch
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
            Contact <span className="text-nude-dark">Us</span>
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

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-20">
          {/* Left — Contact Info */}
          <div className="lg:col-span-5">
            <motion.p
              custom={2}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              className="font-body text-[15px] font-light leading-[1.75] text-charcoal/60 mb-12"
            >
              Have questions about our programs, admissions, or anything else?
              We would love to hear from you. Reach out and our team will get
              back to you promptly.
            </motion.p>

            <div className="space-y-8">
              {contactInfo.map((item, index) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.label}
                    custom={index + 3}
                    variants={fadeUp}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.3 }}
                    className="group flex items-start gap-5"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center border border-charcoal/[0.08] transition-colors duration-500 group-hover:border-nude/50 group-hover:bg-nude/5">
                      <Icon className="h-[18px] w-[18px] text-nude-dark" strokeWidth={1.5} />
                    </div>
                    <div>
                      <p className="font-body text-[11px] font-semibold uppercase tracking-[0.2em] text-charcoal/40 mb-1">
                        {item.label}
                      </p>
                      <p className="font-heading text-base text-charcoal">
                        {item.value}
                      </p>
                      <p className="font-body text-[13px] font-light text-charcoal/40 mt-0.5">
                        {item.detail}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Right — Contact Form */}
          <div className="lg:col-span-7">
            <motion.form
              custom={3}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              onSubmit={handleSubmit}
              className="relative"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <div>
                  <label
                    htmlFor="contact-name"
                    className="block font-body text-[11px] font-semibold uppercase tracking-[0.2em] text-charcoal/40 mb-2"
                  >
                    Full Name
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    name="name"
                    value={formState.name}
                    onChange={handleChange}
                    placeholder="Your full name"
                    required
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label
                    htmlFor="contact-email"
                    className="block font-body text-[11px] font-semibold uppercase tracking-[0.2em] text-charcoal/40 mb-2"
                  >
                    Email Address
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    name="email"
                    value={formState.email}
                    onChange={handleChange}
                    placeholder="your@email.com"
                    required
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label
                    htmlFor="contact-phone"
                    className="block font-body text-[11px] font-semibold uppercase tracking-[0.2em] text-charcoal/40 mb-2"
                  >
                    Phone Number
                  </label>
                  <input
                    id="contact-phone"
                    type="tel"
                    name="phone"
                    value={formState.phone}
                    onChange={handleChange}
                    placeholder="+251 ..."
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label
                    htmlFor="contact-subject"
                    className="block font-body text-[11px] font-semibold uppercase tracking-[0.2em] text-charcoal/40 mb-2"
                  >
                    Subject
                  </label>
                  <input
                    id="contact-subject"
                    type="text"
                    name="subject"
                    value={formState.subject}
                    onChange={handleChange}
                    placeholder="How can we help?"
                    required
                    className={inputClasses}
                  />
                </div>
              </div>

              <div className="mt-8">
                <label
                  htmlFor="contact-message"
                  className="block font-body text-[11px] font-semibold uppercase tracking-[0.2em] text-charcoal/40 mb-2"
                >
                  Message
                </label>
                <textarea
                  id="contact-message"
                  name="message"
                  value={formState.message}
                  onChange={handleChange}
                  placeholder="Tell us more about your inquiry..."
                  required
                  rows={5}
                  className={`${inputClasses} resize-none`}
                />
              </div>

              <div className="mt-10 flex items-center gap-6">
                <button
                  type="submit"
                  className="group inline-flex items-center gap-3 bg-charcoal px-10 py-4 font-body text-[13px] font-semibold uppercase tracking-wide text-alabaster transition-all duration-300 hover:bg-nude-dark hover:text-white"
                >
                  Send Message
                  <Send className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" strokeWidth={1.5} />
                </button>

                {submitted && (
                  <motion.p
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="font-body text-sm text-nude-dark"
                  >
                    Thank you! We'll be in touch soon.
                  </motion.p>
                )}
              </div>
            </motion.form>
          </div>
        </div>
      </div>
    </section>
  );
}
