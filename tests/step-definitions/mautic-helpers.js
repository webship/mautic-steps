'use strict';

// Shared plumbing of the steps: addresses, opening a page and waiting for the
// site's own signals, the messages it answers with, its confirmations and
// dialogs, the fields of its forms, its lists, the users registry and the
// session cache, work done as the managing account in a browser of its own,
// and the mail catcher.
//
// This file registers no step (but the two hooks at its end).
//
// The administration is a page that loads its parts by Ajax: a link of the
// menu, a save, a search of a list or a dialog replaces a part of the page in
// place. While a request runs the site shows its loading bar (`.loading-bar`
// gets the class `active`) and jQuery counts it (`mQuery.active`). The steps
// wait for both to fall back, never for a fixed time. Its messages ("… has
// been created!") come in `#flashes` and close themselves after four seconds:
// a script the pack adds to every page records each one as it comes, so a
// step reads it even when it is already gone.

const { Before } = require('@cucumber/cucumber');
const { gotoUrl, friendly, onNewPage } = require('webship-js/tests/step-definitions/webship');

// ---------------------------------------------------------------------------
// Budgets and text
// ---------------------------------------------------------------------------

/** The per-assertion wait budget: `minWaitTime.page` from cucumber.js, at least 10 seconds. */
function budget(world) {
  return Math.max((world && world.minWaitTime && world.minWaitTime.page) || 0, 10000);
}

/** How long a step waits for the site's scheduled tasks (segments, campaigns): 180 seconds, or SCHEDULED_TASKS_TIMEOUT. */
function scheduledBudget() {
  return Number(process.env.SCHEDULED_TASKS_TIMEOUT || 180) * 1000;
}

