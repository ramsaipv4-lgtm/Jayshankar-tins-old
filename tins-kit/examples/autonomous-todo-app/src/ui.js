// src/ui.js — Focus: DOM rendering + event wiring.
//
// This module owns no application state (SPEC §4.1). Every todo lives in
// `src/store.js`; this file renders what the store reports and routes every
// user gesture back through the store's §4.2 API. The one thing it does hold is
// *view* state — which filter is showing — because the store has none: §4.2's
// `getVisible(filter)` takes the filter as an argument rather than remembering
// it, so somebody above the store has to.
//
// Rendering strategy: one `render()` reads the store and rewrites the parts of
// the shell it owns. It is subscribed to the store, so every mutation repaints
// exactly once and there is no second source of truth to drift.
//
// Behaviour: SPEC §2.1–§2.7. Rules: SPEC §3 (notably rule 1, no silent data
// loss, and rule 4, todo text is never markup). Accessibility: SPEC §6.
// Criteria: SPEC §8.6 and §8.7.

import { createStore } from './store.js';

/** @typedef {import('./store.js').Todo} Todo */
/** @typedef {'all'|'active'|'done'} Filter */

/* ------------------------------------------------------------------ shell */

/**
 * Resolve one of the shell's contract ids, or fail loudly.
 *
 * A missing hook means `index.html` and this file have drifted apart, which is
 * a build-time mistake, not a runtime condition SPEC §7 covers. Throwing here
 * surfaces it on the first load; returning null would scatter the same failure
 * across a dozen silent no-ops later.
 *
 * @param {string} id
 * @returns {HTMLElement}
 */
function mustGet(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`ui.js: required element #${id} is missing from index.html`);
  return el;
}

const form = /** @type {HTMLFormElement} */ (mustGet('new-todo-form'));
const input = /** @type {HTMLInputElement} */ (mustGet('new-todo-input'));
const list = mustGet('todo-list');
const remainingCount = mustGet('remaining-count');
const filters = mustGet('filters');
const clearCompleted = /** @type {HTMLButtonElement} */ (mustGet('clear-completed'));
const emptyState = mustGet('empty-state');
const storageNotice = mustGet('storage-notice');

/* ------------------------------------------------------------------- copy */

/**
 * SPEC §8.7 branch 1: no todos at all — offer the primary action. The action
 * itself is the add form directly above, so the offer points at it rather than
 * duplicating a second Add control inside a `<p>`.
 */
const EMPTY_NO_TODOS = 'Nothing here yet — add your first todo above.';

/**
 * SPEC §8.7 branch 2: todos exist, none match this filter — offer a hint. The
 * hint names the way out, because the whole point of D5 is that the missing
 * rows still exist and the user should not read an empty view as data loss.
 *
 * The `all` entry is unreachable while todos exist (`getVisible('all')` returns
 * everything) and is kept only so an unexpected filter value cannot produce a
 * blank message.
 */
const EMPTY_NO_MATCH = {
  all: 'No todos match this filter.',
  active: 'Nothing left to do — switch to All or Done to see what you finished.',
  done: 'Nothing finished yet — switch to All to see what is left.',
};

/* ------------------------------------------------------------- view state */

/** @type {Filter} The filter currently showing. View state, not app state. */
let filter = 'all';

const store = createStore();

/* --------------------------------------------------------------- helpers */

/**
 * Write text only when it actually changed.
 *
 * `#remaining-count` is an `aria-live` region (SPEC §6). Assigning an identical
 * string still mutates the DOM, and some assistive tech re-announces on
 * mutation rather than on change — so a re-render triggered by an unrelated
 * todo would read the same count out loud again.
 *
 * @param {HTMLElement} el
 * @param {string} text
 */
function setText(el, text) {
  if (el.textContent !== text) el.textContent = text;
}

