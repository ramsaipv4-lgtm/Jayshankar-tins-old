// src/store.js — Focus: state + persistence.
//
// The authoritative in-memory store for the session. `localStorage` is a cache
// (SPEC §0.2 D3): read once at startup, written after every mutation, and never
// allowed to fail the app.
//
// This module must not touch the DOM (SPEC §4.1). The only global it reaches
// for is `localStorage`, and every access is guarded for absence — the module
// has to load in Node (`node --test`) where there is no web storage at all.
//
// Interface contract: SPEC §4.2. Algorithms: SPEC §4.3. Failures: SPEC §7.

/** @typedef {{ id: string, text: string, done: boolean, createdAt: number }} Todo */
/** @typedef {'all'|'active'|'done'} Filter */

/** The single localStorage key this app owns. */
export const STORAGE_KEY = 'focus.todos.v1';

/**
 * Module-level so two stores created in the same millisecond cannot mint the
 * same fallback id (SPEC §4.3 writes `counter++` without naming its scope).
 */
let idCounter = 0;

/**
 * Resolve web storage, or null when it is unavailable.
 *
 * Looked up on every access rather than captured once: the global can be absent
 * at module-load time and present later (a test installing a fake), and reading
 * the property itself throws in browsers configured to block site data.
 *
 * @returns {Storage|null}
 */
function getStorage() {
  try {
    const storage = globalThis.localStorage;
    return storage ? storage : null;
  } catch {
    return null;
  }
}

/**
 * `crypto.randomUUID()` when available, else the timestamp+counter fallback
 * (SPEC §4.3, SPEC §7 row 5). `crypto.randomUUID` is undefined in insecure
 * browser contexts, which is exactly the case that fallback exists for.
 *
 * @returns {string}
 */
function makeId() {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `${Date.now()}-${idCounter++}`;
}

/**
 * Keep only entries with a string `id`, a string `text`, and a boolean `done`;
 * drop the rest silently (SPEC §4.3 "Loading at startup" step 4, SPEC §7 row 4).
 *
 * Survivors are normalised to the four fields of the Todo typedef so nothing a
 * corrupt cache carries leaks into the collection. `text` is authored data and
 * is copied through untouched (SPEC §0.2 D4).
 *
 * @param {unknown[]} entries
 * @returns {Todo[]}
 */
function keepValid(entries) {
  const out = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    const { id, text, done, createdAt } = /** @type {any} */ (entry);
    if (typeof id !== 'string') continue;
    if (typeof text !== 'string') continue;
    if (typeof done !== 'boolean') continue;
    out.push({
      id,
      text,
      done,
      createdAt: typeof createdAt === 'number' && Number.isFinite(createdAt)
        ? createdAt
        : Date.now(),
    });
  }
  return out;
}

/**
 * Read the cache once (SPEC §4.3 "Loading at startup").
 *
 * A read that throws means storage is unusable, so the session runs in memory
 * and says so. Corrupt or non-array JSON is a cache problem, not a storage
 * problem: start empty but stay persistent (SPEC §7 rows 1 and 3).
 *
 * The corrupt value is deliberately left in storage rather than overwritten
 * here — nothing has been mutated yet, and erasing a user's data as a side
 * effect of a read is exactly what SPEC §3 rule 1 forbids. The first real
 * mutation replaces it.
 *
 * @returns {{ todos: Todo[], persistent: boolean }}
 */
function load() {
  const storage = getStorage();
  if (!storage) return { todos: [], persistent: false };

  let raw;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { todos: [], persistent: false };
  }

  if (raw === null || raw === undefined) return { todos: [], persistent: true };

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { todos: [], persistent: true };
  }

  if (!Array.isArray(parsed)) return { todos: [], persistent: true };
  return { todos: keepValid(parsed), persistent: true };
}

/**
 * Creates a store. Loads persisted todos if storage is readable.
 *
 * @returns {{
 *   getTodos: () => Todo[],
 *   getVisible: (filter: Filter) => Todo[],
 *   getRemainingCount: () => number,
 *   add: (text: string) => Todo | null,
 *   toggle: (id: string) => boolean,
 *   remove: (id: string) => boolean,
 *   clearCompleted: () => number,
 *   isPersistent: () => boolean,
 *   subscribe: (fn: () => void) => () => void,
 * }}
 */
