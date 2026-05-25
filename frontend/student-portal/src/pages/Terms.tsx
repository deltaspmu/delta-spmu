import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ChevronUp } from 'lucide-react';

export default function Terms() {
  const { t } = useTranslation(['common', 'pages', 'legal']);

  useEffect(() => {
    document.title = 'Terms of Service — Delta SPMU Academy';
  }, []);

  const sections = [
    { key: 'accounts', title: t('legal:terms.accounts_title'), text: t('legal:terms.accounts_text') },
    { key: 'courses', title: t('legal:terms.courses_title'), text: t('legal:terms.courses_text') },
    { key: 'payments', title: t('legal:terms.payments_title'), text: t('legal:terms.payments_text') },
    { key: 'ip', title: t('legal:terms.ip_title'), text: t('legal:terms.ip_text') },
    { key: 'conduct', title: t('legal:terms.conduct_title'), text: t('legal:terms.conduct_text') },
    { key: 'termination', title: t('legal:terms.termination_title'), text: t('legal:terms.termination_text') },
  ];

  return (
    <div className="min-h-screen bg-alabaster">
      {/* Header */}
      <div className="bg-dark text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="font-heading text-3xl sm:text-4xl font-bold mb-2">
            {t('legal:terms.title')}
          </h1>
          <p className="text-gray-300 text-sm">
            {t('legal:terms.last_updated')}
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="bg-white rounded-xl shadow-sm p-8">
          {/* Intro */}
          <p className="text-dark/70 leading-relaxed mb-8">
            {t('legal:terms.intro')}
          </p>

          {/* Sections */}
          <div className="space-y-8">
            {sections.map((section, index) => (
              <section key={section.key}>
                <h2 className="font-heading text-lg font-bold text-dark mb-2">
                  {index + 1}. {section.title}
                </h2>
                <p className="text-dark/70 leading-relaxed text-sm">
                  {section.text}
                </p>
              </section>
            ))}
          </div>

          {/* Back to top */}
          <div className="mt-10 pt-6 border-t border-gray-100 flex justify-center">
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="inline-flex items-center gap-1.5 text-sm text-dark/50 hover:text-primary transition-colors"
            >
              <ChevronUp className="w-4 h-4" />
              Back to top
            </button>
          </div>

          {/* Legal Nav */}
          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-xs text-dark/40 mb-3 font-medium uppercase tracking-wider">
              Other Policies
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to="/privacy" className="text-sm text-primary hover:underline">
                Privacy Policy
              </Link>
              <Link to="/refund" className="text-sm text-primary hover:underline">
                Refund Policy
              </Link>
              <Link to="/cookies" className="text-sm text-primary hover:underline">
                Cookie Policy
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