/**
 * Build one row.
 *
 * The checkbox is wrapped in a `<label>` together with the text, which gives
 * the checkbox the todo's text as its accessible name without minting an `id`
 * per row. The text sits in its own `<span>` so the stylesheet has an element
 * to strike through — a bare text node could not be targeted (T3 notes §2.3).
 *
 * `textContent` throughout: todo text is untrusted and is never parsed as
 * markup (SPEC §3 rule 4).
 *
 * @param {Todo} todo
 * @returns {HTMLLIElement}
 */
function buildRow(todo) {
  const row = document.createElement('li');
  row.dataset.id = todo.id;
  // Done rows are marked with data-done. styles.css accepts three conventions;
  // this file uses exactly one, everywhere.
  row.dataset.done = todo.done ? 'true' : 'false';

  const label = document.createElement('label');

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = todo.done;
  checkbox.dataset.action = 'toggle';

  const text = document.createElement('span');
  text.textContent = todo.text;

  label.append(checkbox, text);

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.dataset.action = 'remove';
  remove.textContent = 'Delete';
  // SPEC §8.6: the delete control carries an accessible name. It names *which*
  // todo it deletes, because "Delete" repeated once per row tells a screen
  // reader user nothing. The visible word leads the name, so a voice-control
  // user saying "Delete" still matches (WCAG 2.5.3, label in name).
  remove.setAttribute('aria-label', `Delete: ${todo.text}`);

  row.append(label, remove);
  return row;
}

/**
 * Remember where focus was inside the list, so a full repaint does not strand a
 * keyboard user at the top of the document (SPEC §3 rule 3).
 *
 * Records the row's id *and* its index: after a toggle under the `active`
 * filter, or after a delete, the row that had focus is gone and the index is
 * the only sensible landing spot left.
 *
 * @returns {{ id: string, action: string, index: number }|null}
 */
function rememberFocus() {
  const active = document.activeElement;
  if (!(active instanceof Element) || !list.contains(active)) return null;

  const row = active.closest('li[data-id]');
  if (!row) return null;

  const action = active.matches('input[type="checkbox"]') ? 'toggle' : 'remove';
  return {
    id: /** @type {string} */ (row.getAttribute('data-id')),
    action,
    index: Array.prototype.indexOf.call(list.children, row),
  };
}

/**
 * Put focus back where `rememberFocus()` found it: the same control on the same
 * todo if it still exists, else the same control on whatever row took its
 * place, else the add field — which is where a user with an empty list wants to
 * be anyway.
 *
 * Rows are matched by walking `list.children` rather than with an attribute
 * selector, so an id containing selector-special characters cannot break the
 * lookup.
 *
 * @param {{ id: string, action: string, index: number }|null} memo
 */
function restoreFocus(memo) {
  if (!memo) return;

  let row = null;
  for (const child of list.children) {
    if (child.getAttribute('data-id') === memo.id) {
      row = child;
      break;
    }
  }
  if (!row && list.children.length > 0) {
    row = list.children[Math.min(memo.index, list.children.length - 1)];
  }

  const selector = memo.action === 'toggle' ? 'input[type="checkbox"]' : 'button[data-action="remove"]';
  const target = row ? row.querySelector(selector) : null;

  if (target instanceof HTMLElement) target.focus();
  else input.focus();
}

/* ---------------------------------------------------------------- render */

/**
 * Repaint everything this module owns from the store's current state.
 *
 * Called once at startup and once per store notification. It reads; it never
 * writes to the store.
 */
