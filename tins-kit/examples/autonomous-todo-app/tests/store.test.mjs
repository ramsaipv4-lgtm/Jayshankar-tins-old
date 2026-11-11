// tests/store.test.mjs — Focus: acceptance tests for src/store.js.
//
// Runs on Node built-ins alone (SPEC §0.2 D1, §4.4): `node:test` and
// `node:assert`. No dependencies, no framework, no install step.
//
// Scope: the §4.2 public surface only — `STORAGE_KEY`, `createStore()`, and the
// nine store methods. Nothing here reaches into the module's internals.
//
// Covers SPEC §8.1–§8.5 (the §8.10 acceptance criterion) and every row of the
// §7 failure table.
//
// Web storage: `store.js` resolves `globalThis.localStorage` lazily on every
// access, so each test installs its own in-memory stand-in and restores the
// global afterwards. Every test body is synchronous, so no two tests can ever
// hold the global at once regardless of how the runner schedules them.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { STORAGE_KEY, createStore } from '../src/store.js';

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

/**
 * An in-memory stand-in for the Web Storage API, with the two failure modes
 * SPEC §7 rows 1 and 2 describe.
 *
 * @param {{ data?: Record<string,string>, throwOnRead?: boolean, throwOnWrite?: boolean }} [options]
 * @param {Record<string,string>} [options.data] initial contents
 * @param {boolean} [options.throwOnRead] `getItem` throws (storage blocked)
 * @param {boolean} [options.throwOnWrite] `setItem` throws (quota, private mode)
 */
function makeStorage({ data = {}, throwOnRead = false, throwOnWrite = false } = {}) {
  const map = new Map(Object.entries(data));

  return {
    get length() {
      return map.size;
    },
    key(index) {
      return Array.from(map.keys())[index] ?? null;
    },
    getItem(key) {
      if (throwOnRead) throw new Error('SecurityError: storage is blocked');
      const k = String(key);
      return map.has(k) ? map.get(k) : null;
    },
    setItem(key, value) {
      if (throwOnWrite) throw new Error('QuotaExceededError: storage is full');
      map.set(String(key), String(value));
    },
    removeItem(key) {
      map.delete(String(key));
    },
    clear() {
      map.clear();
    },
    /** Test-side reader for the raw string under the app's key. Not part of the Storage surface. */
    peek() {
      return map.has(STORAGE_KEY) ? map.get(STORAGE_KEY) : null;
    },
  };
}

/**
 * Install `storage` as `globalThis.localStorage` for the duration of `fn`, then
 * restore whatever was there before. `null` means "this environment has no web
 * storage at all", which is both plain Node and a browser with site data off.
 *
 * @template T
 * @param {object|null} storage
 * @param {() => T} fn
 * @returns {T}
 */
function withStorage(storage, fn) {
  const had = Object.prototype.hasOwnProperty.call(globalThis, 'localStorage');
  const previous = had ? globalThis.localStorage : undefined;

  if (storage === null) delete globalThis.localStorage;
  else globalThis.localStorage = storage;

  try {
    return fn();
  } finally {
    if (had) globalThis.localStorage = previous;
    else delete globalThis.localStorage;
  }
}

/**
 * The common case: build a storage stand-in, install it, create a store over
 * it, and hand both to the test. The storage stays installed for the whole
 * callback, so a test can create a second store over the same storage.
 *
 * @template T
 * @param {Parameters<typeof makeStorage>[0] | null} storageOptions `null` for no web storage
 * @param {(store: ReturnType<typeof createStore>, storage: object|null) => T} fn
 * @returns {T}
 */
function withStore(storageOptions, fn) {
  const storage = storageOptions === null ? null : makeStorage(storageOptions);
  return withStorage(storage, () => fn(createStore(), storage));
}

/**
 * Run `fn` with `globalThis.crypto` removed (SPEC §7 row 5 — an insecure
 * browser context, where `crypto.randomUUID` is undefined).
 *
 * @template T
 * @param {() => T} fn
 * @returns {T}
 */
function withoutCrypto(fn) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  delete globalThis.crypto;
  try {
    return fn();
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor);
  }
}

/** Serialise a todo list so "unchanged" can be asserted as one value. */
const snapshot = (todos) => JSON.stringify(todos);

