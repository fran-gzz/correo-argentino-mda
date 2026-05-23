/// <reference path="../.astro/types.d.ts" />

declare namespace App {
  interface Locals {
    user: {
      id: number;
      username: string;
      role: string;
    };
  }
}

interface HTMLDialogElement extends HTMLElement {
  showModal(): void;
  close(returnValue?: string): void;
}

interface HTMLInputElement extends HTMLElement {
  value: string;
}

/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
