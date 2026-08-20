/**
 * Resilient multi-storage synchronization utility.
 *
 * Stores keys across:
 * 1. localStorage (primary persistent store)
 * 2. sessionStorage (session survivability)
 * 3. document.cookie (survives site data wipes that skip cookies, 1-year expiry)
 * 4. IndexedDB (survives localStorage eviction and some private-mode resets)
 *
 * When any value is read, it reads from all available stores. If found in at
 * least one store, it automatically restores/syncs the value to all missing stores.
 */

const DB_NAME = "foss_onam_store";
const STORE_NAME = "key_val";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase | null> | null = null;

function getIndexedDB(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.resolve(null);
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = window.indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return dbPromise;
}

async function idbGet(key: string): Promise<string | null> {
  try {
    const db = await getIndexedDB();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => resolve(typeof req.result === "string" ? req.result : null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  } catch {
    return null;
  }
}

async function idbSet(key: string, value: string): Promise<void> {
  try {
    const db = await getIndexedDB();
    if (!db) return;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch {
    // best-effort
  }
}

function cookieGet(key: string): string | null {
  if (typeof document === "undefined") return null;
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${encodeURIComponent(key)}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

function cookieSet(key: string, value: string, maxAgeDays = 365): void {
  if (typeof document === "undefined") return;
  try {
    const maxAge = maxAgeDays * 24 * 60 * 60;
    document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
  } catch {
    // best-effort
  }
}

/**
 * Synchronously retrieves a value from localStorage, sessionStorage, or cookies.
 */
export function getMultiStoreSync(key: string): string | null {
  if (typeof window === "undefined") return null;
  let val: string | null = null;
  try {
    val = localStorage.getItem(key);
  } catch {
    // ignore
  }
  if (!val) {
    try {
      val = sessionStorage.getItem(key);
    } catch {
      // ignore
    }
  }
  if (!val) {
    val = cookieGet(key);
  }
  return val;
}

/**
 * Sets a value synchronously across localStorage, sessionStorage, and cookie,
 * and asynchronously writes to IndexedDB.
 */
export function setMultiStoreSync(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // ignore
  }
  cookieSet(key, value);
  idbSet(key, value).catch(() => undefined);
}

/**
 * Asynchronously checks all stores (including IndexedDB) and heals any that are missing.
 */
export async function getAndHealMultiStore(key: string): Promise<string | null> {
  if (typeof window === "undefined") return null;
  let val = getMultiStoreSync(key);
  if (!val) {
    val = await idbGet(key);
  }
  if (val) {
    // Sync to all other stores
    setMultiStoreSync(key, val);
  }
  return val;
}

function cookieDelete(key: string): void {
  if (typeof document === "undefined") return;
  try {
    document.cookie = `${encodeURIComponent(key)}=; path=/; max-age=0; SameSite=Lax`;
  } catch {
    // ignore
  }
}

async function idbDelete(key: string): Promise<void> {
  try {
    const db = await getIndexedDB();
    if (!db) return;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch {
    // ignore
  }
}

/**
 * Removes a key synchronously across localStorage, sessionStorage, and cookie,
 * and asynchronously deletes it from IndexedDB.
 */
export function removeMultiStoreSync(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
  cookieDelete(key);
  idbDelete(key).catch(() => undefined);
}