/** Store a todo array under the app's key, the way the store itself would. */
const seed = (todos) => ({ [STORAGE_KEY]: JSON.stringify(todos) });

// ---------------------------------------------------------------------------
// §4.2 — the interface contract
// ---------------------------------------------------------------------------

describe('§4.2 interface contract', () => {
  it('exports the storage key the spec names', () => {
    assert.equal(STORAGE_KEY, 'focus.todos.v1');
  });

  it('createStore() returns exactly the nine documented methods', () => {
    withStore({}, (store) => {
      assert.deepEqual(Object.keys(store).sort(), [
        'add',
        'clearCompleted',
        'getRemainingCount',
        'getTodos',
        'getVisible',
        'isPersistent',
        'remove',
        'subscribe',
        'toggle',
      ]);
      for (const name of Object.keys(store)) {
        assert.equal(typeof store[name], 'function', `${name} should be a function`);
      }
    });
  });

  it('a new store over empty storage starts empty and persistent', () => {
    withStore({}, (store) => {
      assert.deepEqual(store.getTodos(), []);
      assert.equal(store.getRemainingCount(), 0);
      assert.equal(store.isPersistent(), true);
    });
  });
});

// ---------------------------------------------------------------------------
// §8.1 — add() returns a well-formed todo
// ---------------------------------------------------------------------------

describe('§8.1 add() returns a well-formed todo', () => {
  it('has a non-empty string id, the trimmed text, done false, numeric createdAt', () => {
    withStore({}, (store) => {
      const todo = store.add('read the spec');

      assert.equal(typeof todo.id, 'string');
      assert.ok(todo.id.length > 0, 'id should not be empty');
      assert.equal(todo.text, 'read the spec');
      assert.equal(todo.done, false);
      assert.equal(typeof todo.createdAt, 'number');
      assert.ok(Number.isFinite(todo.createdAt), 'createdAt should be a finite number');
    });
  });

  it('trims surrounding whitespace from the authored text', () => {
    withStore({}, (store) => {
      assert.equal(store.add('   read the spec \n ').text, 'read the spec');
    });
  });

  it('appends to the collection in insertion order', () => {
    withStore({}, (store) => {
      const first = store.add('one');
      const second = store.add('two');
      const third = store.add('three');

      assert.deepEqual(
        store.getTodos().map((t) => t.text),
        ['one', 'two', 'three'],
      );
      assert.deepEqual(
        store.getTodos().map((t) => t.id),
        [first.id, second.id, third.id],
      );
    });
  });

  it('mints a distinct id for every todo', () => {
    withStore({}, (store) => {
      for (let i = 0; i < 200; i++) store.add(`todo ${i}`);
      const ids = store.getTodos().map((t) => t.id);
      assert.equal(new Set(ids).size, 200);
    });
  });

  it('persists the new todo under STORAGE_KEY (§4.2: every mutator persists)', () => {
    withStore({}, (store, storage) => {
      const todo = store.add('read the spec');
      const stored = JSON.parse(storage.peek());

      assert.ok(Array.isArray(stored), 'the stored value should be an array');
      assert.equal(stored.length, 1);
      assert.equal(stored[0].id, todo.id);
      assert.equal(stored[0].text, 'read the spec');
      assert.equal(stored[0].done, false);
    });
  });
});

// ---------------------------------------------------------------------------
// §8.2 — empty and whitespace-only input creates nothing
// ---------------------------------------------------------------------------

describe('§8.2 empty and whitespace-only input creates nothing', () => {
  it('add("") returns null and leaves the collection unchanged', () => {
    withStore({}, (store) => {
      store.add('a real todo');
      const before = store.getTodos().length;

      assert.equal(store.add(''), null);
      assert.equal(store.getTodos().length, before);
    });
  });

  it('add("   ") returns null and leaves the collection unchanged', () => {
    withStore({}, (store) => {
      store.add('a real todo');
      const before = store.getTodos().length;

      assert.equal(store.add('   '), null);
      assert.equal(store.getTodos().length, before);
    });
  });

  it('rejects tabs and newlines the same way, and throws nothing (§4.3 step 2)', () => {
    withStore({}, (store) => {
      assert.equal(store.add('\t\n  '), null);
      assert.equal(store.getTodos().length, 0);
    });
  });

  it('a rejected add notifies no subscriber', () => {
    withStore({}, (store) => {
      let calls = 0;
      store.subscribe(() => {
        calls++;
      });

      store.add('   ');
      assert.equal(calls, 0);

      store.add('a real todo');
      assert.equal(calls, 1);
    });
  });
});

