import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ChevronUp } from 'lucide-react';

export default function Cookies() {
  const { t } = useTranslation(['common', 'pages', 'legal']);

  useEffect(() => {
    document.title = 'Cookie Policy — Delta SPMU Academy';
  }, []);

  return (
    <div className="min-h-screen bg-alabaster">
      {/* Header */}
      <div className="bg-dark text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="font-heading text-3xl sm:text-4xl font-bold mb-2">
            {t('legal:cookies.title')}
          </h1>
          <p className="text-gray-300 text-sm">
            {t('legal:cookies.last_updated')}
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="bg-white rounded-xl shadow-sm p-8">
          {/* Intro */}
          <p className="text-dark/70 leading-relaxed mb-8">
            {t('legal:cookies.intro')}
          </p>

          {/* Sections */}
          <div className="space-y-8">
            {/* 1. What Are Cookies */}
            <section>
              <h2 className="font-heading text-lg font-bold text-dark mb-2">
                1. {t('legal:cookies.what_title')}
              </h2>
              <p className="text-dark/70 leading-relaxed text-sm">
                {t('legal:cookies.what_text')}
              </p>
            </section>

            {/* 2. Types of Cookies */}
            <section>
              <h2 className="font-heading text-lg font-bold text-dark mb-2">
                2. {t('legal:cookies.types_title')}
              </h2>
              <ul className="space-y-3 mt-3">
                <li className="flex items-start gap-3 bg-gray-50 rounded-lg p-4">
                  <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                  <p className="text-dark/70 text-sm m-0">
                    {t('legal:cookies.essential')}
                  </p>
                </li>
                <li className="flex items-start gap-3 bg-gray-50 rounded-lg p-4">
                  <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                  <p className="text-dark/70 text-sm m-0">
                    {t('legal:cookies.functional')}
                  </p>
                </li>
                <li className="flex items-start gap-3 bg-gray-50 rounded-lg p-4">
                  <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                  <p className="text-dark/70 text-sm m-0">
                    {t('legal:cookies.analytics')}
                  </p>
                </li>
              </ul>
            </section>

            {/* 3. Managing Cookies */}
            <section>
              <h2 className="font-heading text-lg font-bold text-dark mb-2">
                3. {t('legal:cookies.manage_title')}
              </h2>
              <p className="text-dark/70 leading-relaxed text-sm">
                {t('legal:cookies.manage_text')}
              </p>
            </section>
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
              <Link to="/terms" className="text-sm text-primary hover:underline">
                Terms of Service
              </Link>
              <Link to="/privacy" className="text-sm text-primary hover:underline">
                Privacy Policy
              </Link>
              <Link to="/refund" className="text-sm text-primary hover:underline">
                Refund Policy
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
