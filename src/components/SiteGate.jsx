import { useEffect, useState } from "react";

const KONAMI = [
  "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
  "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight",
  "b", "a",
];

function EasterEgg() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let buf = [];
    function onKey(e) {
      buf = [...buf, e.key].slice(-KONAMI.length);
      const ok = buf.length === KONAMI.length &&
        buf.every((k, i) => k.toLowerCase() === KONAMI[i].toLowerCase());
      if (ok) {
        setShow((s) => !s);
        buf = [];
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!show) return null;

  return (
    <div
      onClick={() => setShow(false)}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(8px)",
        cursor: "pointer",
      }}
    >
      <div
        style={{
          maxWidth: "32rem",
          padding: "2.5rem 2rem",
          borderRadius: "1rem",
          background: "#1A2F23",
          border: "1px solid #C9A96E",
          color: "#E5D2A9",
          textAlign: "center",
          fontFamily: "monospace",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
        }}
      >
        <pre style={{ color: "#C9A96E", fontSize: "0.75rem", lineHeight: 1.2, margin: 0 }}>
{`  ____  _____ _   _____  _
 |  _ \\| ____| | |_   _|/ \\
 | | | |  _| | |   | | / _ \\
 | |_| | |___| |___| |/ ___ \\
 |____/|_____|_____|_/_/   \\_\\`}
        </pre>
        <p style={{ marginTop: "1.5rem", fontSize: "0.9rem" }}>
          You found the egg.
        </p>
        <p style={{ marginTop: "0.5rem", fontSize: "0.75rem", opacity: 0.7 }}>
          Brewed with caffeine in Addis Ababa.
        </p>
        <p style={{ marginTop: "1rem", fontSize: "0.65rem", opacity: 0.5 }}>
          (click anywhere to close)
        </p>
      </div>
    </div>
  );
}

function MaintenancePage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        background: "#1A2F23",
        color: "#E5D2A9",
        textAlign: "center",
        fontFamily: '"Visia Pro", Inter, system-ui, sans-serif',
      }}
    >
      <div style={{ maxWidth: "32rem" }}>
        <h1
          style={{
            fontFamily: '"Wensley", "Playfair Display", serif',
            fontSize: "3rem",
            color: "#C9A96E",
            marginBottom: "1rem",
            letterSpacing: "0.02em",
          }}
        >
          Delta SPMU
        </h1>
        <div
          style={{
            width: "3rem",
            height: "1px",
            background: "#C9A96E",
            margin: "0 auto 1.5rem",
            opacity: 0.5,
          }}
        />
        <p style={{ fontSize: "1.125rem", marginBottom: "0.75rem" }}>
          We'll be back soon.
        </p>
        <p style={{ fontSize: "0.875rem", opacity: 0.75, lineHeight: 1.6 }}>
          The site is temporarily offline for maintenance. Please check back later
          or reach us at{" "}
          <a
            href="mailto:hello@deltaspmu.com"
            style={{ color: "#C9A96E", textDecoration: "underline" }}
          >
            hello@deltaspmu.com
          </a>
          .
        </p>
      </div>
    </div>
  );
}

export default function SiteGate({ children }) {
  const disabled = import.meta.env.VITE_SITE_DISABLED === "true";

  return (
    <>
      <EasterEgg />
      {disabled ? <MaintenancePage /> : children}
    </>
  );
}
