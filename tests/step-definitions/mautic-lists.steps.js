'use strict';

// The lists of the administration: contacts, companies, segments, forms,
// landing pages, assets, emails, campaigns, stages, point actions, tags,
// reports, users, roles, … Each is a table with a search box, a column to sort
// by, a menu of actions per row ("Options": Edit, Delete, …) and a line that
// counts its items ("3 items, 1 page in total").
//
// The site remembers the last search of a list for the session: a list opened
// with the step below starts with its search cleared.

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./mautic-helpers');

/**
 * Open a list of the administration by its name, its search cleared (the site remembers the last one): contacts,
 * companies, segments, forms, landing pages, assets, emails, campaigns, stages, point actions, point triggers, tags,
 * reports, users, roles, categories, custom fields, webhooks, …
 *
 * Example #1: When I open the list of contacts
 * Example #2: When we open the list of segments
 * Example #3: And I open the list of landing pages
 * Example #4: When I open the list of point actions
 * Example #5: Given I open the list of users
 */
When(/^(?:I|we) open the list of ([a-z ]+)$/, async function (name) {
  await h.openList(this, name);
});

/**
 * Search the list on screen as a person does: its search box, the text, Enter; the list comes again with what
 * matches.
 *
 * Example #1: When I search the list for "Haddad"
 * Example #2: When we search the list for "lina.haddad@example.com"
 * Example #3: And I search the list for "Newsletter"
 * Example #4: When I search the list for "Webship test"
 * Example #5: When I search the list for "nothing-matches-this"
 */
When(/^(?:I|we) search the list for "([^"]*)"$/, async function (text) {
  await h.searchList(this, text);
});

/**
 * Assert that the list on screen shows a row with a text (a name, an address, a part of either), or does not.
 *
 * Example #1: Then the list should show "Lina Haddad"
 * Example #2: Then the list should not show "Webship test contact"
 * Example #3: And the list should show "Newsletter readers"
 * Example #4: Then the list should show "marketer@example.com"
 * Example #5: Then the list should not show "Omar Saleh"
 */
Then(/^the list should( not)? show "([^"]*)"$/, async function (notCase, text) {
  const page = this.page;
  const has = (rows) => rows.some((r) => h.mentions(r, text));
  await h.eventually(page, () => h.listRows(page), (rows) => has(rows) === !notCase, async (rows) => ({
    message: `The list ${notCase ? 'shows' : 'does not show'} "${text}". It shows ${h.listed(rows)}.`,
    hint: notCase ? 'A row the scenario removed is gone once the list came again.' : 'Search the list when the row may be on another page; an account sees only what its role allows.',
  }), h.budget(this));
});

/**
 * Assert how many items the list says it has ("3 items, 1 page in total"; "No Results Found" is 0).
 *
 * Example #1: Then the list should have 2 items
 * Example #2: Then the list should have 1 item
 * Example #3: And the list should have 0 items
 * Example #4: Then the list should have 5 items
 * Example #5: Then the list should have 3 items
 */
Then(/^the list should have (\d+) items?$/, async function (count) {
  const page = this.page;
  await h.eventually(page, () => h.listCount(page), (n) => n === Number(count), async (n) => ({
    message: `The list says it has ${n === null ? 'no count' : `${n} item(s)`}, not ${count}. It shows ${h.listed(await h.listRows(page))}.`,
    hint: 'The count is the line under the list ("3 items, 1 page in total"); a search narrows it.',
  }), h.budget(this));
});

/**
 * Assert that the row of a name shows a text in it (another column of the same row): the role of a user, the count
 * of a segment, the stage or the points of a contact.
 *
 * Example #1: Then the row of "marketer" should show "Marketer"
 * Example #2: Then the row of "Lina Haddad" should show "Lead"
 * Example #3: And the row of "sales@example.com" should show "Sales"
 * Example #4: Then the row of "Omar Saleh" should show "Irbid"
 * Example #5: Then the row of "newsletter" should show "View 2 Contacts"
 */
Then(/^the row of "([^"]*)" should show "([^"]*)"$/, async function (name, text) {
  const page = this.page;
  await h.eventually(page, async () => {
    const rows = await h.listRows(page);
    return rows.find((r) => h.mentions(r, name)) || '';
  }, (row) => !!row && h.mentions(row, text), async (row) => ({
    message: row ? `The row of "${name}" does not show "${text}": it reads "${row}".` : `The list shows no row of "${name}". It shows ${h.listed(await h.listRows(page))}.`,
    hint: 'The row is found by a text of it (a name, an address); the second text is looked for in the whole row.',
  }), h.budget(this));
});

/**
 * Open an item from the list on screen by its name: the link of its row (a contact's name, a segment's, a form's).
 *
 * Example #1: When I open "Lina Haddad" from the list
 * Example #2: When we open "Newsletter readers" from the list
 * Example #3: And I open "Newsletter sign-up" from the list
 * Example #4: When I open "Spring webinar" from the list
 * Example #5: When I open "Submissions of published Forms" from the list
 */
When(/^(?:I|we) open "([^"]*)" from the list$/, async function (name) {
  const page = this.page;
  const row = await h.listRow(this, name);
  const link = row.locator('td a[href*="/view/"]:not(.dropdown-menu a), td a[href*="/edit/"]:not(.dropdown-menu a)').filter({ hasText: new RegExp(h.escapeRegExp(h.clean(name)), 'i') }).first();
  const target = (await link.count()) ? link : row.locator('td a[href*="/view/"]:not(.dropdown-menu a), td a[href*="/edit/"]:not(.dropdown-menu a)').first();
  if (!(await target.count())) throw friendly({ message: `The row of "${name}" has no link to open.`, hint: 'The name of an item links to it in its row.' });
  await h.act(page, () => target.click(), h.budget(this) * 3);
});

