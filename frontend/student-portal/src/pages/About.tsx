import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  BookOpen,
  Heart,
  Shield,
  Target,
  Users,
  ChevronRight,
} from 'lucide-react';

export default function About() {

  useEffect(() => {
    document.title = 'About — Delta SPMU Academy';
  }, []);

  return (
    <div className="min-h-screen bg-alabaster">
      {/* Header */}
      <div className="bg-dark text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="font-heading text-3xl sm:text-4xl font-bold mb-2">
            About Delta SPMU Academy
          </h1>
          <p className="text-gray-300 text-lg">
            Empowering the next generation of permanent makeup artists
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="bg-white rounded-xl shadow-sm p-8 prose prose-gray max-w-none">
          {/* Our Story */}
          <section className="mb-10">
            <h2 className="font-heading text-2xl font-bold text-dark mb-4">
              Our Story
            </h2>
            <p className="text-dark/70 leading-relaxed">
              Delta SPMU is a professional training academy specializing in
              permanent makeup and cosmetic tattooing education, based in Addis
              Ababa, Ethiopia. We were founded with a clear vision: to bring
              world-class SPMU education to East Africa and empower artists with
              the skills, confidence, and business knowledge they need to thrive
              in this growing industry.
            </p>
          </section>

          {/* Our Mission */}
          <section className="mb-10">
            <h2 className="font-heading text-2xl font-bold text-dark mb-4">
              Our Mission
            </h2>
            <div className="flex items-start gap-4 bg-primary/5 rounded-lg p-6">
              <Target className="w-8 h-8 text-primary flex-shrink-0 mt-1" />
              <p className="text-dark/70 leading-relaxed m-0">
                To develop skilled permanent makeup artists through hands-on
                training, live model practice, and rigorous assessment. We
                believe that excellence in SPMU requires a combination of
                artistic talent, technical precision, and deep understanding of
                client psychology.
              </p>
            </div>
          </section>

          {/* What We Offer */}
          <section className="mb-10">
            <h2 className="font-heading text-2xl font-bold text-dark mb-4">
              What We Offer
            </h2>
            <p className="text-dark/70 leading-relaxed mb-6">
              Our certificate programs cover the most in-demand semi-permanent
              makeup and beauty specialisms &mdash; each blending online theory
              with in-person practical training:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {
                  icon: BookOpen,
                  title: 'Ombré Brows Artistry',
                  desc: 'Soft, gradient ombré brows — from skin science and brow mapping to a full live procedure.',
                },
                {
                  icon: Award,
                  title: 'Bridal Makeup Artistry',
                  desc: 'Camera-ready bridal looks, consultation and trials, and the business of bridal beauty.',
                },
                {
                  icon: Users,
                  title: 'Nano Brows Artistry',
                  desc: 'Ultra-fine machine hairstrokes that mimic natural brow hair. (Coming soon)',
                },
                {
                  icon: Shield,
                  title: 'Lip Blush & Lip Neutralization',
                  desc: 'Natural lip-colour enhancement and correction of dark or cool lips. (Coming soon)',
                },
              ].map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className="border border-gray-100 rounded-lg p-5 hover:shadow-sm transition-shadow"
                >
                  <Icon className="w-6 h-6 text-primary mb-3" />
                  <h3 className="font-heading font-semibold text-dark text-base mb-1">
                    {title}
                  </h3>
                  <p className="text-sm text-dark/60 m-0">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Our Approach */}
          <section className="mb-10">
            <h2 className="font-heading text-2xl font-bold text-dark mb-4">
              Our Approach
            </h2>
            <p className="text-dark/70 leading-relaxed">
              We use a blended learning model that combines online theory modules
              with in-person practical training. Students complete foundational
              coursework at their own pace through our digital platform, then
              attend intensive hands-on workshops at our Addis Ababa training
              center. This approach ensures thorough understanding of theory
              before moving to live model work, maximizing both safety and skill
              development.
            </p>
          </section>

          {/* Values */}
          <section className="mb-10">
            <h2 className="font-heading text-2xl font-bold text-dark mb-4">
              Our Values
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {
                  icon: Shield,
                  title: 'Safety',
                  desc: 'Rigorous hygiene protocols and client safety are non-negotiable in every procedure.',
                },
                {
                  icon: Target,
                  title: 'Technical Mastery',
                  desc: 'Precision and consistency achieved through deliberate practice and expert mentorship.',
                },
                {
                  icon: Heart,
                  title: 'Client Psychology',
                  desc: 'Understanding client expectations, communication, and building lasting trust.',
                },
                {
                  icon: BookOpen,
                  title: 'Sustainable Business Education',
                  desc: 'Equipping artists to build profitable, ethical practices after certification.',
                },
              ].map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg"
                >
                  <Icon className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-heading font-semibold text-dark text-sm mb-1">
                      {title}
                    </h3>
                    <p className="text-sm text-dark/60 m-0">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* CTA */}
          <section className="text-center bg-dark rounded-lg p-8">
            <h2 className="font-heading text-2xl font-bold text-white mb-3">
              Ready to start your journey?
            </h2>
            <p className="text-white/60 mb-6">
              Explore our courses and take the first step toward becoming a
              certified permanent makeup artist.
            </p>
            <Link
              to="/courses"
              className="inline-flex items-center gap-2 bg-primary text-dark font-medium px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors"
            >
              Browse Courses
              <ChevronRight className="w-4 h-4" />
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
