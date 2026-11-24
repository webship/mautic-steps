'use strict';

// The administration around every page: the main menu on the left and its
// groups, the settings menu at the top right, the heading of the page, the
// messages the site answers with (recorded as they come: they close themselves
// after four seconds), the confirmation it asks before a delete, the dialogs it
// opens over the page, and the search of everything at the top.

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./mautic-helpers');

/** The items of the main menu: their names, the group each is under, and whether each is a group. */
async function mainMenu(page) {
  return page.evaluate(() => [...document.querySelectorAll('nav.nav-sidebar a[id^="mautic_"]')].map((a) => {
    const groupList = a.closest('ul.nav-submenu');
    const parent = groupList ? document.querySelector(`[data-target="#${groupList.id}"]`) : null;
    return {
      id: a.id,
      name: (a.querySelector('.nav-item-name') || a).textContent.replace(/\s+/g, ' ').trim(),
      group: parent ? (parent.querySelector('.nav-item-name') || parent).textContent.replace(/\s+/g, ' ').trim() : '',
      isGroup: a.getAttribute('data-toggle') === 'submenu',
    };
  })).catch(() => []);
}

/** The items of the settings menu at the top right (an account without settings has none). */
async function settingsMenu(page) {
  return page.evaluate(() => {
    const toggle = document.querySelector('#admin-menu');
    const menu = toggle && toggle.parentElement ? toggle.parentElement.querySelector('.dropdown-menu') : null;
    return menu ? [...menu.querySelectorAll('a')].map((a) => a.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean) : [];
  }).catch(() => []);
}

/** Make sure the browser is on a page of the administration, which has the menus. */
async function onAdministration(world) {
  if (!(await world.page.locator('nav.nav-sidebar').count())) await h.open(world, '/s/dashboard');
  if (await h.isLoginPage(world.page)) {
    throw friendly({ message: `Nobody is logged in: the site shows its login page (${await h.pageSummary(world.page, world)}).`, hint: 'The menus and the search of everything are on the pages of the administration: log in first (Given I am a logged in user with the "marketer" user).' });
  }
}

/**
 * Go to a part of the site through the main menu on the left, as a person does: an item of a group ("Forms" under
 * "Components", "Emails" under "Channels", "Manage Actions" under "Points") opens its group first.
 *
 * Example #1: When I go to "Contacts" in the main menu
 * Example #2: When we go to "Forms" in the main menu
 * Example #3: And I go to "Emails" in the main menu
 * Example #4: When I go to "Manage Actions" in the main menu
 * Example #5: When I go to "Segments" in the main menu
 */
When(/^(?:I|we) go to "([^"]*)" in the main menu$/, async function (name) {
  const page = this.page;
  await onAdministration(this);
  const items = await mainMenu(page);
  const item = items.find((i) => h.normal(i.name) === h.normal(name) && !i.isGroup);
  if (!item) {
    throw friendly({ message: `The main menu has no "${name}". It offers ${h.listed(items.filter((i) => !i.isGroup).map((i) => (i.group ? `${i.group} > ${i.name}` : i.name)))}.`, hint: 'Name an item of the menu as it is written; an item the account\'s role has no right to is not in the menu.' });
  }
  const link = page.locator(`#${item.id}`);
  if (item.group && !(await link.isVisible().catch(() => false))) {
    const group = items.find((i) => i.isGroup && i.name === item.group);
    await page.locator(`#${group.id}`).click();
    await link.waitFor({ state: 'visible', timeout: h.budget(this) });
  }
  await h.act(page, () => link.click());
});

/**
 * Assert that the main menu offers an item (or a group) to the account logged in, or does not: the menu leaves out
 * what its role has no right to.
 *
 * Example #1: Then the main menu should offer "Campaigns"
 * Example #2: Then the main menu should not offer "Campaigns"
 * Example #3: And the main menu should offer "Components"
 * Example #4: Then the main menu should not offer "Emails"
 * Example #5: And the main menu should offer "Contacts"
 */
