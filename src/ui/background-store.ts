export type BackgroundStoreCode = 'unavailable' | 'too-large' | 'quota' | 'failed' | 'not-found';

export interface BackgroundStoreError {
  readonly code: BackgroundStoreCode;
}

export type BackgroundPut =
  | { readonly ok: true; readonly id: string }
  | { readonly ok: false; readonly error: BackgroundStoreError };

export type BackgroundGet =
  | { readonly ok: true; readonly blob: Blob }
  | { readonly ok: false; readonly error: BackgroundStoreError };

const DB_NAME = 'dc-mintatervezo:hatterkep';
const STORE_NAME = 'hatterkepek';
const DB_VERSION = 1;

/**
 * The largest picture worth keeping; bigger ones are refused before they are read.
 * A phone photo stays far below it, while one file beyond it can exhaust the whole origin quota.
 */
export const MAX_BACKGROUND_BYTES = 20 * 1024 * 1024;

type Outcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: BackgroundStoreError };

function fail(code: BackgroundStoreCode): { readonly ok: false; readonly error: BackgroundStoreError } {
  return { ok: false, error: { code } };
}

function factory(): IDBFactory | null {
  const scope = globalThis as Partial<typeof globalThis>;
  return scope.indexedDB ?? null;
}

/** Whether this browser offers the store at all. */
export function backgroundStoreAvailable(): boolean {
  return factory() !== null;
}

function codeFor(reason: unknown): BackgroundStoreCode {
  const name = typeof reason === 'object' && reason !== null ? (reason as { name?: unknown }).name : undefined;
  return name === 'QuotaExceededError' ? 'quota' : 'failed';
}

let opening: Promise<IDBDatabase | null> | null = null;

function openDatabase(): Promise<IDBDatabase | null> {
  const idb = factory();
  if (idb === null) return Promise.resolve(null);
  if (opening !== null) return opening;

  opening = new Promise<IDBDatabase | null>((resolve) => {
    const give = (db: IDBDatabase | null) => {
      if (db === null) opening = null;
      resolve(db);
    };
    try {
      const request = idb.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => give(request.result);
      request.onerror = () => give(null);
      request.onblocked = () => give(null);
    } catch {
      give(null);
    }
  });
  return opening;
}

function runOnStore<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<Outcome<T>> {
  return openDatabase().then(
    (db) =>
      new Promise<Outcome<T>>((resolve) => {
        if (db === null) {
          resolve(fail('unavailable'));
          return;
        }
        try {
          const transaction = db.transaction(STORE_NAME, mode);
          const request = work(transaction.objectStore(STORE_NAME));
          request.onsuccess = () => resolve({ ok: true, value: request.result });
          request.onerror = () => resolve(fail(codeFor(request.error)));
          transaction.onabort = () => resolve(fail(codeFor(transaction.error)));
        } catch (reason) {
          resolve(fail(codeFor(reason)));
        }
      }),
  );
}

function newId(): string {
  const source = globalThis.crypto as { randomUUID?: () => string } | undefined;
  const uuid = source?.randomUUID?.();
  return uuid ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function putBackground(blob: Blob): Promise<BackgroundPut> {
  if (!backgroundStoreAvailable()) return fail('unavailable');
  if (blob.size > MAX_BACKGROUND_BYTES) return fail('too-large');

  const id = newId();
  const outcome = await runOnStore('readwrite', (store) => store.put(blob, id));
  return outcome.ok ? { ok: true, id } : { ok: false, error: outcome.error };
}

export async function getBackground(id: string): Promise<BackgroundGet> {
  if (!backgroundStoreAvailable()) return fail('unavailable');

  const outcome = await runOnStore<Blob | null | undefined>('readonly', (store) => store.get(id));
  if (!outcome.ok) return { ok: false, error: outcome.error };
  const blob = outcome.value;
  return blob === undefined || blob === null ? fail('not-found') : { ok: true, blob };
}

export async function deleteBackground(id: string): Promise<void> {
  if (!backgroundStoreAvailable()) return;
  await runOnStore('readwrite', (store) => store.delete(id));
}

/** Removes every stored picture except the ones named, so old tracings do not pile up. */
export async function pruneBackgrounds(keep: readonly string[]): Promise<void> {
  if (!backgroundStoreAvailable()) return;

  const kept = new Set(keep);
  const keys = await runOnStore<IDBValidKey[]>('readonly', (store) => store.getAllKeys());
  if (!keys.ok) return;

  const doomed = keys.value.filter((key): key is string => typeof key === 'string' && !kept.has(key));
  await Promise.all(doomed.map((key) => runOnStore('readwrite', (store) => store.delete(key))));
}
