/*
 * The tracing picture's bytes live in IndexedDB, not in the pattern (PQW-971).
 *
 * These tests run without a browser, so the file installs a small fake
 * IndexedDB on the global object — enough of open, transaction, put, get,
 * delete and getAllKeys to drive the store, and nothing more.
 */

import { strict as assert } from 'node:assert';
import { after, test } from 'node:test';

import {
  backgroundStoreAvailable,
  deleteBackground,
  getBackground,
  MAX_BACKGROUND_BYTES,
  pruneBackgrounds,
  putBackground,
} from '../src/ui/background-store.ts';

function fakeRequest(work) {
  const request = { result: undefined, error: null, onsuccess: null, onerror: null };
  queueMicrotask(() => {
    try {
      request.result = work();
      request.onsuccess?.();
    } catch (reason) {
      request.error = reason;
      request.onerror?.();
    }
  });
  return request;
}

function fakeIndexedDB() {
  const data = new Map();
  const counts = { opens: 0, transactions: 0 };
  let refuseNextWrite = null;

  const store = {
    put(value, key) {
      return fakeRequest(() => {
        if (refuseNextWrite !== null) {
          const reason = refuseNextWrite;
          refuseNextWrite = null;
          throw reason;
        }
        data.set(key, value);
        return key;
      });
    },
    get(key) {
      return fakeRequest(() => data.get(key));
    },
    delete(key) {
      return fakeRequest(() => {
        data.delete(key);
      });
    },
    getAllKeys() {
      return fakeRequest(() => [...data.keys()]);
    },
  };

  const db = {
    objectStoreNames: { contains: () => true },
    createObjectStore: () => store,
    transaction(name, mode) {
      counts.transactions += 1;
      assert.equal(name, 'hatterkepek', 'the store name the module asks for');
      assert.ok(mode === 'readonly' || mode === 'readwrite', mode);
      return { objectStore: () => store, error: null, onabort: null };
    },
  };

  return {
    data,
    counts,
    refuse(reason) {
      refuseNextWrite = reason;
    },
    indexedDB: {
      open(name, version) {
        counts.opens += 1;
        assert.equal(name, 'dc-mintatervezo:hatterkep', 'the database name the module asks for');
        assert.equal(version, 1);
        const request = {
          result: db,
          error: null,
          onsuccess: null,
          onerror: null,
          onupgradeneeded: null,
          onblocked: null,
        };
        queueMicrotask(() => {
          request.onupgradeneeded?.();
          request.onsuccess?.();
        });
        return request;
      },
    },
  };
}

/** The outcome of a call: what it returned, and whether it threw instead. */
async function settled(work) {
  try {
    return { threw: null, value: await work() };
  } catch (reason) {
    return { threw: reason, value: undefined };
  }
}

const originalIndexedDB = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
const fake = fakeIndexedDB();
globalThis.indexedDB = fake.indexedDB;

after(() => {
  if (originalIndexedDB === undefined) delete globalThis.indexedDB;
  else Object.defineProperty(globalThis, 'indexedDB', originalIndexedDB);
});

test('a picture goes in and comes back out', async () => {
  const put = await settled(() => putBackground(new Blob(['tracing'], { type: 'image/png' })));
  assert.equal(put.threw, null);
  assert.equal(put.value.ok, true);
  assert.equal(typeof put.value.id, 'string');
  assert.ok(put.value.id.length > 0);

  const got = await settled(() => getBackground(put.value.id));
  assert.equal(got.threw, null);
  assert.equal(got.value.ok, true);
  assert.equal(await got.value.blob.text(), 'tracing');
});

test('a blob of any type is stored: deciding what is a picture belongs to the caller', async () => {
  const put = await settled(() => putBackground(new Blob(['plain'], { type: 'application/pdf' })));
  assert.equal(put.threw, null);
  assert.equal(put.value.ok, true);

  const got = await settled(() => getBackground(put.value.id));
  assert.equal(got.threw, null);
  assert.equal(got.value.ok, true);
});

test('an id that was never stored reports not-found', async () => {
  const got = await settled(() => getBackground('no-such-id'));
  assert.equal(got.threw, null);
  assert.equal(got.value.ok, false);
  assert.equal(got.value.error.code, 'not-found');
});

