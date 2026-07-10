/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_QLAP_SERVICES_API_BASE_URL?: string;
  readonly VITE_TOURNAMENT_API_BASE_URL?: string;
  readonly VITE_ENABLE_FRONTEND_MOCK_TEST?: string;
  readonly VITE_QLAP_MOCK_API_BASE_URL?: string;
  readonly VITE_QLAPGG_FRONTEND_MOCK_URL?: string;
  readonly VITE_QLAPGG_FRONTEND_BASE_URL?: string;
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
