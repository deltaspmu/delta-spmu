import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enCommon from './locales/en/common.json';
import enPages from './locales/en/pages.json';
import enLegal from './locales/en/legal.json';
import amCommon from './locales/am/common.json';
import amPages from './locales/am/pages.json';
import amLegal from './locales/am/legal.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: enCommon,
        pages: enPages,
        legal: enLegal,
      },
      am: {
        common: amCommon,
        pages: amPages,
        legal: amLegal,
      },
    },
    defaultNS: 'common',
    ns: ['common', 'pages', 'legal'],
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage'],
    },
    react: {
      useSuspense: false,
    },
  });

const setDocumentLanguage = (lng: string) => {
  document.documentElement.lang = lng.startsWith('am') ? 'am' : 'en';
};

// The detector can resolve the stored language during init, before a
// languageChanged listener is attached. Apply it immediately as well as on
// subsequent switches so a reload preserves both the translated UI and the
// document language metadata.
setDocumentLanguage(i18n.resolvedLanguage || i18n.language || 'en');
i18n.on('languageChanged', setDocumentLanguage);

export default i18n;
