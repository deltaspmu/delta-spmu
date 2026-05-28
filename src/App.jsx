/* ── UI chrome ── */
import NoiseOverlay from "./components/ui/NoiseOverlay";
import SmoothScroll from "./components/ui/SmoothScroll";
import CustomCursor from "./components/ui/CustomCursor";
import SiteGate from "./components/SiteGate";

/* ── Sections ── */
import Hero from "./components/Hero";
import About from "./components/About";
import BusinessEdge from "./components/BusinessEdge";
import HowItWorks from "./components/HowItWorks";
import Programs from "./components/Programs";
import Certification from "./components/Certification";
import Safety from "./components/Safety";
import Admissions from "./components/Admissions";
import FAQ from "./components/FAQ";
import Contact from "./components/Contact";
import FooterCTA from "./components/FooterCTA";

function App() {
  return (
    <SiteGate>
      {/* ── Persistent overlays ── */}
      <NoiseOverlay />
      <CustomCursor />

      {/* ── Main content ── */}
      <SmoothScroll>
        <main>
          <Hero />
          <About />
          <BusinessEdge />
          <HowItWorks />
          <Programs />
          <Certification />
          <Safety />
          <Admissions />
          <FAQ />
          <Contact />
          <FooterCTA />
        </main>
      </SmoothScroll>
    </SiteGate>
  );
}

export default App;