// ---------------------------------------------------------------------------
// §8.3 — toggle
// ---------------------------------------------------------------------------

describe('§8.3 toggle', () => {
  it('flips done and returns true', () => {
    withStore({}, (store) => {
      const todo = store.add('read the spec');
      assert.equal(todo.done, false);

      assert.equal(store.toggle(todo.id), true);
      assert.equal(store.getTodos()[0].done, true);
    });
  });

  it('called twice, returns the todo to its original state', () => {
    withStore({}, (store) => {
      const todo = store.add('read the spec');

      assert.equal(store.toggle(todo.id), true);
      assert.equal(store.toggle(todo.id), true);
      assert.equal(store.getTodos()[0].done, false);
    });
  });

  it('toggle("nope") returns false and changes nothing (§7 row 6)', () => {
    withStore({}, (store) => {
      store.add('one');
      store.add('two');
      store.toggle(store.getTodos()[1].id);

      const before = snapshot(store.getTodos());
      let notifications = 0;
      store.subscribe(() => {
        notifications++;
      });

      assert.equal(store.toggle('nope'), false);
      assert.equal(snapshot(store.getTodos()), before);
      assert.equal(notifications, 0);
    });
  });

  it('keeps the remaining count in step', () => {
    withStore({}, (store) => {
      const a = store.add('one');
      store.add('two');
      assert.equal(store.getRemainingCount(), 2);

      store.toggle(a.id);
      assert.equal(store.getRemainingCount(), 1);

      store.toggle(a.id);
      assert.equal(store.getRemainingCount(), 2);
    });
  });
});

// ---------------------------------------------------------------------------
// §8.4 — filtering hides, it never deletes (D5)
// ---------------------------------------------------------------------------

describe('§8.4 getVisible', () => {
  /** Three todos with the middle one done. */
  const threeWithMiddleDone = (store) => {
    const a = store.add('alpha');
    const b = store.add('bravo');
    const c = store.add('charlie');
    store.toggle(b.id);
    return { a, b, c };
  };

  it("'active' excludes done todos", () => {
    withStore({}, (store) => {
      const { a, c } = threeWithMiddleDone(store);
      assert.deepEqual(
        store.getVisible('active').map((t) => t.id),
        [a.id, c.id],
      );
    });
  });

  it("'done' includes only done todos", () => {
    withStore({}, (store) => {
      const { b } = threeWithMiddleDone(store);
      assert.deepEqual(
        store.getVisible('done').map((t) => t.id),
        [b.id],
      );
    });
  });

  it("'all' returns every todo in insertion order", () => {
    withStore({}, (store) => {
      const { a, b, c } = threeWithMiddleDone(store);
      assert.deepEqual(
        store.getVisible('all').map((t) => t.id),
        [a.id, b.id, c.id],
      );
    });
  });

  it('none of the three mutates getTodos() (D5)', () => {
    withStore({}, (store) => {
      threeWithMiddleDone(store);
      const before = snapshot(store.getTodos());

      store.getVisible('active');
      store.getVisible('done');
      store.getVisible('all');

      assert.equal(store.getTodos().length, 3);
      assert.equal(snapshot(store.getTodos()), before);
    });
  });

  it('hands back arrays the caller cannot splice the collection through', () => {
    withStore({}, (store) => {
      threeWithMiddleDone(store);

      store.getVisible('all').length = 0;
      store.getVisible('active').push({ id: 'x', text: 'x', done: false, createdAt: 0 });
      store.getTodos().length = 0;

      assert.equal(store.getTodos().length, 3);
    });
  });
});

// ---------------------------------------------------------------------------
// §8.5 — persistence round-trip, and life without storage
// ---------------------------------------------------------------------------

