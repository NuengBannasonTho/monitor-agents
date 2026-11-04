/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "mock" builds the static preview that runs the in-browser simulator. */
  readonly VITE_DATA_SOURCE?: 'mock';
}