export function createStore() {
  const initial = load();

  /** @type {Todo[]} */
  let todos = initial.todos;
  let persistent = initial.persistent;
  /** @type {Array<() => void>} */
  const subscribers = [];

  /**
   * Serialise and write. A failed write never costs the session its work
   * (SPEC §4.3 "Persisting", SPEC §7 row 2).
   *
   * `persistent` is one-way: once a read or write has failed, it stays false
   * for the life of the store. SPEC §3 rule 2 asks for a *persistent* notice,
   * and a flag that flips back on the next successful write would flicker it.
   * Writes keep being attempted regardless — giving up on writing would turn a
   * transient quota error into permanent data loss.
   */
  function persist() {
    const storage = getStorage();
    if (!storage) {
      persistent = false;
      return;
    }
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(todos));
    } catch {
      persistent = false;
    }
  }

  /**
   * Notify subscribers. Iterates a snapshot so a subscriber that unsubscribes
   * (or subscribes) inside its own callback cannot corrupt the walk.
   *
   * Exceptions are not swallowed: a throwing subscriber is a bug in the
   * renderer, and hiding it here would make a broken UI look like a broken
   * store.
   */
  function notify() {
    for (const fn of subscribers.slice()) fn();
  }

  /**
   * All todos, insertion order. A fresh array each call, so a caller cannot
   * splice the collection out from under the store (SPEC §8.4). The Todo
   * objects themselves are shared — `add()` hands one back by design.
   *
   * @returns {Todo[]}
   */
  function getTodos() {
    return todos.slice();
  }

  /**
   * Filtered view. Never mutates the collection (SPEC §0.2 D5: filtering hides,
   * it never deletes). Anything other than 'active' or 'done' shows everything
   * — an unrecognised filter that hid every row would read to a user as data
   * loss, which is the failure D5 exists to prevent.
   *
   * @param {Filter} filter
   * @returns {Todo[]}
   */
  function getVisible(filter) {
    if (filter === 'active') return todos.filter((t) => !t.done);
    if (filter === 'done') return todos.filter((t) => t.done);
    return todos.slice();
  }

  /**
   * Count of todos still to do.
   *
   * @returns {number}
   */
  function getRemainingCount() {
    let n = 0;
    for (const t of todos) if (!t.done) n++;
    return n;
  }

  /**
   * Add a todo (SPEC §4.3 "Adding a todo"). Empty or whitespace-only text
   * creates nothing and throws nothing. A non-string argument is treated the
   * same way, for the same reason.
   *
   * @param {string} text
   * @returns {Todo|null}
   */
  function add(text) {
    const trimmed = typeof text === 'string' ? text.trim() : '';
    if (trimmed === '') return null;

    /** @type {Todo} */
    const todo = {
      id: makeId(),
      text: trimmed,
      done: false,
      createdAt: Date.now(),
    };
    todos.push(todo);
    persist();
    notify();
    return todo;
  }

  /**
   * Flip a todo's done state. An unknown id changes nothing and returns false
   * (SPEC §7 row 6) — and therefore neither persists nor notifies.
   *
   * @param {string} id
   * @returns {boolean}
   */
  function toggle(id) {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return false;
    todo.done = !todo.done;
    persist();
    notify();
    return true;
  }

  /**
   * Remove a todo. An unknown id changes nothing and returns false
   * (SPEC §7 row 6).
   *
   * @param {string} id
   * @returns {boolean}
   */
  function remove(id) {
    const index = todos.findIndex((t) => t.id === id);
    if (index === -1) return false;
    todos.splice(index, 1);
    persist();
    notify();
    return true;
  }

  /**
   * Remove every done todo at once.
   *
   * @returns {number} how many were removed
   */
  function clearCompleted() {
    const kept = todos.filter((t) => !t.done);
    const removed = todos.length - kept.length;
    if (removed === 0) return 0;
    todos = kept;
    persist();
    notify();
    return removed;
  }

  /**
   * False when storage is unavailable, or when a read or write has failed
   * (SPEC §0.2 D3, SPEC §3 rule 2).
   *
   * @returns {boolean}
   */
  function isPersistent() {
    return persistent;
  }

  /**
   * Subscribe to mutations. Safe to call the returned unsubscribe more than
   * once.
   *
   * @param {() => void} fn
   * @returns {() => void} unsubscribe
   */
  function subscribe(fn) {
    subscribers.push(fn);
    let active = true;
    return function unsubscribe() {
      if (!active) return;
      active = false;
      const index = subscribers.indexOf(fn);
      if (index !== -1) subscribers.splice(index, 1);
    };
  }

  return {
    getTodos,
    getVisible,
    getRemainingCount,
    add,
    toggle,
    remove,
    clearCompleted,
    isPersistent,
    subscribe,
  };
}