Then(/^the main menu should( not)? offer "([^"]*)"$/, async function (notCase, name) {
  await onAdministration(this);
  const items = await mainMenu(this.page);
  const has = items.some((i) => h.normal(i.name) === h.normal(name));
  if (has === !!notCase) {
    throw friendly({ message: `The main menu ${notCase ? 'offers' : 'does not offer'} "${name}". It offers ${h.listed(items.map((i) => i.name))}.`, hint: 'The menu shows what the role of the account logged in has a right to.' });
  }
});

/**
 * Go to a page of the settings menu at the top right (the gear): Users, Roles, Custom Fields, Categories,
 * Configuration, and the rest an account's role has a right to.
 *
 * Example #1: When I go to "Users" in the settings menu
 * Example #2: When we go to "Roles" in the settings menu
 * Example #3: And I go to "Configuration" in the settings menu
 * Example #4: When I go to "Custom Fields" in the settings menu
 * Example #5: When I go to "Categories" in the settings menu
 */
When(/^(?:I|we) go to "([^"]*)" in the settings menu$/, async function (name) {
  const page = this.page;
  await onAdministration(this);
  const items = await settingsMenu(page);
  if (!items.some((i) => h.normal(i) === h.normal(name))) {
    throw friendly({ message: `The settings menu has no "${name}". It offers ${h.listed(items)}.`, hint: 'The settings menu is the gear at the top right; it holds only what the account\'s role has a right to.' });
  }
  await page.locator('#admin-menu').click();
  const link = page.locator('#admin-menu').locator('xpath=..').locator('.dropdown-menu a').filter({ hasText: new RegExp(`^\\s*${h.escapeRegExp(name)}\\s*$`, 'i') }).first();
  await link.waitFor({ state: 'visible', timeout: h.budget(this) });
  await h.act(page, () => link.click());
});

/**
 * Assert that the settings menu at the top right offers a page, or does not.
 *
 * Example #1: Then the settings menu should offer "Users"
 * Example #2: Then the settings menu should not offer "Users"
 * Example #3: And the settings menu should offer "Configuration"
 * Example #4: Then the settings menu should not offer "Roles"
 * Example #5: And the settings menu should offer "Categories"
 */
Then(/^the settings menu should( not)? offer "([^"]*)"$/, async function (notCase, name) {
  await onAdministration(this);
  const items = await settingsMenu(this.page);
  const has = items.some((i) => h.normal(i) === h.normal(name));
  if (has === !!notCase) {
    throw friendly({ message: `The settings menu ${notCase ? 'offers' : 'does not offer'} "${name}". It offers ${h.listed(items)}.`, hint: 'The settings menu holds what the role of the account logged in has a right to.' });
  }
});

/**
 * Assert the heading of the page (its title at the top: "Contacts", "New Segment", a contact's name), as a whole,
 * letter case aside.
 *
 * Example #1: Then the page heading should be "Contacts"
 * Example #2: Then the page heading should be "New Segment"
 * Example #3: And the page heading should be "Lina Haddad"
 * Example #4: Then the page heading should be "Contact Segments"
 * Example #5: Then the page heading should be "Results for Newsletter sign-up"
 */
Then(/^the page heading should be "([^"]*)"$/, async function (expected) {
  const page = this.page;
  await h.eventually(page, () => h.heading(page), (t) => h.normal(t) === h.normal(expected), async (t) => ({
    message: `The page heading is "${t || '(none)'}", not "${expected}": ${await h.pageSummary(page, this)}.`,
    hint: h.hintFor(page, 'The heading is the title at the top of the page.'),
  }), h.budget(this));
});

/**
 * Assert that the site said a message (or a part of it): the message at the top of the page after a save, a delete
 * or a refusal ("Lina Haddad has been created!", "… has been deleted!"), or an alert of the login and password
 * pages. A message closes itself after four seconds; the pack records each one as it comes.
 *
 * Example #1: Then the site should say "has been created!"
 * Example #2: Then the site should say "Note created successfully"
 * Example #3: And the site should say "Webship test contact has been deleted!"
 * Example #4: Then the site should say "Passwords do not match."
 * Example #5: Then the site should say "A new password has been generated and will be emailed to you"
 */
