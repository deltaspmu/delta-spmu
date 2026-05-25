import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const currentLang = i18n.language?.startsWith('am') ? 'am' : 'en';

  const toggle = () => {
    const next = currentLang === 'en' ? 'am' : 'en';
    i18n.changeLanguage(next);
    document.documentElement.lang = next;
  };

  return (
    <button
      onClick={toggle}
      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-dark/20"
      aria-label={`Switch language to ${currentLang === 'en' ? 'Amharic' : 'English'}`}
    >
      <Globe className="h-4 w-4" />
      <span className="uppercase">{currentLang}</span>
    </button>
  );
}
