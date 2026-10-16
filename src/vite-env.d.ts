/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the PHP API, e.g. https://sc-laufenburg.de/api (no trailing slash). */
  readonly VITE_API_BASE?: string;
  /** Public site root used for uploaded files/photos. Defaults to API base without the trailing /api. */
  readonly VITE_SITE_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
