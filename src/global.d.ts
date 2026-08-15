/// <reference types="@solidjs/start/env" />

declare namespace App {
  interface RequestEventLocals {
    requestId?: string;
    currentUserPromise?: Promise<import("./server/auth/service").PublicUser | null>;
  }
}

declare module "virtual:uno.css";