/**
 * Choose an action in the "Options" menu of a row of the list on screen ("Edit", "Delete", "Clone", "View Contacts",
 * "Results", …). A delete asks for a confirmation first: answer it with the next step.
 *
 * Example #1: When I choose "Delete" in the options of "Webship test contact"
 * Example #2: When we choose "Edit" in the options of "Lina Haddad"
 * Example #3: And I choose "View Contacts" in the options of "Newsletter readers"
 * Example #4: When I choose "Clone" in the options of "Amman contacts"
 * Example #5: When I choose "Delete" in the options of "Webship test segment"
 */
When(/^(?:I|we) choose "([^"]*)" in the options of "([^"]*)"$/, async function (action, name) {
  const page = this.page;
  const row = await h.listRow(this, name);
  const button = row.getByRole('button', { name: 'Options' }).first();
  if (!(await button.count())) throw friendly({ message: `The row of "${name}" has no "Options" menu.`, hint: 'The menu of a row is the button with three dots at its start.' });
  await button.click();
  const menu = row.locator('.dropdown-menu');
  await menu.waitFor({ state: 'visible', timeout: h.budget(this) }).catch(() => {});
  const item = menu.locator('a').filter({ hasText: new RegExp(`^\\s*${h.escapeRegExp(action)}\\s*$`, 'i') }).first();
  if (!(await item.count())) {
    throw friendly({ message: `The options of "${name}" have no "${action}". They offer ${h.listed(await menu.locator('a').allInnerTexts())}.`, hint: 'The options a row offers follow the role of the account.' });
  }
  const confirms = (await item.getAttribute('data-toggle')) === 'confirmation';
  if (confirms) await item.click();
  else await h.act(page, () => item.click(), h.budget(this) * 3);
});

/**
 * Sort the list on screen by a column, as a person does: its heading. With an order, the step clicks the heading
 * until the list says it is sorted that way (the site remembers the last order of a list for the session); without
 * one, it clicks once.
 *
 * Example #1: When I sort the list by "Points" in descending order
 * Example #2: When we sort the list by "Name" in ascending order
 * Example #3: And I sort the list by "Email"
 * Example #4: When I sort the list by "ID" in ascending order
 * Example #5: When I sort the list by "Points" in ascending order
 */
When(/^(?:I|we) sort the list by "([^"]*)"(?: in (ascending|descending) order)?$/, async function (column, order) {
  const page = this.page;
  const headings = page.locator('#app-content table thead th');
  const index = await headings.evaluateAll((ths, wanted) => ths.findIndex((th) => {
    const a = th.querySelector('a.table-sort');
    return a && a.textContent.replace(/\s+/g, ' ').trim().toLowerCase() === wanted.toLowerCase();
  }), column);
  if (index < 0) {
    const offered = await page.locator('#app-content table thead a.table-sort').allInnerTexts();
    throw friendly({ message: `The list cannot be sorted by "${column}". Its columns: ${h.listed(offered)}.`, hint: 'Name a column whose heading is a link.' });
  }
  const sortOf = () => headings.nth(index).getAttribute('aria-sort').catch(() => null);
  if (!order) {
    await h.act(page, () => headings.nth(index).locator('a.table-sort').click());
    return;
  }
  for (let i = 0; i < 3 && (await sortOf()) !== order; i += 1) {
    await h.act(page, () => headings.nth(index).locator('a.table-sort').click());
  }
  const now = await sortOf();
  if (now !== order) throw friendly({ message: `The list is sorted by "${column}" ${now || 'in no order'}, not ${order}.`, hint: 'A click on a column heading sorts by it, a second one the other way.' });
});

/**
 * Assert the order of the first rows of the list on screen, by a text of each (names, top to bottom).
 *
 * Example #1: Then the list should start with "Omar Saleh", "Lina Haddad"
 * Example #2: Then the list should start with "Sara Khalil"
 * Example #3: And the list should start with "Omar Saleh", "Lina Haddad", "Karim Aziz"
 * Example #4: Then the list should start with "Amman contacts", "Newsletter readers"
 * Example #5: Then the list should start with "administrator"
 */
Then(/^the list should start with ((?:"[^"]*"(?:, )?)+)$/, async function (list) {
  const page = this.page;
  const wanted = [...list.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
  await h.eventually(page, () => h.listRows(page), (rows) => wanted.every((w, i) => rows[i] && h.mentions(rows[i], w)), (rows) => ({
    message: `The list does not start with ${h.listed(wanted)}. Its first rows: ${h.listed(rows.slice(0, wanted.length + 2))}.`,
    hint: 'Sort the list first (When I sort the list by "…"); a second click on a column sorts the other way.',
  }), h.budget(this));
});