function render() {
  const memo = rememberFocus();

  const todos = store.getTodos();
  const visible = store.getVisible(filter);
  const doneCount = todos.length - store.getRemainingCount();

  // --- the list (SPEC §8.6: exactly one row per visible todo)
  const fragment = document.createDocumentFragment();
  for (const todo of visible) fragment.append(buildRow(todo));
  list.replaceChildren(fragment);

  // --- the counter (SPEC §2.6)
  setText(remainingCount, `${store.getRemainingCount()} remaining`);

  // --- the filters (SPEC §2.4; T3 notes §2.8 asks for aria-pressed in sync)
  for (const button of filters.querySelectorAll('button[data-filter]')) {
    button.setAttribute('aria-pressed', button.getAttribute('data-filter') === filter ? 'true' : 'false');
  }

  // --- the empty state (SPEC §2.7, §8.7)
  if (visible.length > 0) {
    emptyState.hidden = true;
  } else {
    setText(
      emptyState,
      todos.length === 0
        ? EMPTY_NO_TODOS
        : EMPTY_NO_MATCH[filter] || EMPTY_NO_MATCH.all,
    );
    emptyState.hidden = false;
  }

  // --- clear completed (SPEC §2.5)
  // Disabled with nothing to clear: it states plainly that the action is
  // unavailable rather than presenting a control that silently does nothing.
  // If it is disabled out from under a keyboard user who just used it, focus
  // would fall to <body>; move it somewhere useful instead (SPEC §3 rule 3).
  const disableClear = doneCount === 0;
  const clearHadFocus = document.activeElement === clearCompleted;
  clearCompleted.disabled = disableClear;
  if (disableClear && clearHadFocus) input.focus();

  // --- the storage notice (SPEC §3 rule 2, §7 rows 1-2)
  // Read on every render, not just at startup: a write can fail mid-session and
  // flip isPersistent() to false long after load (T1 notes §5).
  storageNotice.hidden = store.isPersistent();

  restoreFocus(memo);
}

/* ----------------------------------------------------------------- wiring */

// SPEC §2.1 — add a todo.
form.addEventListener('submit', (event) => {
  event.preventDefault();
  const created = store.add(input.value);

  // Only a successful add clears the field. §2.1 promises the clear on success
  // and says a whitespace-only submit is rejected "without creating anything
  // and without an error dialog" — it does not ask for the field to be wiped,
  // and wiping it would discard what the user typed with no explanation.
  if (created) input.value = '';

  // Back to the field either way, so a run of todos can be typed without
  // reaching for the mouse.
  input.focus();
});

// SPEC §2.2 — toggle. Delegated, so rows rebuilt by render() need no rebinding.
list.addEventListener('change', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (target.dataset.action !== 'toggle') return;

  const row = target.closest('li[data-id]');
  if (!row) return;
  store.toggle(/** @type {string} */ (row.getAttribute('data-id')));
});

// SPEC §2.3 — remove one todo.
list.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const button = target.closest('button[data-action="remove"]');
  if (!button || !list.contains(button)) return;

  const row = button.closest('li[data-id]');
  if (!row) return;
  store.remove(/** @type {string} */ (row.getAttribute('data-id')));
});

// SPEC §2.4 — filter. Changes the view only; the collection is untouched (D5).
filters.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const button = target.closest('button[data-filter]');
  if (!button || !filters.contains(button)) return;

  const next = button.getAttribute('data-filter');
  if (next !== 'all' && next !== 'active' && next !== 'done') return;
  if (next === filter) return;

  filter = next;
  render();
});

// SPEC §2.5 — clear completed, guarded by SPEC §3 rule 1.
//
// Rule 1 allows a destructive action to be *either* reversible *or* explicitly
// confirmed. Reversible is not available to this file: an undo buffer would be
// application state, and §4.1 forbids ui.js from holding any; §9 rules out an
// undo stack; and the store's §4.2 surface — which this task must not change —
// offers no restore. So confirmation is the only compliant path, and the "or"
// collapses to one branch.
//
// The prompt names the count, because under the `active` filter every todo this
// button is about to destroy is off screen. That is precisely the "side effect
// of something the user was not asking for" rule 1 exists to prevent.
clearCompleted.addEventListener('click', () => {
  const doneCount = store.getTodos().length - store.getRemainingCount();
  if (doneCount === 0) return;

  const noun = doneCount === 1 ? 'todo' : 'todos';
  const confirmed = window.confirm(
    `Delete ${doneCount} completed ${noun}? This cannot be undone.`,
  );
  if (!confirmed) return;

  store.clearCompleted();
});

/* ------------------------------------------------------------------ start */

store.subscribe(render);
render();