test('a picture over the limit is refused without touching the database', async () => {
  const before = { ...fake.counts };
  // A stub, not a real blob: the store reads the size and refuses before anything is read.
  const oversized = { size: MAX_BACKGROUND_BYTES + 1 };

  const put = await settled(() => putBackground(oversized));
  assert.equal(put.threw, null);
  assert.equal(put.value.ok, false);
  assert.equal(put.value.error.code, 'too-large');
  assert.deepEqual({ ...fake.counts }, before, 'the database was not touched');
});

test('a picture exactly at the limit is still accepted', async () => {
  const put = await settled(() => putBackground({ size: MAX_BACKGROUND_BYTES }));
  assert.equal(put.threw, null);
  assert.equal(put.value.ok, true);
  await deleteBackground(put.value.id);
});

test('a write that exceeds the quota reports quota', async () => {
  fake.refuse(new DOMException('no room left', 'QuotaExceededError'));

  const put = await settled(() => putBackground(new Blob(['tracing'])));
  assert.equal(put.threw, null);
  assert.equal(put.value.ok, false);
  assert.equal(put.value.error.code, 'quota');
});

test('any other write failure reports failed', async () => {
  fake.refuse(new DOMException('broken', 'UnknownError'));

  const put = await settled(() => putBackground(new Blob(['tracing'])));
  assert.equal(put.threw, null);
  assert.equal(put.value.ok, false);
  assert.equal(put.value.error.code, 'failed');
});

test('every picture gets its own id', async () => {
  const first = await settled(() => putBackground(new Blob(['one'])));
  const second = await settled(() => putBackground(new Blob(['two'])));
  assert.equal(first.threw, null);
  assert.equal(second.threw, null);
  assert.notEqual(first.value.id, second.value.id);

  const got = await settled(() => getBackground(first.value.id));
  assert.equal(got.threw, null);
  assert.equal(await got.value.blob.text(), 'one', 'the second picture did not overwrite the first');
});

test('deleting a picture makes it not-found', async () => {
  const put = await settled(() => putBackground(new Blob(['gone soon'])));
  assert.equal(put.threw, null);

  const removed = await settled(() => deleteBackground(put.value.id));
  assert.equal(removed.threw, null);
  assert.equal(removed.value, undefined);

  const got = await settled(() => getBackground(put.value.id));
  assert.equal(got.threw, null);
  assert.equal(got.value.error.code, 'not-found');
});

test('pruning deletes every picture but the named ones', async () => {
  fake.data.clear();
  const kept = await putBackground(new Blob(['kept']));
  const alsoKept = await putBackground(new Blob(['also kept']));
  const old = await putBackground(new Blob(['old']));

  const pruned = await settled(() => pruneBackgrounds([kept.id, alsoKept.id]));
  assert.equal(pruned.threw, null);

  assert.deepEqual([...fake.data.keys()].sort(), [kept.id, alsoKept.id].sort());
  assert.equal((await getBackground(old.id)).ok, false);
  assert.equal((await getBackground(kept.id)).ok, true);
  assert.equal((await getBackground(alsoKept.id)).ok, true);
});

test('pruning an empty keep list empties the store', async () => {
  fake.data.clear();
  await putBackground(new Blob(['old']));

  const pruned = await settled(() => pruneBackgrounds([]));
  assert.equal(pruned.threw, null);
  assert.deepEqual([...fake.data.keys()], []);
});

test('the database is opened once, however many calls are made', async () => {
  assert.equal(fake.counts.opens, 1, `opened ${fake.counts.opens} times so far`);
  assert.ok(fake.counts.transactions > 5, 'the earlier tests did run against the database');

  const more = await settled(async () => {
    await putBackground(new Blob(['again']));
    await getBackground('no-such-id');
    await pruneBackgrounds([]);
  });
  assert.equal(more.threw, null);
  assert.equal(fake.counts.opens, 1);
});

test('without indexedDB nothing throws and every entry point reports unavailable', async () => {
  delete globalThis.indexedDB;
  try {
    assert.equal(backgroundStoreAvailable(), false);

    const put = await settled(() => putBackground(new Blob(['tracing'])));
    assert.equal(put.threw, null);
    assert.equal(put.value.error.code, 'unavailable');

    const got = await settled(() => getBackground('any-id'));
    assert.equal(got.threw, null);
    assert.equal(got.value.error.code, 'unavailable');

    const removed = await settled(() => deleteBackground('any-id'));
    assert.equal(removed.threw, null);

    const pruned = await settled(() => pruneBackgrounds([]));
    assert.equal(pruned.threw, null);
  } finally {
    globalThis.indexedDB = fake.indexedDB;
  }

  assert.equal(backgroundStoreAvailable(), true, 'the fake is back in place');
});