describe('§8.5 persistence', () => {
  it('a fresh store over the same storage returns the same todos', () => {
    withStore({}, (first) => {
      const keep = first.add('read the spec');
      const doneOne = first.add('write the tests');
      const goner = first.add('typo');
      first.toggle(doneOne.id);
      first.remove(goner.id);

      const second = createStore();

      assert.deepEqual(second.getTodos(), first.getTodos());
      assert.deepEqual(
        second.getTodos().map((t) => t.id),
        [keep.id, doneOne.id],
      );
      assert.equal(second.getTodos()[1].done, true);
      assert.equal(second.getRemainingCount(), 1);
      assert.equal(second.isPersistent(), true);
    });
  });

  it('a cleared-completed collection survives the round-trip too', () => {
    withStore({}, (first) => {
      const keep = first.add('keep me');
      const drop = first.add('drop me');
      first.toggle(drop.id);
      first.clearCompleted();

      assert.deepEqual(
        createStore().getTodos().map((t) => t.text),
        [keep.text],
      );
    });
  });

  it('with storage unavailable the store still works and isPersistent() is false', () => {
    withStore(null, (store) => {
      assert.equal(store.isPersistent(), false);
      assert.deepEqual(store.getTodos(), []);

      const todo = store.add('read the spec');
      assert.ok(todo, 'add() should still create a todo in memory');
      assert.equal(store.getTodos().length, 1);
      assert.equal(store.getRemainingCount(), 1);

      assert.equal(store.toggle(todo.id), true);
      assert.equal(store.getVisible('done').length, 1);
      assert.equal(store.remove(todo.id), true);
      assert.deepEqual(store.getTodos(), []);
      assert.equal(store.isPersistent(), false);
    });
  });
});

// ---------------------------------------------------------------------------
// §7 — the failure table
// ---------------------------------------------------------------------------

describe('§7 failure table', () => {
  it('row 1: a read that throws starts empty with persistent false', () => {
    withStore(
      { data: seed([{ id: 'a', text: 'unreachable', done: false, createdAt: 1 }]), throwOnRead: true },
      (store) => {
        assert.deepEqual(store.getTodos(), []);
        assert.equal(store.isPersistent(), false);
      },
    );
  });

  it('row 2: a write that throws keeps the in-memory state and sets persistent false', () => {
    withStore({ throwOnWrite: true }, (store) => {
      assert.equal(store.isPersistent(), true, 'the read succeeded, so the store starts persistent');

      const todo = store.add('read the spec');

      assert.ok(todo, 'the todo is still created');
      assert.equal(store.getTodos().length, 1);
      assert.equal(store.isPersistent(), false);

      // The session keeps working after the failed write — §4.3 "Persisting".
      assert.equal(store.toggle(todo.id), true);
      assert.equal(store.getTodos()[0].done, true);
      assert.equal(store.remove(todo.id), true);
      assert.deepEqual(store.getTodos(), []);
    });
  });

  it('row 3: corrupt JSON starts empty, stays persistent, and does not crash', () => {
    withStore({ data: { [STORAGE_KEY]: '{not json at all' } }, (store) => {
      assert.deepEqual(store.getTodos(), []);
      assert.equal(store.isPersistent(), true);
      assert.ok(store.add('recovering'), 'the store is usable afterwards');
    });
  });

  it('row 3: valid JSON that is not an array starts empty and stays persistent', () => {
    for (const raw of ['{"todos":[]}', '"a string"', '42', 'null', 'true']) {
      withStore({ data: { [STORAGE_KEY]: raw } }, (store) => {
        assert.deepEqual(store.getTodos(), [], `stored value ${raw} should yield an empty store`);
        assert.equal(store.isPersistent(), true, `stored value ${raw} is a cache problem, not a storage one`);
      });
    }
  });

  it('row 4: malformed entries are dropped and the valid ones are kept', () => {
    const stored = seed([
      { id: 'ok-1', text: 'keep me', done: false, createdAt: 1 },
      { id: 42, text: 'id is not a string', done: false, createdAt: 2 },
      { id: 'no-text', done: false, createdAt: 3 },
      { id: 'bad-text', text: { nested: true }, done: false, createdAt: 4 },
      { id: 'bad-done', text: 'done is not a boolean', done: 'yes', createdAt: 5 },
      null,
      'a bare string',
      ['an array'],
      { id: 'ok-2', text: 'keep me too', done: true, createdAt: 9 },
    ]);

    withStore({ data: stored }, (store) => {
      assert.deepEqual(
        store.getTodos().map((t) => t.id),
        ['ok-1', 'ok-2'],
      );
      assert.deepEqual(
        store.getTodos().map((t) => t.text),
        ['keep me', 'keep me too'],
      );
      assert.equal(store.getRemainingCount(), 1);
      assert.equal(store.isPersistent(), true);
    });
  });

  it('row 5: without crypto.randomUUID the id falls back to timestamp+counter', () => {
    withoutCrypto(() => {
      withStore({}, (store) => {
        const first = store.add('one');
        const second = store.add('two');

        assert.match(first.id, /^\d+-\d+$/);
        assert.match(second.id, /^\d+-\d+$/);
        assert.notEqual(first.id, second.id);
      });
    });
  });

  it('row 6: remove with an unknown id returns false and changes nothing', () => {
    withStore({}, (store) => {
      store.add('one');
      store.add('two');

      const before = snapshot(store.getTodos());
      let notifications = 0;
      store.subscribe(() => {
        notifications++;
      });

      assert.equal(store.remove('nope'), false);
      assert.equal(snapshot(store.getTodos()), before);
      assert.equal(notifications, 0);
    });
  });
});

