/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_USE_VIMEO_PROXY?: string;
  readonly VITE_VIMEO_ACCESS_TOKEN?: string;
  readonly VITE_EMAIL_API_URL?: string;
  readonly VITE_EMAIL_API_KEY?: string;
  readonly VITE_SITE_DISABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
