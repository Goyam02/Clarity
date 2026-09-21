import { RecordingStore } from './types';

const DB_NAME = 'clarity_proctor_recordings';
const DB_VERSION = 1;
const STORE_CHUNKS = 'recording_chunks';
const STORE_META = 'recording_meta';
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

class IndexedDBRecordingStore implements RecordingStore {
  private sessionId: string;
  private dbPromise: Promise<IDBDatabase> | null = null;
  private inMemoryFallbackChunks: Blob[] = [];
  private finalizedBlob: Blob | null = null;

  constructor(sessionId: string = 'current_session') {
    this.sessionId = sessionId;
  }

  private async getDB(): Promise<IDBDatabase | null> {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return null;
    }

    if (!this.dbPromise) {
      this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_CHUNKS)) {
            const chunkStore = db.createObjectStore(STORE_CHUNKS, { autoIncrement: true, keyPath: 'id' });
            chunkStore.createIndex('sessionId', 'sessionId', { unique: false });
          }
          if (!db.objectStoreNames.contains(STORE_META)) {
            db.createObjectStore(STORE_META, { keyPath: 'sessionId' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }

    try {
      return await this.dbPromise;
    } catch {
      return null;
    }
  }

  async append(chunk: Blob): Promise<void> {
    this.inMemoryFallbackChunks.push(chunk);

    const db = await this.getDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction([STORE_CHUNKS, STORE_META], 'readwrite');
        const chunkStore = tx.objectStore(STORE_CHUNKS);
        const metaStore = tx.objectStore(STORE_META);

        chunkStore.add({
          sessionId: this.sessionId,
          chunk,
          timestamp: Date.now(),
        });

        metaStore.put({
          sessionId: this.sessionId,
          updatedAt: Date.now(),
        });

        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  async finalize(): Promise<Blob | null> {
    const blob = await this.getBlob();
    this.finalizedBlob = blob;
    return blob;
  }

  async getBlob(): Promise<Blob | null> {
    if (this.finalizedBlob) return this.finalizedBlob;

    const db = await this.getDB();
    if (!db) {
      if (this.inMemoryFallbackChunks.length === 0) return null;
      return new Blob(this.inMemoryFallbackChunks, { type: 'video/webm' });
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_CHUNKS, 'readonly');
        const store = tx.objectStore(STORE_CHUNKS);
        const index = store.index('sessionId');
        const req = index.getAll(this.sessionId);

        req.onsuccess = () => {
          const records = req.result as Array<{ chunk: Blob }>;
          if (!records || records.length === 0) {
            if (this.inMemoryFallbackChunks.length > 0) {
              resolve(new Blob(this.inMemoryFallbackChunks, { type: 'video/webm' }));
            } else {
              resolve(null);
            }
            return;
          }
          const blobs = records.map((r) => r.chunk);
          resolve(new Blob(blobs, { type: 'video/webm' }));
        };

        req.onerror = () => {
          if (this.inMemoryFallbackChunks.length > 0) {
            resolve(new Blob(this.inMemoryFallbackChunks, { type: 'video/webm' }));
          } else {
            resolve(null);
          }
        };
      } catch {
        resolve(null);
      }
    });
  }

  async discard(): Promise<void> {
    this.inMemoryFallbackChunks = [];
    this.finalizedBlob = null;

    const db = await this.getDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction([STORE_CHUNKS, STORE_META], 'readwrite');
        const chunkStore = tx.objectStore(STORE_CHUNKS);
        const metaStore = tx.objectStore(STORE_META);

        const index = chunkStore.index('sessionId');
        const keyReq = index.getAllKeys(this.sessionId);

        keyReq.onsuccess = () => {
          const keys = keyReq.result;
          keys.forEach((key) => chunkStore.delete(key));
          metaStore.delete(this.sessionId);
        };

        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  async purgeOld(maxAgeMs: number = DEFAULT_MAX_AGE_MS): Promise<void> {
    const db = await this.getDB();
    if (!db) return;

    const threshold = Date.now() - maxAgeMs;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction([STORE_CHUNKS, STORE_META], 'readwrite');
        const metaStore = tx.objectStore(STORE_META);
        const chunkStore = tx.objectStore(STORE_CHUNKS);

        const req = metaStore.getAll();
        req.onsuccess = () => {
          const sessions = req.result as Array<{ sessionId: string; updatedAt: number }>;
          sessions.forEach((s) => {
            if (s.updatedAt < threshold) {
              const index = chunkStore.index('sessionId');
              const keyReq = index.getAllKeys(s.sessionId);
              keyReq.onsuccess = () => {
                keyReq.result.forEach((k) => chunkStore.delete(k));
                metaStore.delete(s.sessionId);
              };
            }
          });
        };

        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  /**
   * Unimplemented backend stub
   */
  async uploadRecording(_blob: Blob): Promise<{ success: boolean; url?: string }> {
    // Backend upload endpoint not yet connected
    return Promise.resolve({
      success: false,
      url: undefined,
    });
  }
}

export function createRecordingStore(sessionId: string = 'current_mock_oa'): RecordingStore {
  const store = new IndexedDBRecordingStore(sessionId);
  // Auto-trigger background purge for recordings older than 24h
  store.purgeOld().catch(() => {});
  return store;
}