// ---------------------------------------------------------------------------
// The rest of the §4.2 surface
// ---------------------------------------------------------------------------

describe('§2.3 remove', () => {
  it('removes that todo and leaves the others in order', () => {
    withStore({}, (store) => {
      const a = store.add('alpha');
      const b = store.add('bravo');
      const c = store.add('charlie');

      assert.equal(store.remove(b.id), true);
      assert.deepEqual(
        store.getTodos().map((t) => t.id),
        [a.id, c.id],
      );
    });
  });
});

describe('§2.5 clearCompleted', () => {
  it('removes every done todo and returns how many went', () => {
    withStore({}, (store) => {
      const a = store.add('alpha');
      const b = store.add('bravo');
      const c = store.add('charlie');
      store.toggle(a.id);
      store.toggle(c.id);

      assert.equal(store.clearCompleted(), 2);
      assert.deepEqual(
        store.getTodos().map((t) => t.id),
        [b.id],
      );
    });
  });

  it('returns 0 and keeps everything when nothing is done', () => {
    withStore({}, (store) => {
      store.add('alpha');
      store.add('bravo');

      assert.equal(store.clearCompleted(), 0);
      assert.equal(store.getTodos().length, 2);
    });
  });
});

describe('§2.6 getRemainingCount', () => {
  it('counts only the todos that are not done', () => {
    withStore({}, (store) => {
      assert.equal(store.getRemainingCount(), 0);

      const a = store.add('alpha');
      store.add('bravo');
      store.add('charlie');
      assert.equal(store.getRemainingCount(), 3);

      store.toggle(a.id);
      assert.equal(store.getRemainingCount(), 2);

      store.remove(a.id);
      assert.equal(store.getRemainingCount(), 2);
    });
  });
});

describe('§4.2 subscribe', () => {
  it('notifies on every mutation and returns a working unsubscribe', () => {
    withStore({}, (store) => {
      const seen = [];
      const unsubscribe = store.subscribe(() => {
        seen.push(store.getTodos().length);
      });

      const todo = store.add('alpha');
      store.toggle(todo.id);
      store.add('bravo');
      store.remove(todo.id);
      store.clearCompleted();

      assert.deepEqual(seen, [1, 1, 2, 1]);
      assert.equal(typeof unsubscribe, 'function');

      unsubscribe();
      store.add('charlie');
      assert.deepEqual(seen, [1, 1, 2, 1], 'no further notifications after unsubscribe');
    });
  });

  it('supports several subscribers and an unsubscribe called twice', () => {
    withStore({}, (store) => {
      let first = 0;
      let second = 0;
      const off = store.subscribe(() => {
        first++;
      });
      store.subscribe(() => {
        second++;
      });

      store.add('alpha');
      assert.equal(first, 1);
      assert.equal(second, 1);

      off();
      off(); // idempotent — must not remove the other subscriber

      store.add('bravo');
      assert.equal(first, 1);
      assert.equal(second, 2);
    });
  });

  it('subscribers see the mutation that triggered them', () => {
    withStore({}, (store) => {
      let textAtNotify = null;
      store.subscribe(() => {
        textAtNotify = store.getTodos().at(-1).text;
      });

      store.add('read the spec');
      assert.equal(textAtNotify, 'read the spec');
    });
  });
});
