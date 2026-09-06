/// <reference types="@solidjs/start/env" />

declare namespace App {
  interface RequestEventLocals {
    requestId?: string;
    currentUserPromise?: Promise<import("./server/auth/service").PublicUser | null>;
    /** Every `app_settings` row, fetched at most once per request. */
    settingsPromise?: Promise<Map<string, unknown>>;
    _db?: unknown;
    __memo?: Map<string, Promise<unknown>>;
  }
}

declare module "virtual:uno.css";