/** White space collapsed and trimmed; the invisible marks some texts carry removed. */
function clean(text) {
  return String(text === null || text === undefined ? '' : text).replace(/[­​-‏‪-‮⁠﻿]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * A text as a comparison sees it: cleaned, in lower case, the typographic quotes
 * and apostrophes the same as the straight ones, a closing required mark ("Name *")
 * and a closing colon dropped.
 */
function normal(text) {
  return clean(text).replace(/[“”„"]/g, '"').replace(/[‘’‚']/g, "'").replace(/["']/g, "'").replace(/\s*\*$/, '').replace(/\s*:$/, '').replace(/\s*\*$/, '').toLowerCase();
}

/** Whether a text contains another, as `normal` reads them. */
function mentions(text, part) {
  return normal(text).includes(normal(part));
}

/** A list for an error message: `"a", "b", "c"` or `(none)`. */
function listed(values) {
  const items = [...new Set((values || []).map(clean).filter(Boolean))];
  return items.length ? items.map((item) => `"${item}"`).join(', ') : '(none)';
}

/** Escape a literal string for use in a RegExp. */
function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The rows of a data table as [label, value] pairs (a table of two columns, without a header). */
function pairs(table) {
  if (!table) return [];
  return table.raw().map((row) => [clean(row[0]), row.length > 1 ? String(row[1]) : '']);
}

// ---------------------------------------------------------------------------
// Addresses
// ---------------------------------------------------------------------------

/** The site's root without a trailing slash. */
function siteRoot(world) {
  return String(world.launchUrl || (world.parameters && world.parameters.launchUrl) || '').replace(/\/+$/, '');
}

/** An address of the site from a path (absolute URLs stay as they are). */
function absolute(world, href) {
  if (/^https?:\/\//.test(href)) return href;
  return siteRoot(world) + (String(href).startsWith('/') ? '' : '/') + href;
}

/** The path of an address of the site, with its query string. */
function pathOf(world, url) {
  try {
    const u = new URL(url, siteRoot(world) + '/');
    return u.pathname + u.search;
  } catch (err) {
    return String(url);
  }
}

// ---------------------------------------------------------------------------
// The request the browser cut, opening a page, waiting
// ---------------------------------------------------------------------------

/**
 * Whether the browser shows its own error page instead of the site's answer:
 * Chromium aborts every request in flight when the network of the machine
 * changes (a container starting or stopping on it). Returns a sentence, or ''.
 */
function cutRequest(page) {
  const url = String((page && page.url()) || '');
  return url.startsWith('chrome-error://') ? `the browser shows its own error page (${url}): the request was cut before the site answered` : '';
}

/** The hint of a failure where the browser cut the request. */
const CUT_HINT = 'The request was cut because the network of the machine changed (a container starting); nothing is wrong with the scenario. Run it again. On a shared machine, run the suite in the project\'s container (cmd-tools-testing.sh <project> --run in the Webship Workspace).';

/** The hint for a failure: the cut request's when the browser cut it, else the one given. */
function hintFor(page, hint) {
  return cutRequest(page) ? CUT_HINT : hint;
}

/**
 * Wait until the site is quiet: the document has loaded, the loading bar is
 * off, jQuery runs no request, no route is in progress, and no dialog is
 * loading its content.
 */
async function settle(page, timeout) {
  const limit = timeout || 15000;
  await page.waitForLoadState('load', { timeout: limit }).catch(() => {});
  await page.waitForFunction(() => {
    if (document.readyState !== 'complete') return false;
    const bar = document.querySelector('.loading-bar');
    if (bar && bar.classList.contains('active')) return false;
    if (window.mQuery && window.mQuery.active > 0) return false;
    if (window.MauticVars && window.MauticVars.routeInProgress) return false;
    if (document.querySelector('.modal.in .modal-loading-bar.active')) return false;
    return true;
  }, null, { timeout: limit, polling: 100 }).catch(() => {});
}

/**
 * Open a URL in a page and wait for the site to be quiet. A network change on
 * the machine aborts a navigation once now and then: the step goes again, once.
 *
 * @returns {Promise<import('playwright').Response|null>} the answer of the server.
 */
async function openIn(page, url, timeout) {
  const go = () => page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeout || 60000 });
  let response = null;
  // The connection the machine cut (its network changed, or the containers' router started again for another
  // project): the step goes again for up to 30 seconds, then reports it in webship-js's own words.
  const CUT = /ERR_NETWORK_CHANGED|ERR_CONNECTION_RESET|ERR_CONNECTION_CLOSED|ERR_CONNECTION_REFUSED|ERR_EMPTY_RESPONSE|chrome-error:\/\/chromewebdata|ERR_ABORTED|frame was detached/;
  const deadline = Date.now() + 30000;
  for (;;) {
    try {
      response = await go();
      break;
    } catch (err) {
      if (!CUT.test(String(err && err.message)) || Date.now() > deadline) {
        // webship-js's own words for a refused connection or an unknown host.
        await gotoUrl(page, url);
        break;
      }
      await page.waitForTimeout(1000);
    }
  }
  if (cutRequest(page)) {
    await page.waitForTimeout(500);
    response = await go().catch(() => null);
  }
  await settle(page, timeout);
  return response;
}

/** Open a path of the site in the scenario's page. */
async function open(world, path) {
  const response = await openIn(world.page, absolute(world, path), budget(world) * 3);
  world.__lastStatus = response ? response.status() : null;
  return response;
}

/**
 * Run an action that sends a form or follows a link (the page may load again,
 * or a part of it), and wait for the site to be quiet again.
 */
async function act(page, fn, timeout) {
  await Promise.all([
    page.waitForLoadState('load', { timeout: timeout || 30000 }).catch(() => {}),
    fn(),
  ]);
  // A request starts a moment after the click.
  await page.waitForTimeout(150);
  await settle(page, timeout || 30000);
}

/** Poll a reading until it satisfies a check, or fail with the last reading. */
async function eventually(page, read, check, explain, timeout) {
  const deadline = Date.now() + (timeout || 10000);
  let value;
  for (;;) {
    value = await read();
    if (check(value)) return value;
    if (Date.now() > deadline) throw friendly(await explain(value));
    await page.waitForTimeout(150);
  }
}

// ---------------------------------------------------------------------------
// What the page says about itself
// ---------------------------------------------------------------------------

/** The heading of the administration page (its title), or the main heading of a public page. */
async function heading(page) {
  return clean(await page.evaluate(() => {
    const h = document.querySelector('#app-content h1.page-header-title') || document.querySelector('#app-content h1') || document.querySelector('h1');
    return h ? h.textContent : '';
  }).catch(() => ''));
}

/** What the page on screen says about itself, for an error message. */
async function pageSummary(page, world) {
  const cut = cutRequest(page);
  if (cut) return cut;
  const title = clean(await page.title().catch(() => ''));
  const h = await heading(page);
  const said = await messages(page);
  const path = world ? pathOf(world, page.url()) : page.url();
  return `the page shows "${h || '(no heading)'}" (title "${title}") at ${path}${said.length ? `, and says ${listed(said.map((m) => m.text))}` : ''}`;
}

/** Whether the page is the site's refusal: HTTP 403, "Tsk tsk. Apparently you don't have access to this area." */
async function isRefusal(page) {
  return page.evaluate(() => document.title === 'Forbidden' || /Apparently you don't have access to this area/.test(document.body ? document.body.innerText : '')).catch(() => false);
}

/** Whether the page is the login page. */
async function isLoginPage(page) {
  return page.evaluate(() => !!document.querySelector('form[name="login"] #username')).catch(() => false);
}

// ---------------------------------------------------------------------------
// Messages: the flashes (recorded as they come) and the alerts of a page
// ---------------------------------------------------------------------------

/** The script every page gets: it records each message the site shows in #flashes, with when and of what kind. */
const FLASH_RECORDER = `(() => {
  if (window.__wsFlashRecorder) return;
  window.__wsFlashRecorder = true;
  window.__wsFlashes = [];
  const record = () => {
    document.querySelectorAll('#flashes .alert').forEach((el) => {
      if (el.__wsSeen) return;
      const text = (el.textContent || '').replace(/\\s+/g, ' ').trim();
      if (!text) return;
      el.__wsSeen = true;
      window.__wsFlashes.push({ text, error: el.classList.contains('alert-growl--error') || el.classList.contains('alert-danger'), at: Date.now() });
    });
  };
  const start = () => {
    record();
    new MutationObserver(record).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();`;

/** Give a page the recorder: for its next documents, and for the one it shows now. */
async function recordFlashes(page) {
  if (!page || page.__wsRecorder) return;
  page.__wsRecorder = true;
  await page.addInitScript(FLASH_RECORDER).catch(() => {});
  await page.evaluate(FLASH_RECORDER).catch(() => {});
}

/**
 * The messages of the page: the flashes recorded on the document on screen (even
 * the ones that already closed), those on screen, and the alerts of a page that
 * is not the administration (the login and password pages).
 *
 * @returns {Promise<Array<{text: string, error: boolean}>>}
 */
async function messages(page) {
  return page.evaluate(() => {
    const seen = new Map();
    for (const f of window.__wsFlashes || []) seen.set(f.text, { text: f.text, error: f.error });
    document.querySelectorAll('#flashes .alert, .alert-danger, .alert-warning, .alert-info, .alert-success').forEach((el) => {
      if (el.closest('.modal') && !el.closest('.modal.in')) return;
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (text && !seen.has(text)) seen.set(text, { text, error: el.classList.contains('alert-growl--error') || el.classList.contains('alert-danger') });
    });
    return [...seen.values()];
  }).catch(() => []);
}

/** Wait for the site to say a text (a message or an alert of the page), or fail with what it says instead. */
async function expectMessage(world, expected, hint) {
  const page = world.page;
  return eventually(page, () => messages(page), (all) => all.some((m) => mentions(m.text, expected)), async (all) => ({
    message: `The site did not say "${expected}". ${all.length ? `It says ${listed(all.map((m) => m.text))}` : `It shows no message; ${await pageSummary(page, world)}`}.`,
    hint: hintFor(page, hint || 'The site answers a save, a delete or a refusal with a message at the top of the page; it closes itself after four seconds, and the pack records it as it comes.'),
  }), budget(world));
}

// ---------------------------------------------------------------------------
// Confirmations and dialogs
// ---------------------------------------------------------------------------

/** The confirmation the site asks before it deletes ("Delete this contact?"), or null. */
async function confirmation(page) {
  return page.evaluate(() => {
    const box = [...document.querySelectorAll('.modal.confirmation-modal')].find((m) => getComputedStyle(m).display !== 'none');
    if (!box) return null;
    const t = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '');
    return { question: t(box.querySelector('.modal-title')), buttons: [...box.querySelectorAll('button')].map(t).filter(Boolean) };
  }).catch(() => null);
}

/** Wait for the confirmation and answer it with one of its buttons ("Delete", "Cancel"). */
async function answerConfirmation(world, page, answer) {
  const asked = await eventually(page, () => confirmation(page), (c) => !!c, async () => ({
    message: `The site asked for no confirmation: ${await pageSummary(page, world)}.`,
    hint: hintFor(page, 'The site asks before it deletes ("Delete this contact?") in a small dialog with the buttons Cancel and Delete.'),
  }), budget(world));
  const box = page.locator('.modal.confirmation-modal.in').last();
  const button = box.locator('button').filter({ hasText: new RegExp(`^\\s*${escapeRegExp(answer)}\\s*$`, 'i') }).first();
  if (!(await button.count())) {
    throw friendly({ message: `The confirmation "${asked.question}" has no button "${answer}". It offers ${listed(asked.buttons)}.`, hint: 'Answer it with one of its buttons, as written.' });
  }
  await act(page, () => button.click());
  await page.waitForFunction(() => ![...document.querySelectorAll('.modal.confirmation-modal')].some((m) => getComputedStyle(m).display !== 'none'), null, { timeout: budget(world) }).catch(() => {});
  await settle(page);
  return asked;
}

/** The dialog that is open (the topmost `.modal.in`, not a confirmation), its title and its locator, or null. */
async function openDialog(page) {
  const info = await page.evaluate(() => {
    const boxes = [...document.querySelectorAll('.modal')].filter((m) => m.classList.contains('in') && getComputedStyle(m).display !== 'none' && !m.classList.contains('confirmation-modal'));
    if (!boxes.length) return null;
    const box = boxes[boxes.length - 1];
    const title = box.querySelector('.modal-title, .modal-body h3, h3, h4');
    return { id: box.id || '', title: title ? title.textContent.replace(/\s+/g, ' ').trim() : '' };
  }).catch(() => null);
  if (!info) return null;
  const locator = info.id ? page.locator(`#${info.id}`) : page.locator('.modal.in:not(.confirmation-modal)').last();
  return { ...info, locator };
}

/** Wait for a dialog to open (with a title, when given), and return it. */
async function waitForDialog(world, page, title) {
  return eventually(page, () => openDialog(page), (d) => !!d && (!title || mentions(d.title, title)), async (d) => ({
    message: d ? `The dialog "${d.title}" is open, not "${title}".` : `No dialog opened${title ? ` titled "${title}"` : ''}: ${await pageSummary(page, world)}.`,
    hint: hintFor(page, 'The site opens its forms of one thing (a note, a quick add, a field, an action) in a dialog over the page.'),
  }), budget(world));
}

/** Wait until no dialog is open (a confirmation aside). */
async function dialogClosed(page, timeout) {
  await page.waitForFunction(() => ![...document.querySelectorAll('.modal')].some((m) => m.classList.contains('in') && getComputedStyle(m).display !== 'none' && !m.classList.contains('confirmation-modal')), null, { timeout: timeout || 15000 }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Fields of a form, found by their label
// ---------------------------------------------------------------------------

/** Where the fields are looked for: the open dialog, else the page's content, else the whole page. */
async function fieldScope(page) {
  const dialog = await openDialog(page);
  if (dialog) return dialog.locator;
  if (await page.locator('#app-content').count()) return page.locator('#app-content');
  return page.locator('body');
}

/**
 * Find a field by its label, as a person reads it (letter case, a closing colon and
 * the required mark aside), in the open dialog or the page. The field may sit in a
 * tab that is not shown: its tab is opened first.
 *
 * @returns {Promise<{kind: string, id: string, label: string}|null>}
 */
async function findField(page, scope, label) {
  const handle = await scope.elementHandle().catch(() => null);
  if (!handle) return null;
  return page.evaluate(({ root, wanted }) => {
    const norm = (t) => String(t || '').replace(/\s+/g, ' ').trim().replace(/\s*\*$/, '').replace(/\s*:$/, '').replace(/\s*\*$/, '').toLowerCase();
    const want = norm(wanted);
    const textOf = (el) => {
      const copy = el.cloneNode(true);
      copy.querySelectorAll('i, .help-block, .text-danger').forEach((e) => e.remove());
      return norm(copy.textContent);
    };
    let n = 0;
    const tag = (el) => { if (!el.dataset.wsField) el.dataset.wsField = `wsf-${Date.now()}-${n += 1}`; return el.dataset.wsField; };
    const describe = (el, labelText) => {
      if (!el) return null;
      const group = el.closest('.form-group, .row') || el.parentElement;
      if (el.matches('label.toggle__label[role="switch"]')) return { kind: 'switch', id: tag(el), label: labelText };
      if (el.tagName === 'SELECT') {
        const chosen = el.id ? document.getElementById(`${el.id}_chosen`) : null;
        return { kind: chosen ? (el.multiple ? 'chosen-multi' : 'chosen') : (el.multiple ? 'select-multi' : 'select'), id: tag(el), label: labelText };
      }
      if (el.tagName === 'TEXTAREA') {
        const editor = el.parentElement && el.parentElement.querySelector('.ck-editor__editable');
        if (editor && getComputedStyle(el).display === 'none') return { kind: 'editor', id: tag(editor), label: labelText };
        return { kind: 'text', id: tag(el), label: labelText };
      }
      if (el.tagName === 'INPUT') {
        if (el.type === 'radio') return { kind: 'radio', id: tag(group || el), label: labelText };
        if (el.type === 'checkbox') return { kind: 'checkbox', id: tag(el), label: labelText };
        if (el.type === 'hidden') return null;
        return { kind: 'text', id: tag(el), label: labelText };
      }
      return null;
    };
    const fieldIn = (group) => {
      if (!group) return null;
      return group.querySelector('label.toggle__label[role="switch"]')
        || group.querySelector('select')
        || group.querySelector('textarea')
        || group.querySelector('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"])')
        || group.querySelector('input[type="radio"]')
        || group.querySelector('input[type="checkbox"]');
    };
    const labels = [...root.querySelectorAll('label, .control-label')].filter((l) => !l.matches('label.toggle__label'));
    for (const l of labels) {
      if (textOf(l) !== want) continue;
      let field = null;
      const forId = l.getAttribute('for');
      if (forId) field = document.getElementById(forId);
      if (field && field.type === 'hidden') field = null;
      if (!field || (field.tagName === 'INPUT' && field.type === 'radio')) {
        const group = l.closest('.form-group') || l.parentElement;
        field = fieldIn(group) || field;
      }
      const found = describe(field, l.textContent.replace(/\s+/g, ' ').trim());
      if (found) {
        const pane = l.closest('.tab-pane');
        found.pane = pane && !pane.classList.contains('active') ? pane.id : '';
        return found;
      }
    }
    // An input named by its placeholder or its aria-label (a field without a label of its own).
    for (const el of root.querySelectorAll('input, textarea')) {
      if ([el.getAttribute('placeholder'), el.getAttribute('aria-label')].some((t) => t && norm(t) === want)) {
        const found = describe(el, wanted);
        if (found) { found.pane = ''; return found; }
      }
    }
    return null;
  }, { root: handle, wanted: label });
}

/** The labels of the fields in a scope, for an error message. */
async function fieldLabels(scope) {
  return scope.locator('label.control-label, label[for]').evaluateAll((els) => els.map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim().replace(/\s*\*$/, '')).filter(Boolean)).catch(() => []);
}

/** The field a step names, its tab opened when it is hidden in one; fails with the labels the form has. */
async function field(world, label) {
  const page = world.page;
  const scope = await fieldScope(page);
  const found = await eventually(page, () => findField(page, scope, label), (f) => !!f, async () => ({
    message: `No field labelled "${label}" on ${await pageSummary(page, world)}. The form has ${listed(await fieldLabels(scope))}.`,
    hint: 'Name the field by its label, as the form writes it (letter case and the required mark aside). A dialog that is open is searched first.',
  }), 5000);
  if (found.pane) {
    const tab = scope.locator(`a[href="#${found.pane}"], [data-target="#${found.pane}"]`).first();
    if (await tab.count()) {
      await tab.click();
      await page.waitForTimeout(250);
    }
  }
  return { ...found, locator: page.locator(`[data-ws-field="${found.id}"]`) };
}

/** Choose an option of a list made with the site's searchable picker (single or multiple), by its text. */
async function chooseOption(world, f, value, { create = false } = {}) {
  const page = world.page;
  const select = f.locator;
  const id = await select.getAttribute('id');
  const container = page.locator(`#${id}_chosen`);
  const options = await select.evaluate((s) => [...s.options].map((o) => o.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean));
  const wanted = normal(value);
  const exact = options.find((o) => normal(o) === wanted);
  const near = exact || options.find((o) => normal(o).startsWith(wanted)) || options.find((o) => normal(o).includes(wanted));
  if (!near && !create) {
    throw friendly({ message: `The list "${f.label}" has no option "${value}". It offers ${listed(options.slice(0, 40))}${options.length > 40 ? ` and ${options.length - 40} more` : ''}.`, hint: 'Name an option of the list as it is written.' });
  }
  if (f.kind === 'chosen-multi') {
    await container.locator('.chosen-choices').click();
    const input = container.locator('.chosen-search-input, input').first();
    await input.pressSequentially(near ? near.slice(0, 60) : value, { delay: 15 });
  } else {
    await container.locator('.chosen-single, a').first().click();
    const input = container.locator('.chosen-search input, .chosen-search-input').first();
    if (await input.isVisible().catch(() => false)) await input.pressSequentially((near || value).slice(0, 60), { delay: 15 });
  }
  const results = container.locator('.chosen-results li.active-result');
  const pick = near ? results.filter({ hasText: new RegExp(`^\\s*${escapeRegExp(clean(near))}\\s*$`) }).first() : null;
  if (pick && await pick.count()) {
    await pick.click();
  } else if (pick && await results.first().count()) {
    await results.first().click();
  } else {
    // A value the list does not hold yet (a new tag): the picker makes it on Enter.
    await page.keyboard.press('Enter');
  }
  await settle(page);
  const chosen = await select.evaluate((s) => [...s.selectedOptions].map((o) => o.textContent.replace(/\s+/g, ' ').trim()));
  if (!chosen.some((c) => normal(c) === normal(near || value) || mentions(c, value))) {
    throw friendly({ message: `"${value}" was not chosen in the list "${f.label}": it holds ${listed(chosen)}.`, hint: 'The list is a searchable picker: the step types the option and clicks it.' });
  }
}

/** Set a field the way a person does, by its label: type in a text field or the editor, pick in a list, turn a switch, choose a radio button. */
async function setField(world, label, value) {
  const page = world.page;
  const f = await field(world, label);
  const loc = f.locator;
  switch (f.kind) {
    case 'text': {
      // A script of the page may write into a field when another loses the focus (an email's subject is copied
      // into its empty internal name): the step fills the field again until it holds what it was given.
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await loc.fill(String(value));
        await loc.dispatchEvent('change').catch(() => {});
        await page.waitForTimeout(50);
        if ((await loc.inputValue()) === String(value)) return;
      }
      throw friendly({ message: `The field "${f.label}" holds "${await loc.inputValue()}" after it was given "${value}".`, hint: 'A script of the page changes the field; report it with the page it is on.' });
    }
    case 'editor': {
      await loc.click();
      await page.keyboard.press('ControlOrMeta+A');
      await page.keyboard.press('Delete');
      if (value) await page.keyboard.type(String(value));
      return;
    }
    case 'chosen':
    case 'chosen-multi':
      return chooseOption(world, f, value, { create: f.kind === 'chosen-multi' });
    case 'select':
    case 'select-multi': {
      const options = await loc.evaluate((s) => [...s.options].map((o) => o.textContent.replace(/\s+/g, ' ').trim()));
      const option = options.find((o) => normal(o) === normal(value)) || options.find((o) => mentions(o, value));
      if (!option) throw friendly({ message: `The list "${f.label}" has no option "${value}". It offers ${listed(options)}.`, hint: 'Name an option of the list as it is written.' });
      await loc.selectOption({ label: option });
      await settle(page);
      return;
    }
    case 'switch': {
      const on = /^(yes|on|true|1)$/i.test(clean(value));
      const off = /^(no|off|false|0)$/i.test(clean(value));
      if (!on && !off) throw friendly({ message: `"${value}" is not a value of the switch "${f.label}".`, hint: 'A switch is set to "Yes" or "No" ("on" and "off" are read the same).' });
      if ((await loc.getAttribute('aria-checked')) !== String(on)) await loc.click();
      const now = await loc.getAttribute('aria-checked');
      if (now !== String(on)) throw friendly({ message: `The switch "${f.label}" did not turn ${on ? 'on' : 'off'}.`, hint: 'The switch is a label with the role "switch"; a click turns it.' });
      return;
    }
    case 'radio': {
      const choice = loc.locator('label').filter({ hasText: new RegExp(`^\\s*${escapeRegExp(clean(value))}\\s*$`, 'i') }).first();
      if (!(await choice.count())) {
        const offered = await loc.locator('label').allInnerTexts();
        throw friendly({ message: `The choice "${f.label}" has no "${value}". It offers ${listed(offered)}.`, hint: 'Name one of its choices as it is written.' });
      }
      await choice.click();
      return;
    }
    case 'checkbox': {
      const on = /^(yes|on|true|1|checked)$/i.test(clean(value));
      await loc.setChecked(on);
      return;
    }
    default:
      throw friendly({ message: `The field "${label}" is of a kind the step cannot set (${f.kind}).`, hint: 'Report it with the page it is on.' });
  }
}

/** The value a field shows, by its label: the text, the chosen options, "Yes"/"No" of a switch. */
async function fieldValue(world, label) {
  const f = await field(world, label);
  const loc = f.locator;
  switch (f.kind) {
    case 'text': return loc.inputValue();
    case 'editor': return clean(await loc.innerText());
    case 'chosen':
    case 'chosen-multi':
    case 'select':
    case 'select-multi': return (await loc.evaluate((s) => [...s.selectedOptions].map((o) => o.textContent.replace(/\s+/g, ' ').trim()))).join(', ');
    case 'switch': return (await loc.getAttribute('aria-checked')) === 'true' ? 'Yes' : 'No';
    case 'radio': return clean(await loc.evaluate((g) => { const r = g.querySelector('input[type=radio]:checked'); const l = r && (r.closest('label') || document.querySelector(`label[for="${r.id}"]`)); return l ? l.textContent : ''; }));
    case 'checkbox': return (await loc.isChecked()) ? 'Yes' : 'No';
    default: return '';
  }
}

/** The error a field shows under it ("not-an-email is invalid."), or ''. */
async function fieldError(world, label) {
  const f = await field(world, label);
  return clean(await f.locator.evaluate((el) => {
    const group = el.closest('.has-error') || el.closest('.form-group');
    if (!group || !group.classList.contains('has-error')) {
      const parentError = el.closest('.form-group') && el.closest('.form-group').parentElement && el.closest('.form-group').parentElement.closest('.has-error');
      if (!parentError) return '';
      return [...parentError.querySelectorAll('.help-block')].map((h) => h.textContent).join(' ');
    }
    return [...group.querySelectorAll('.help-block')].map((h) => h.textContent).join(' ');
  }));
}

/** The errors of the form on screen, whichever field holds them. */
async function formErrors(page) {
  return page.evaluate(() => [...document.querySelectorAll('.has-error .help-block, .modal.in .has-error .help-block')].map((h) => h.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean)).catch(() => []);
}

/** Open a tab of the page or the dialog by its name (a count before it is read aside: "3 Notes" is "Notes"). */
async function openTab(world, name) {
  const page = world.page;
  const scope = await fieldScope(page);
  const tabs = scope.locator('[role="tab"], .nav-tabs a, .nav a[data-toggle="tab"]');
  const texts = await tabs.evaluateAll((els) => els.map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()));
  const index = texts.findIndex((t) => normal(t.replace(/^\d+\s+/, '').replace(/\s*\(\d+\s*\/\s*\d+\)$/, '')) === normal(name));
  if (index < 0) throw friendly({ message: `No tab "${name}" on ${await pageSummary(page, world)}. The tabs: ${listed(texts.map((t) => t.replace(/^\d+\s+/, '')))}.`, hint: 'Name the tab as it is written, without the count it shows.' });
  await tabs.nth(index).click();
  await settle(page);
}

// ---------------------------------------------------------------------------
// Forms of the administration: their buttons
// ---------------------------------------------------------------------------

/**
 * Press a button of the form's toolbar ("Save", "Save & Close", "Cancel"), the
 * visible copy of the form's own button, and wait for the site's answer: the
 * page it goes to, or the form again with its errors.
 */
async function pressFormButton(world, kind) {
  const page = world.page;
  const selector = { save: '.btn-apply', close: '.btn-save', cancel: '.btn-cancel' }[kind];
  const button = page.locator(`#app-content .toolbar-form-buttons ${selector}.btn-copy, #app-content #toolbar ${selector}.btn-copy`).filter({ visible: true }).first();
  if (!(await button.count())) {
    const offered = await page.locator('#app-content #toolbar button, #app-content .toolbar-form-buttons button').allInnerTexts().catch(() => []);
    throw friendly({ message: `The page has no "${{ save: 'Save', close: 'Save & Close', cancel: 'Cancel' }[kind]}" button: ${await pageSummary(page, world)}. Its buttons: ${listed(offered)}.`, hint: 'The buttons of a form are in its toolbar at the top right, on a page that edits something.' });
  }
  await act(page, () => button.click(), budget(world) * 3);
  // A save that did not go through comes back with its errors: the page is the form still.
  await page.waitForTimeout(250);
  await settle(page, budget(world) * 3);
}

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

/** The list of each part of the site, by the name a scenario gives it. */
const LISTS = {
  contacts: '/s/contacts',
  companies: '/s/companies',
  segments: '/s/segments',
  assets: '/s/assets',
  forms: '/s/forms',
  'landing pages': '/s/pages',
  'dynamic web content': '/s/dwc',
  campaigns: '/s/campaigns',
  'marketing messages': '/s/messages',
  emails: '/s/emails',
  'focus items': '/s/focus',
  'point actions': '/s/points',
  'point triggers': '/s/points/triggers',
  'point groups': '/s/points/groups',
  stages: '/s/stages',
  reports: '/s/reports',
  projects: '/s/projects',
  tags: '/s/tags',
  users: '/s/users',
  roles: '/s/roles',
  categories: '/s/categories',
  'custom fields': '/s/contacts/fields',
  webhooks: '/s/webhooks',
};

/** The path of a list by its name, or a failure naming the lists. */
function listPath(name) {
  const path = LISTS[normal(name)];
  if (!path) throw friendly({ message: `There is no list "${name}".`, hint: `Name one of ${listed(Object.keys(LISTS))}.` });
  return path;
}

/**
 * The text of a list's search, as the site reads it: a word before a colon is a command of its search ("is:mine",
 * "segment:alias"), so a name with a colon is searched as a phrase, in quotes.
 */
function searchText(text) {
  const t = String(text || '');
  return /:/.test(t) && !/^"/.test(t) ? `"${t.replace(/"/g, '')}"` : t;
}

/**
 * Open a list with its search cleared: the site remembers the last search of a
 * list for the session, so a list opened again would still show only what a
 * search found.
 */
async function openList(world, name, search) {
  const response = await open(world, `${listPath(name)}?search=${encodeURIComponent(searchText(search))}`);
  if (await isRefusal(world.page)) {
    throw friendly({ message: `The site refused the list "${name}" to this account (403 Forbidden).`, hint: 'The account\'s role has no right to that part of the site. Log in with an account that has.' });
  }
  return response;
}

/** The rows of the list on screen, as their texts. */
async function listRows(page) {
  return page.locator('#app-content .page-list table tbody tr, #app-content table.table tbody tr').evaluateAll((rows) => rows.map((r) => (r.innerText || '').replace(/\s+/g, ' ').trim()).filter(Boolean)).catch(() => []);
}

/** How many items the list says it has ("3 items, 1 page in total"); 0 when it shows "No Results Found". */
async function listCount(page) {
  return page.evaluate(() => {
    const root = document.querySelector('#app-content') || document.body;
    const text = (root.innerText || '').replace(/\s+/g, ' ');
    const m = text.match(/(\d+) items?, \d+ pages? in total/);
    if (m) return Number(m[1]);
    if (/No Results Found/.test(text)) return 0;
    return null;
  }).catch(() => null);
}

/** The row of the list whose text holds a name, or a failure with the rows there are. */
async function listRow(world, name) {
  const page = world.page;
  const rows = page.locator('#app-content table tbody tr').filter({ hasText: new RegExp(escapeRegExp(clean(name)), 'i') });
  if (!(await rows.count())) {
    throw friendly({ message: `The list shows no row with "${name}". It shows ${listed(await listRows(page))}.`, hint: 'Search the list first when the row may be on another page; the site remembers the last search of a list.' });
  }
  return rows.first();
}

/** Search the list on screen, as a person does: the search box, then Enter, then the list again. */
async function searchList(world, text) {
  const page = world.page;
  const box = page.locator('#list-search').first();
  if (!(await box.count())) throw friendly({ message: `The page has no list search: ${await pageSummary(page, world)}.`, hint: 'Open a list first.' });
  await box.fill(searchText(text));
  await act(page, () => box.press('Enter'));
}

// ---------------------------------------------------------------------------
// Accounts and sessions
// ---------------------------------------------------------------------------

/**
 * An account of the users registry in cucumber.js (`worldParameters.users`),
 * by the handle a scenario names it with.
 *
 * @returns {{handle: string, username: string, password: string, email: (string|undefined)}}
 */
function resolveUser(world, handle) {
  const users = (world.parameters && world.parameters.users) || {};
  const entry = users[handle];
  if (!entry) {
    throw friendly({
      message: `The user "${handle}" is not in the users registry. Known users: ${Object.keys(users).join(', ') || '(none)'}.`,
      hint: `Add it to worldParameters.users in cucumber.js: users: { ${handle}: { username: '${handle}', password: process.env.${String(handle).toUpperCase()}_PASSWORD, email: '${handle}@example.com' } }. The account itself is made once by the build of the site, never by a feature.`,
    });
  }
  if (!entry.username || !entry.password) {
    throw friendly({ message: `The user "${handle}" has no ${entry.username ? 'password' : 'user name'} in the users registry.`, hint: `Set worldParameters.users.${handle}.username and .password in cucumber.js.` });
  }
  return { handle, username: entry.username, password: entry.password, email: entry.email };
}

/** A handle of the registry stands for its account; anything else is a user name or an address as it is. */
function accountOf(world, who) {
  const users = (world.parameters && world.parameters.users) || {};
  if (users[who]) return resolveUser(world, who);
  const handle = Object.keys(users).find((h) => [users[h].username, users[h].email].filter(Boolean).some((v) => String(v).toLowerCase() === String(who).toLowerCase()));
  return handle ? resolveUser(world, handle) : { handle: who, username: who, password: '', email: /@/.test(who) ? who : undefined };
}

/** The email address of a handle of the registry; anything else is an address already. */
function addressOf(world, who) {
  const account = accountOf(world, who);
  if (account.email) return account.email;
  if (/@/.test(who)) return who;
  throw friendly({ message: `The user "${who}" has no email address in the users registry.`, hint: `Set worldParameters.users.${who}.email in cucumber.js.` });
}

/** The handle of the account that prepares and removes test content (`worldParameters.manager`, "administrator" by default). */
function managerHandle(world) {
  return (world.parameters && world.parameters.manager) || 'administrator';
}

// The sessions of the accounts that logged in during this run, by site and
// account: the cookies of the browser after a login through the form.
const SESSIONS = new Map();

function sessionKey(world, username) {
  return `${siteRoot(world)}|${String(username).toLowerCase()}`;
}

function reuseSessions(world) {
  return !(world.parameters && world.parameters.reuseSessions === false);
}

function forgetSession(world, username) {
  if (username) SESSIONS.delete(sessionKey(world, username));
}

/** The user name of the account logged in to a browser, as its account page says it, or '' for none. */
async function signedInUsername(world, page) {
  let res;
  try {
    res = await page.request.get(absolute(world, '/s/account'), { failOnStatusCode: false, timeout: budget(world), maxRedirects: 0 });
  } catch (err) {
    return '';
  }
  if (res.status() !== 200) return '';
  const html = await res.text().catch(() => '');
  // An account that may change its user name has the field "user[username]"; another sees it read only, as
  // "user[username_unbound]".
  const m = html.match(/name="user\[username(?:_unbound)?\]"[^>]*value="([^"]*)"/) || html.match(/value="([^"]*)"[^>]*name="user\[username(?:_unbound)?\]"/);
  return m ? clean(m[1]) : '';
}

const LOGIN_HINT = 'The login page of the site (/s/login) has the fields "Username or email" and "Password" and the button "Login". Check launchUrl in cucumber.js, and that the build of the site made the account.';

// The site refuses every login of a name, as it is typed (letter case aside), for half an hour after three failed
// ones from one address, with this message in place of the one of a wrong password; a login that works does not set
// the count back.
const THROTTLED = /too many failed login attempts/i;
const THROTTLE_HINT = 'The site refuses every login of a name, as it is typed, for 30 minutes after three failed ones from one address, and a login that works does not set the count back: try a wrong password with a name no other scenario logs in with (the account\'s address). To lift the lock now, clear the site\'s record of login attempts: bin/console cache:pool:clear cache.rate_limiter in the site\'s folder.';

/** The hint for a refused login: the lock of an account after failed logins, else where the login form is. */
function loginHint(page, errors, before = '') {
  return hintFor(page, (errors || []).some((e) => THROTTLED.test(e)) ? THROTTLE_HINT : `${before}${LOGIN_HINT}`);
}

/**
 * Fill in and send the login form, then read its outcome: whether the site took
 * the browser into the administration, else the message the login page shows.
 *
 * @returns {Promise<{ok: boolean, errors: string[], cut: boolean}>}
 */
async function submitLogin(world, page, username, password, { again = 3 } = {}) {
  await page.context().clearCookies();
  await openIn(page, absolute(world, '/s/login'), budget(world) * 3);
  const user = page.locator('form[name="login"] #username');
  try {
    await user.waitFor({ state: 'visible', timeout: budget(world) });
  } catch (err) {
    throw friendly({ message: `The login form did not appear: ${await pageSummary(page, world)}.`, cause: err, hint: hintFor(page, LOGIN_HINT) });
  }
  await user.fill(username);
  await page.locator('form[name="login"] #password').fill(password);
  await Promise.all([
    page.waitForURL((url) => !/\/s\/login(\?|$)/.test(url.pathname + url.search) || false, { timeout: budget(world) * 3 }).catch(() => {}),
    page.locator('#form-loginbtn').click(),
  ]);
  await settle(page, budget(world) * 3);
  if (cutRequest(page)) {
    // The machine cut the request (its network changed, its containers' router started again): log in again, a
    // few times, a moment later each.
    if (again > 0) {
      await page.waitForTimeout(2000 * (4 - again));
      return submitLogin(world, page, username, password, { again: again - 1 });
    }
    return { ok: false, errors: [cutRequest(page)], cut: true };
  }
  if (!(await isLoginPage(page)) && /\/s\//.test(page.url())) return { ok: true, errors: [], cut: false };
  // The login page again: its message says why.
  const said = await eventually(page, () => messages(page), (m) => m.length > 0, async () => ({ message: '', hint: '' }), 3000).catch(() => []);
  return { ok: false, errors: (said || []).map((m) => m.text), cut: false };
}

/** Log a browser in as an account of the registry, through the form, and keep its session for later scenarios. */
async function logInPage(world, page, user) {
  const outcome = await submitLogin(world, page, user.username, user.password);
  if (!outcome.ok) {
    throw friendly({
      message: `"${user.handle}" (${user.username}) could not log in: ${outcome.errors.length ? `the site says ${listed(outcome.errors)}` : await pageSummary(page, world)}.`,
      hint: loginHint(page, outcome.errors, 'Check the account in the users registry of cucumber.js and on the site (the build makes it). '),
    });
  }
  SESSIONS.set(sessionKey(world, user.username), await page.context().cookies());
}

/** Take over in a browser the session an account opened earlier in this run. */
async function restoreSessionIn(world, page, user) {
  const cookies = SESSIONS.get(sessionKey(world, user.username));
  if (!cookies || !reuseSessions(world)) return false;
  const context = page.context();
  await context.clearCookies();
  await context.addCookies(cookies);
  if ((await signedInUsername(world, page)).toLowerCase() === user.username.toLowerCase()) return true;
  forgetSession(world, user.username);
  await context.clearCookies();
  return false;
}

/** Log the scenario's browser in as a handle of the registry: the session of an earlier login when there is one, else the form. */
async function logInAs(world, handle) {
  const user = resolveUser(world, handle);
  if (world.__account === user.username && (await signedInUsername(world, world.page)).toLowerCase() === user.username.toLowerCase()) return user;
  if (await restoreSessionIn(world, world.page, user)) {
    // A page the browser shows still holds what the session before it drew (another account's menus): open the
    // dashboard, where a login lands.
    if (!/^about:/.test(world.page.url())) await open(world, '/s/dashboard');
  } else {
    await logInPage(world, world.page, user);
  }
  world.__account = user.username;
  return user;
}

/**
 * Do something as the managing account, in a browser of its own, so the
 * scenario's browser and its session stay as they are (test content prepared
 * or removed for a Given step).
 */
async function asManager(world, fn) {
  const user = resolveUser(world, managerHandle(world));
  const browser = world.browser || (world.page && world.page.context().browser());
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1400, height: 1000 } });
  const page = await context.newPage();
  await recordFlashes(page);
  try {
    if (!(await restoreSessionIn(world, page, user))) await logInPage(world, page, user);
    return await fn(page);
  } finally {
    await context.close().catch(() => {});
  }
}

/**
 * Delete the items of a list whose name is exactly a name (letter case aside),
 * as the managing account: the list searched for it, each row's Delete and its
 * confirmation. Returns how many went.
 */
async function deleteByName(world, listName, name, { cellMatch } = {}) {
  return asManager(world, async (page) => {
    let removed = 0;
    for (let round = 0; round < 10; round += 1) {
      await openIn(page, absolute(world, `${listPath(listName)}?search=${encodeURIComponent(searchText(name))}`), budget(world) * 3);
      const rows = page.locator('#app-content table tbody tr');
      const count = await rows.count();
      let target = null;
      for (let i = 0; i < count; i += 1) {
        const row = rows.nth(i);
        const link = row.locator('td a[href*="/view/"]:not(.dropdown-menu a), td a[href*="/edit/"]:not(.dropdown-menu a)').first();
        const text = clean(await (await link.count() ? link : row).innerText().catch(() => ''));
        const rowText = clean(await row.innerText().catch(() => ''));
        if (cellMatch ? cellMatch(text, name, rowText) : normal(text) === normal(name)) { target = row; break; }
      }
      if (!target) break;
      await target.getByRole('button', { name: 'Options' }).first().click();
      const del = target.locator('.dropdown-menu a').filter({ hasText: /^\s*Delete\s*$/ }).first();
      await del.click();
      await answerConfirmation(world, page, 'Delete');
      removed += 1;
    }
    // Leave the list's remembered search empty for the managing account.
    await openIn(page, absolute(world, `${listPath(listName)}?search=`), budget(world) * 3).catch(() => {});
    return removed;
  });
}

// ---------------------------------------------------------------------------
// Looking things up by their name (as the managing account)
// ---------------------------------------------------------------------------

/** The id of an item of a list by its name (exact, letter case aside), as the managing account, or null. */
async function idByName(world, listName, name) {
  return asManager(world, async (page) => {
    await openIn(page, absolute(world, `${listPath(listName)}?search=${encodeURIComponent(searchText(name))}`), budget(world) * 3);
    const id = await page.evaluate((wanted) => {
      const norm = (t) => String(t || '').replace(/\s+/g, ' ').trim().toLowerCase();
      for (const a of document.querySelectorAll('#app-content table tbody tr td a[href*="/view/"]')) {
        if (a.closest('.dropdown-menu')) continue;
        if (norm(a.textContent) === norm(wanted) || norm(a.textContent).includes(norm(wanted))) {
          const m = a.getAttribute('href').match(/\/view\/(\d+)/);
          if (m) return Number(m[1]);
        }
      }
      return null;
    }, name);
    await openIn(page, absolute(world, `${listPath(listName)}?search=`), budget(world) * 3).catch(() => {});
    return id;
  });
}

// ---------------------------------------------------------------------------
// Mail catcher (Mailpit)
// ---------------------------------------------------------------------------

/** The mail catcher's address: worldParameters.mailUrl, without a trailing slash. */
function mailUrl(world) {
  const url = (world.parameters && world.parameters.mailUrl) || process.env.MAIL_URL || '';
  if (!url) throw friendly({ message: 'No mail catcher is set.', hint: 'Set worldParameters.mailUrl in cucumber.js (MAIL_URL): the address of the site\'s Mailpit.' });
  return String(url).replace(/\/+$/, '');
}

let MAIL_CONTEXT = null;
async function mailContext() {
  if (!MAIL_CONTEXT) {
    const { request } = require('playwright');
    MAIL_CONTEXT = await request.newContext({ ignoreHTTPSErrors: true });
  }
  return MAIL_CONTEXT;
}

/** The mails to an address, newest first (Mailpit's search). */
async function mailTo(world, address) {
  const ctx = await mailContext();
  const res = await ctx.get(`${mailUrl(world)}/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}&limit=50`, { failOnStatusCode: false, timeout: budget(world) }).catch((err) => {
    throw friendly({ message: `The mail catcher did not answer at ${mailUrl(world)}: ${String(err && err.message).split('\n')[0]}.`, hint: 'Check worldParameters.mailUrl in cucumber.js: the address of the site\'s Mailpit.' });
  });
  if (!res.ok()) throw friendly({ message: `The mail catcher answered ${res.status()} at ${mailUrl(world)}.`, hint: 'Check worldParameters.mailUrl in cucumber.js.' });
  const data = await res.json();
  return data.messages || [];
}

/** One mail, whole. */
async function mailMessage(world, id) {
  const ctx = await mailContext();
  const res = await ctx.get(`${mailUrl(world)}/api/v1/message/${id}`, { timeout: budget(world) });
  return res.json();
}

/** The links of a mail: its HTML's anchors, else the addresses of its text. */
function mailLinks(message) {
  const html = String(message.HTML || '');
  const links = [...html.matchAll(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)].map((m) => ({ href: m[1].replace(/&amp;/g, '&'), text: clean(m[2].replace(/<[^>]+>/g, '')) }));
  if (links.length) return links;
  return [...String(message.Text || '').matchAll(/https?:\/\/\S+/g)].map((m) => ({ href: m[0], text: m[0] }));
}

/** What a mail says: its text, else its HTML without the tags. */
function mailText(message) {
  return clean(message.Text || String(message.HTML || '').replace(/<[^>]+>/g, ' '));
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

// Every page of a scenario records the site's messages as they come.
onNewPage((world, page) => recordFlashes(page));

Before(async function () {
  this.__account = null;
  this.__scenarioStartedAt = Date.now();
  if (this.page) await recordFlashes(this.page);
});

module.exports = {
  budget,
  scheduledBudget,
  clean,
  normal,
  mentions,
  listed,
  escapeRegExp,
  pairs,
  siteRoot,
  absolute,
  pathOf,
  cutRequest,
  CUT_HINT,
  hintFor,
  loginHint,
  settle,
  openIn,
  open,
  act,
  eventually,
  heading,
  pageSummary,
  isRefusal,
  isLoginPage,
  recordFlashes,
  messages,
  expectMessage,
  confirmation,
  answerConfirmation,
  openDialog,
  waitForDialog,
  dialogClosed,
  fieldScope,
  field,
  setField,
  fieldValue,
  fieldError,
  formErrors,
  openTab,
  chooseOption,
  pressFormButton,
  LISTS,
  listPath,
  searchText,
  openList,
  listRows,
  listCount,
  listRow,
  searchList,
  resolveUser,
  accountOf,
  addressOf,
  managerHandle,
  SESSIONS,
  sessionKey,
  forgetSession,
  signedInUsername,
  submitLogin,
  logInPage,
  logInAs,
  asManager,
  deleteByName,
  idByName,
  mailUrl,
  mailTo,
  mailMessage,
  mailLinks,
  mailText,
  LOGIN_HINT,
};
