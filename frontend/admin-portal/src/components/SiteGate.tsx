import { useEffect, useState, type ReactNode } from 'react';

const KONAMI = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
  'b', 'a',
];

function EasterEgg() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let buf: string[] = [];
    function onKey(e: KeyboardEvent) {
      if (!e.key) return; // autofill / IME / synthetic events can fire without a key
      buf = [...buf, e.key].slice(-KONAMI.length);
      const ok =
        buf.length === KONAMI.length &&
        buf.every((k, i) => k.toLowerCase() === KONAMI[i].toLowerCase());
      if (ok) {
        setShow((s) => !s);
        buf = [];
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!show) return null;

  return (
    <div
      onClick={() => setShow(false)}
      className="fixed inset-0 z-[99999] flex cursor-pointer items-center justify-center bg-black/85 backdrop-blur-md"
    >
      <div className="max-w-md rounded-2xl border border-[#C9A96E] bg-[#1A2F23] px-8 py-10 text-center font-mono text-[#E5D2A9] shadow-2xl">
        <pre className="m-0 text-[0.7rem] leading-tight text-[#C9A96E]">
{`  ____  _____ _   _____  _
 |  _ \\| ____| | |_   _|/ \\
 | | | |  _| | |   | | / _ \\
 | |_| | |___| |___| |/ ___ \\
 |____/|_____|_____|_/_/   \\_\\`}
        </pre>
        <p className="mt-6 text-sm">You found the egg.</p>
        <p className="mt-2 text-xs opacity-70">Brewed with caffeine in Addis Ababa.</p>
        <p className="mt-4 text-[0.65rem] opacity-50">(click anywhere to close)</p>
      </div>
    </div>
  );
}

function MaintenancePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#1A2F23] px-6 text-center text-[#E5D2A9]">
      <div className="max-w-md">
        <h1
          className="mb-4 text-5xl tracking-wide text-[#C9A96E]"
          style={{ fontFamily: '"Wensley", "Playfair Display", serif' }}
        >
          Delta SPMU
        </h1>
        <div className="mx-auto mb-6 h-px w-12 bg-[#C9A96E] opacity-50" />
        <p className="mb-3 text-lg">We'll be back soon.</p>
        <p className="text-sm leading-relaxed opacity-75">
          The admin portal is temporarily offline for maintenance. Please check
          back later or reach us at{' '}
          <a href="mailto:hello@deltaspmu.com" className="text-[#C9A96E] underline">
            hello@deltaspmu.com
          </a>
          .
        </p>
      </div>
    </div>
  );
}

export default function SiteGate({ children }: { children: ReactNode }) {
  const disabled = import.meta.env.VITE_SITE_DISABLED === 'true';

  return (
    <>
      <EasterEgg />
      {disabled ? <MaintenancePage /> : children}
    </>
  );
}
