import { useRef, useState } from "react";
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

export default function Certification() {
  const sectionRef = useRef(null);
  const cardRef = useRef(null);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [glareX, setGlareX] = useState(50);
  const [glareY, setGlareY] = useState(50);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  const imageY = useTransform(scrollYProgress, [0, 1], [40, -40]);
  const floatY = useTransform(scrollYProgress, [0, 0.5, 1], [20, -10, -30]);

  const handleMouseMove = (e) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setRotateX((y - 0.5) * -18);
    setRotateY((x - 0.5) * 18);
    setGlareX(x * 100);
    setGlareY(y * 100);
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
    setGlareX(50);
    setGlareY(50);
  };

  return (
    <section
      ref={sectionRef}
      className="relative bg-charcoal overflow-hidden py-16 sm:py-24 md:py-40"
    >
      {/* Subtle grain texture overlay */}
      <div className="absolute inset-0 opacity-[0.03] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9IjMwMCIgaGVpZ2h0PSIzMDAiIGZpbHRlcj0idXJsKCNhKSIgb3BhY2l0eT0iMSIvPjwvc3ZnPg==')]" />

      {/* Decorative accent line */}
      <motion.div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-24 bg-gradient-to-b from-transparent via-nude/40 to-transparent"
        initial={{ scaleY: 0 }}
        whileInView={{ scaleY: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94] }}
      />

      <div className="relative max-w-[1400px] mx-auto px-6 md:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          {/* Left — Text Content */}
          <div className="order-2 lg:order-1">
            <motion.p
              custom={0}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              className="font-body text-xs tracking-[0.3em] uppercase text-nude mb-6"
            >
              Credential Integrity
            </motion.p>

            <motion.h2
              custom={1}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              className="font-heading text-alabaster leading-[1.05]"
              style={{ fontSize: "clamp(2.2rem, 4.5vw, 3.8rem)" }}
            >
              Globally Verified
              <br />
              <span className="text-nude">Credentials</span>
            </motion.h2>

            <motion.div
              custom={2}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              className="w-16 h-px bg-nude/50 my-8"
            />

            <motion.p
              custom={3}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              className="font-body text-alabaster/70 text-base md:text-lg leading-relaxed max-w-xl"
            >
              A Delta SPMU Certificate is not awarded merely for attendance. It
              is a formal recognition of technical competence, hygiene
              compliance, and artistic precision. Backed by our LMS, every
              graduate's credential is securely recorded and independently
              verifiable—empowering you to pursue global opportunities.
            </motion.p>

            <motion.div
              custom={4}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              className="mt-10 flex flex-wrap gap-8"
            >
              {[
                { value: "100%", label: "Verifiable" },
                { value: "LMS", label: "Backed" },
                { value: "Global", label: "Recognition" },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="font-heading text-2xl md:text-3xl text-nude">
                    {stat.value}
                  </p>
                  <p className="font-body text-xs tracking-[0.2em] uppercase text-alabaster/40 mt-1">
                    {stat.label}
                  </p>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right — 3D Certificate Card */}
          <div className="order-1 lg:order-2 flex justify-center lg:justify-end">
            <motion.div
              custom={2}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              style={{ y: floatY, perspective: 1200 }}
              className="relative"
            >
              <div
                ref={cardRef}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                className="relative group cursor-default"
                style={{
                  transformStyle: "preserve-3d",
                  transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
                  transition: "transform 0.15s ease-out",
                }}
              >
                {/* Ambient glow */}
                <div
                  className="absolute -inset-6 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-2xl"
                  style={{
                    background:
                      "radial-gradient(ellipse at center, rgba(209,191,174,0.15), transparent 70%)",
                  }}
                />

                {/* Card frame */}
                <div className="relative rounded-xl overflow-hidden shadow-2xl shadow-black/40">
                  {/* Border accent */}
                  <div className="absolute inset-0 rounded-xl border border-nude/20 z-10 pointer-events-none" />

                  {/* Glare overlay */}
                  <div
                    className="absolute inset-0 z-20 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-xl"
                    style={{
                      background: `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.12) 0%, transparent 60%)`,
                    }}
                  />

                  {/* Certificate image */}
                  <motion.img
                    src="/images/Certificate.jpg"
                    alt="Delta SPMU Academy Certificate — globally verified credential"
                    className="w-full max-w-[480px] h-auto object-cover rounded-xl"
                    style={{ y: imageY }}
                  />

                  {/* Bottom gradient */}
                  <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-charcoal/60 to-transparent pointer-events-none" />
                </div>

                {/* Floating seal accent */}
                <motion.div
                  className="absolute -bottom-4 -right-4 w-20 h-20 rounded-full border border-nude/30 flex items-center justify-center backdrop-blur-sm bg-charcoal/60 z-30"
                  animate={{ rotate: [0, 360] }}
                  transition={{
                    duration: 30,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                >
                  <div className="w-12 h-12 rounded-full border border-nude/20 flex items-center justify-center">
                    <span className="font-heading text-nude text-xs tracking-widest">
                      Δ
                    </span>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