Then(/^the site should say "([^"]*)"$/, async function (expected) {
  await h.expectMessage(this, expected);
});

/**
 * Assert that the site asks a question before it acts ("Delete this contact?"), in its confirmation dialog.
 *
 * Example #1: Then the site should ask "Delete this contact?"
 * Example #2: Then the site should ask "Delete this note?"
 * Example #3: And the site should ask "Delete the segment, Webship test segment"
 * Example #4: Then the site should ask "Delete this contact?"
 * Example #5: Then the site should ask "Delete"
 */
Then(/^the site should ask "([^"]*)"$/, async function (question) {
  const page = this.page;
  await h.eventually(page, () => h.confirmation(page), (c) => !!c && h.mentions(c.question, question), async (c) => ({
    message: c ? `The site asks "${c.question}", not "${question}".` : `The site asks nothing: ${await h.pageSummary(page, this)}.`,
    hint: 'The site asks before it deletes, in a small dialog with its question and the buttons Cancel and Delete.',
  }), h.budget(this));
});

/**
 * Answer the confirmation the site asks with one of its buttons ("Delete", "Cancel"), and wait for what follows.
 *
 * Example #1: When I answer the confirmation with "Delete"
 * Example #2: When we answer the confirmation with "Cancel"
 * Example #3: And I answer the confirmation with "Delete"
 * Example #4: When I answer the confirmation with "Cancel"
 * Example #5: When we answer the confirmation with "Delete"
 */
When(/^(?:I|we) answer the confirmation with "([^"]*)"$/, async function (answer) {
  await h.answerConfirmation(this, this.page, answer);
});

/**
 * Assert that a dialog is open over the page, with its title (or a part of it): the forms of one thing ("Quick Add",
 * "New note", "Send a custom email to …", a field or an action of a form or a campaign).
 *
 * Example #1: Then the dialog "Quick Add" should be open
 * Example #2: Then the dialog "New note" should be open
 * Example #3: And the dialog "Send a custom email to" should be open
 * Example #4: Then the dialog "Modify contact's tags" should be open
 * Example #5: Then the dialog "What type of email do you want to create?" should be open
 */
Then(/^the dialog "([^"]*)" should be open$/, async function (title) {
  await h.waitForDialog(this, this.page, title);
});

/**
 * Assert that no dialog is open over the page any more (after a save or a cancel).
 *
 * Example #1: Then no dialog should be open
 * Example #2: And no dialog should be open
 * Example #3: Then no dialog should be open
 * Example #4: But no dialog should be open
 * Example #5: Then no dialog should be open
 */
Then(/^no dialog should be open$/, async function () {
  const page = this.page;
  await h.dialogClosed(page, h.budget(this));
  const still = await h.openDialog(page);
  if (still) {
    const errors = await h.formErrors(page);
    throw friendly({ message: `The dialog "${still.title}" is still open${errors.length ? `, with the errors ${h.listed(errors)}` : ''}.`, hint: 'A dialog closes once the site took what it was sent; it stays open with the errors of its form when it did not.' });
  }
});

/**
 * Press a button of the dialog that is open ("Save", "Add", "Send", "Cancel", or a choice of a dialog that offers
 * kinds: "Triggered email"), and wait for the site's answer: the dialog closes, or shows the errors of its form.
 *
 * Example #1: When I press "Save" in the dialog
 * Example #2: When we press "Cancel" in the dialog
 * Example #3: And I press "Add" in the dialog
 * Example #4: When I press "Send" in the dialog
 * Example #5: When I press "Triggered email" in the dialog
 */
