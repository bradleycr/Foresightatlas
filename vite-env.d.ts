/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FORESIGHT_WRITE_SECRET?: string;
  /** Absolute API origin (no trailing slash), e.g. https://partner.example.com */
  readonly VITE_API_ORIGIN?: string;
  /** Invite this email to contribute to the shared node calendar. */
  readonly VITE_CALENDAR_INVITE_EMAIL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.png' {
  const value: string;
  export default value;
}

declare module '*.jpg' {
  const value: string;
  export default value;
}

declare module '*.jpeg' {
  const value: string;
  export default value;
}

declare module '*.svg' {
  const value: string;
  export default value;
}

declare module '*.gif' {
  const value: string;
  export default value;
}

declare module '*.webp' {
  const value: string;
  export default value;
}

