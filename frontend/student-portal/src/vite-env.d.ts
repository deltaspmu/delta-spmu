/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_GA_MEASUREMENT_ID?: string;
  readonly VITE_SITE_DISABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