When(/^(?:I|we) press "([^"]*)" in the dialog$/, { timeout: 90000 }, async function (name) {
  const page = this.page;
  const dialog = await h.waitForDialog(this, page);
  const re = new RegExp(`^\\s*${h.escapeRegExp(name)}\\b`, 'i');
  const buttons = dialog.locator.locator('.modal-footer button, .modal-body button, button.tile').filter({ visible: true });
  const button = buttons.filter({ hasText: re }).first();
  if (!(await button.count())) {
    throw friendly({ message: `The dialog "${dialog.title}" has no button "${name}". It offers ${h.listed(await buttons.allInnerTexts())}.`, hint: 'Name a button of the dialog as it is written.' });
  }
  await h.act(page, () => button.click(), h.budget(this) * 3);
  // The dialog goes, or stays with the errors of its form.
  await page.waitForFunction((id) => {
    const box = id ? document.getElementById(id) : null;
    return !box || !box.classList.contains('in') || !!box.querySelector('.has-error');
  }, dialog.id, { timeout: h.budget(this) * 2 }).catch(() => {});
  await h.settle(page);
});

/**
 * Search everything from the top of the page ("Search everything"), as a person does: the search box, the text,
 * Enter; the results come in groups ("Contacts", "Segments", …).
 *
 * Example #1: When I search everything for "Haddad"
 * Example #2: When we search everything for "Newsletter"
 * Example #3: And I search everything for "lina.haddad@example.com"
 * Example #4: When I search everything for "Spring webinar"
 * Example #5: When I search everything for "nothing-matches-this"
 */
When(/^(?:I|we) search everything for "([^"]*)"$/, async function (text) {
  const page = this.page;
  await onAdministration(this);
  await page.getByRole('button', { name: 'Search everything' }).click();
  const input = page.locator('#globalSearchInput');
  await input.waitFor({ state: 'visible', timeout: h.budget(this) });
  await input.fill(text);
  await h.act(page, () => input.press('Enter'));
  // The results come in their own request: the panel of results, or the words of no result.
  await page.waitForFunction(() => {
    const results = document.querySelector('#globalSearchResults');
    return !!results && (!!results.querySelector('#globalSearchPanel') || /no results|nothing/i.test(results.innerText));
  }, null, { timeout: h.budget(this) }).catch(() => {});
});

/**
 * Assert that the search of everything lists a result (its text, or a part of it), under a group when one is named
 * ("Contacts"), or does not.
 *
 * Example #1: Then the search results should list "Haddad, Lina"
 * Example #2: Then the search results should list "Haddad, Lina" under "Contacts"
 * Example #3: And the search results should not list "Saleh, Omar"
 * Example #4: Then the search results should list "Newsletter readers" under "Segments"
 * Example #5: Then the search results should not list "Haddad, Lina"
 */
Then(/^the search results should( not)? list "([^"]*)"(?: under "([^"]*)")?$/, async function (notCase, text, group) {
  const page = this.page;
  // The results: a heading per kind ("Contacts" and its count), then the results of that kind, each a link with
  // its name in bold ("Haddad, Lina") and, for a contact, its points.
  const read = () => page.evaluate(() => {
    const panel = document.querySelector('#globalSearchPanel');
    if (!panel) return [];
    const out = [];
    let current = '';
    for (const el of panel.children) {
      const badge = el.querySelector('.gs-count-badge');
      if (badge) {
        const copy = el.cloneNode(true);
        copy.querySelectorAll('.gs-count-badge').forEach((b) => b.remove());
        current = copy.textContent.replace(/\s+/g, ' ').trim();
        continue;
      }
      for (const a of el.querySelectorAll('a[href]')) {
        const name = a.querySelector('.fw-sb') || a;
        out.push({ group: current, text: name.textContent.replace(/\s+/g, ' ').trim() });
      }
    }
    return out;
  }).catch(() => []);
  const match = (r) => h.mentions(r.text, text) && (!group || h.mentions(r.group, group));
  if (notCase) {
    await page.waitForTimeout(500);
    const results = await read();
    if (results.some(match)) throw friendly({ message: `The search results list "${text}"${group ? ` under "${group}"` : ''}.`, hint: 'The search finds what the account may see.' });
    return;
  }
  await h.eventually(page, read, (results) => results.some(match), (results) => ({
    message: `The search results do not list "${text}"${group ? ` under "${group}"` : ''}. They list ${h.listed(results.map((r) => `${r.group}: ${r.text}`))}.`,
    hint: 'Search first (When I search everything for "…"); a contact is listed as "Last name, First name".',
  }), h.budget(this));
});
