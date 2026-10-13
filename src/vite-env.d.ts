/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Solo para probar la app contra otro Worker móvil. Por defecto, https://app-movil.nuestro-lugar.workers.dev */
  readonly VITE_MOBILE_API_ORIGIN?: string;
}
