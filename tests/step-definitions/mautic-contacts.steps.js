'use strict';

// Contacts: a contact opened by its name or its address, what its page says
// (its points, tags, segments, company, owner, address), its history, its
// notes, a tag taken off it, a custom email sent to it, and what the site's
// scheduled tasks do to it (a campaign's action).
//
// A step that asserts something of a contact opens the contact's page itself,
// through the list of contacts, as the account logged in: an account that may
// see only its own contacts does not find another's.

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./mautic-helpers');

/**
 * Open a contact's page by its name or its address: the list of contacts searched for it, then its row's link.
 */
async function openContact(world, who) {
  const page = world.page;
  await h.openList(world, 'contacts', who);
  const row = page.locator('#leadTable tbody tr').filter({ hasText: new RegExp(h.escapeRegExp(h.clean(who)), 'i') }).first();
  if (!(await row.count())) {
    throw friendly({ message: `No contact "${who}" in the list of contacts: it shows ${h.listed(await h.listRows(page))}.`, hint: 'Name the contact by its first and last name, or its address. An account that sees only its own contacts finds no other.' });
  }
  await h.act(page, () => row.locator('td a[href*="/s/contacts/view/"]:not(.dropdown-menu a)').first().click(), h.budget(world) * 3);
  await page.locator('#app-content h1').first().waitFor({ timeout: h.budget(world) });
  // Leave the list's remembered search empty again.
  world.__contactsSearched = true;
}

/** The tiles of the right column of a contact's page by their title ("Tags", "Segments", "Companies"): the names they hold. */
async function tile(page, title) {
  return page.evaluate((wanted) => {
    for (const t of document.querySelectorAll('#app-content .tile')) {
      const head = t.querySelector('.d-flex > span, .fw-b');
      if (head && head.textContent.replace(/\s+/g, ' ').trim().toLowerCase() === wanted.toLowerCase()) {
        return [...t.querySelectorAll('a')].map((a) => (a.getAttribute('aria-label') || a.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
      }
    }
    return null;
  }, title).catch(() => null);
}

/** The details of the right column of a contact's page: each small heading ("Contact owner", "Email") and what follows it. */
async function details(page) {
  return page.evaluate(() => [...document.querySelectorAll('#app-content h6')].map((h) => ({
    label: h.textContent.replace(/\s+/g, ' ').trim(),
    value: ((h.nextElementSibling && h.nextElementSibling.tagName !== 'H6' && h.nextElementSibling.textContent) || '').replace(/\s+/g, ' ').trim(),
  }))).catch(() => []);
}

/** The points a contact's page shows ("25 points"). */
async function points(page) {
  const text = await page.evaluate(() => [...document.querySelectorAll('#app-content h1')].map((h) => h.textContent.replace(/\s+/g, ' ').trim()).find((t) => /^-?\d+ points?$/.test(t)) || '').catch(() => '');
  const m = text.match(/^(-?\d+)/);
  return m ? Number(m[1]) : null;
}

/** The events of a contact's history, as the rows of its table read. */
async function history(page) {
  return page.locator('#timeline-container tbody tr, #timeline-table tbody tr').evaluateAll((rows) => rows.map((r) => (r.innerText || '').replace(/\s+/g, ' ').trim()).filter(Boolean)).catch(() => []);
}

/** The notes of a contact's page: their texts. */
async function notes(page) {
  return page.locator('#LeadNotes li.note-single').evaluateAll((els) => els.map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim())).catch(() => []);
}

/**
 * Open a contact's page by its name ("Lina Haddad") or its address, through the list of contacts.
 *
 * Example #1: When I open the contact "Lina Haddad"
 * Example #2: When we open the contact "omar.saleh@example.com"
 * Example #3: And I open the contact "Maya Nasser"
 * Example #4: Given I open the contact "Karim Aziz"
 * Example #5: When I open the contact "webship-test-signup@example.com"
 */
When(/^(?:I|we) open the contact "([^"]*)"$/, { timeout: 90000 }, async function (who) {
  await openContact(this, who);
});

/**
 * Assert the points a contact has, on its page ("25 points").
 *
 * Example #1: Then the contact "Lina Haddad" should have 25 points
 * Example #2: Then the contact "omar.saleh@example.com" should have 40 points
 * Example #3: And the contact "webship-test-signup@example.com" should have 10 points
 * Example #4: Then the contact "Sara Khalil" should have 0 points
 * Example #5: Then the contact "Karim Aziz" should have 15 points
 */
Then(/^the contact "([^"]*)" should have (-?\d+) points?$/, { timeout: 90000 }, async function (who, count) {
  await openContact(this, who);
  const now = await points(this.page);
  if (now !== Number(count)) throw friendly({ message: `The contact "${who}" has ${now === null ? 'no points shown' : `${now} points`}, not ${count}.`, hint: 'The points are the figure under the contact\'s picture on its page.' });
});

/**
 * Assert that a contact has a tag (the "Tags" of its page), or does not.
 *
 * Example #1: Then the contact "Lina Haddad" should have the tag "newsletter"
 * Example #2: Then the contact "Sara Khalil" should not have the tag "newsletter"
 * Example #3: And the contact "Omar Saleh" should have the tag "vip"
 * Example #4: Then the contact "webship-test-signup@example.com" should have the tag "newsletter"
 * Example #5: Then the contact "Maya Nasser" should not have the tag "vip"
 */
Then(/^the contact "([^"]*)" should( not)? have the tag "([^"]*)"$/, { timeout: 90000 }, async function (who, notCase, tag) {
  await openContact(this, who);
  const tags = (await tile(this.page, 'Tags')) || [];
  const has = tags.some((t) => h.normal(t) === h.normal(tag));
  if (has === !!notCase) throw friendly({ message: `The contact "${who}" ${notCase ? 'has' : 'does not have'} the tag "${tag}". Its tags: ${h.listed(tags)}.`, hint: 'The tags are in the "Tags" tile of the contact\'s page.' });
});

/**
 * Assert that a contact is in a segment (the "Segments" of its page), or is not.
 *
 * Example #1: Then the contact "Lina Haddad" should be in the segment "Newsletter readers"
 * Example #2: Then the contact "Sara Khalil" should not be in the segment "Newsletter readers"
 * Example #3: And the contact "Maya Nasser" should be in the segment "Amman contacts"
 * Example #4: Then the contact "Omar Saleh" should not be in the segment "Amman contacts"
 * Example #5: Then the contact "Karim Aziz" should not be in the segment "Amman contacts"
 */
Then(/^the contact "([^"]*)" should( not)? be in the segment "([^"]*)"$/, { timeout: 90000 }, async function (who, notCase, segment) {
  await openContact(this, who);
  const segments = (await tile(this.page, 'Segments')) || [];
  const has = segments.some((s) => h.normal(s) === h.normal(segment));
  if (has === !!notCase) throw friendly({ message: `The contact "${who}" ${notCase ? 'is' : 'is not'} in the segment "${segment}". Its segments: ${h.listed(segments)}.`, hint: 'The segments are in the "Segments" tile of the contact\'s page; a segment of filters is built by the site\'s scheduled tasks.' });
});

/**
 * Assert that a contact works for a company (the "Companies" of its page), or does not.
 *
 * Example #1: Then the contact "Lina Haddad" should be at the company "Example Trading"
 * Example #2: Then the contact "Sara Khalil" should not be at the company "Example Trading"
 * Example #3: And the contact "Omar Saleh" should be at the company "Example Trading"
 * Example #4: Then the contact "Maya Nasser" should not be at the company "Example Trading"
 * Example #5: Then the contact "Karim Aziz" should not be at the company "Example Trading"
 */
Then(/^the contact "([^"]*)" should( not)? be at the company "([^"]*)"$/, { timeout: 90000 }, async function (who, notCase, company) {
  await openContact(this, who);
  const companies = (await tile(this.page, 'Companies')) || [];
  const has = companies.some((c) => h.mentions(c, company));
  if (has === !!notCase) throw friendly({ message: `The contact "${who}" ${notCase ? 'is' : 'is not'} at the company "${company}". Its companies: ${h.listed(companies)}.`, hint: 'The companies are in the "Companies" tile of the contact\'s page.' });
});

/**
 * Assert a detail of a contact's page, by its small heading in the right column ("Contact owner", "Address",
 * "Email", "Phone - mobile"): what it says, or a part of it.
 *
 * Example #1: Then the "Contact owner" of the contact "Lina Haddad" should be "Sales Test"
 * Example #2: Then the "Address" of the contact "Omar Saleh" should be "Irbid"
 * Example #3: And the "Email" of the contact "Maya Nasser" should be "maya.nasser@example.com"
 * Example #4: Then the "Contact owner" of the contact "Omar Saleh" should be "Marketer Test"
 * Example #5: Then the "Address" of the contact "Lina Haddad" should be "Amman, Jordan"
 */
Then(/^the "([^"]*)" of the contact "([^"]*)" should be "([^"]*)"$/, { timeout: 90000 }, async function (label, who, expected) {
  await openContact(this, who);
  const all = await details(this.page);
  const detail = all.find((d) => h.normal(d.label) === h.normal(label));
  if (!detail) throw friendly({ message: `The page of the contact "${who}" has no detail "${label}". It has ${h.listed(all.map((d) => d.label))}.`, hint: 'The details are the small headings of the right column of the contact\'s page.' });
  if (!h.mentions(detail.value, expected)) throw friendly({ message: `The "${label}" of the contact "${who}" is "${detail.value}", not "${expected}".`, hint: 'The text is compared as a part, letter case aside.' });
});

/**
 * Assert that a contact's history (the "History" tab of its page) shows an event (a part of its row): "Form
 * submitted", "Contact created", "Email sent", "Campaign action triggered", "Point gained".
 *
 * Example #1: Then the history of the contact "Lina Haddad" should show "Contact created"
 * Example #2: Then the history of the contact "webship-test-signup@example.com" should show "Form submitted"
 * Example #3: And the history of the contact "webship-test-signup@example.com" should show "Point gained"
 * Example #4: Then the history of the contact "Maya Nasser" should show "Email sent"
 * Example #5: Then the history of the contact "Omar Saleh" should show "Segment membership change"
 */
Then(/^the history of the contact "([^"]*)" should show "([^"]*)"$/, { timeout: 90000 }, async function (who, event) {
  await openContact(this, who);
  const page = this.page;
  await h.eventually(page, () => history(page), (rows) => rows.some((r) => h.mentions(r, event)), (rows) => ({
    message: `The history of the contact "${who}" does not show "${event}". It shows ${h.listed(rows.slice(0, 12))}.`,
    hint: 'The history is the first tab of the contact\'s page; each row names the event and its kind.',
  }), h.budget(this));
});

/**
 * Add a note to a contact, as a person does: its page, the "Notes" tab, "Add note", the text in the editor, Save.
 *
 * Example #1: When I add the note "Webship test: called about the webinar" to the contact "Lina Haddad"
 * Example #2: When we add the note "Webship test: sent the brochure" to the contact "Omar Saleh"
 * Example #3: And I add the note "Webship test note" to the contact "Karim Aziz"
 * Example #4: When I add the note "Webship test: asked for a call" to the contact "Lina Haddad"
 * Example #5: When I add the note "Webship test: met at the fair" to the contact "Maya Nasser"
 */
When(/^(?:I|we) add the note "([^"]*)" to the contact "([^"]*)"$/, { timeout: 90000 }, async function (text, who) {
  const page = this.page;
  await openContact(this, who);
  await h.openTab(this, 'Notes');
  const add = page.locator('#notes-container a').filter({ hasText: /Add note/ }).first();
  await add.waitFor({ state: 'visible', timeout: h.budget(this) });
  await h.act(page, () => add.click());
  const dialog = await h.waitForDialog(this, page, 'New note');
  const editor = dialog.locator.locator('.ck-editor__editable').first();
  await editor.waitFor({ state: 'visible', timeout: h.budget(this) });
  await editor.click();
  await page.keyboard.type(text);
  await h.act(page, () => dialog.locator.locator('.modal-footer .btn-save').first().click());
  await h.dialogClosed(page, h.budget(this));
  const still = await h.openDialog(page);
  if (still) throw friendly({ message: `The note dialog is still open: ${h.listed(await h.formErrors(page))}.`, hint: 'A note needs a text.' });
});

/**
 * Assert that the notes of a contact (the "Notes" tab of its page) list a note with a text, or do not.
 *
 * Example #1: Then the notes of the contact "Lina Haddad" should list "Webship test: called about the webinar"
 * Example #2: Then the notes of the contact "Lina Haddad" should not list "Webship test: called about the webinar"
 * Example #3: And the notes of the contact "Omar Saleh" should list "Webship test"
 * Example #4: Then the notes of the contact "Karim Aziz" should list "Webship test note"
 * Example #5: Then the notes of the contact "Maya Nasser" should not list "Webship test"
 */
Then(/^the notes of the contact "([^"]*)" should( not)? list "([^"]*)"$/, { timeout: 90000 }, async function (who, notCase, text) {
  const page = this.page;
  await openContact(this, who);
  await h.openTab(this, 'Notes');
  await h.eventually(page, () => notes(page), (all) => all.some((n) => h.mentions(n, text)) === !notCase, (all) => ({
    message: `The notes of the contact "${who}" ${notCase ? 'list' : 'do not list'} "${text}". They are ${h.listed(all)}.`,
    hint: 'The notes are in the "Notes" tab of the contact\'s page, each with its author and its date.',
  }), h.budget(this));
});

/**
 * Take a tag off a contact, as a person does: its page, the tag's "Dismiss" button in the "Tags" tile, and "Confirm"
 * to the site's question ("Are you sure you want to remove this tag from the contact?").
 *
 * Example #1: When I remove the tag "webship-test-tag" from the contact "Lina Haddad"
 * Example #2: When we remove the tag "vip" from the contact "Karim Aziz"
 * Example #3: And I remove the tag "webship-test-onboarded" from the contact "Maya Nasser"
 * Example #4: When I remove the tag "webship-test-tag" from the contact "Omar Saleh"
 * Example #5: When I remove the tag "newsletter" from the contact "webship-test-signup@example.com"
 */
When(/^(?:I|we) remove the tag "([^"]*)" from the contact "([^"]*)"$/, { timeout: 90000 }, async function (tag, who) {
  const page = this.page;
  await openContact(this, who);
  const label = page.locator('#app-content .tile a[id^="tag-"]').filter({ has: page.locator('button[aria-label="Dismiss"]') }).filter({ hasText: new RegExp(`^\\s*${h.escapeRegExp(tag)}\\s*$`, 'i') }).first();
  if (!(await label.count())) throw friendly({ message: `The contact "${who}" has no tag "${tag}" to remove. Its tags: ${h.listed((await tile(page, 'Tags')) || [])}.`, hint: 'A tag is taken off with the cross on it, in the "Tags" tile.' });
  await label.locator('button[aria-label="Dismiss"]').click();
  // The site asks first: "Are you sure you want to remove this tag from the contact?" (Cancel, Confirm).
  await h.answerConfirmation(this, page, 'Confirm');
  const gone = await page.waitForFunction((t) => ![...document.querySelectorAll('#app-content .tile a[id^="tag-"]')].some((a) => (a.getAttribute('aria-label') || '').toLowerCase() === t.toLowerCase() && a.querySelector('button[aria-label="Dismiss"]')), tag, { timeout: h.budget(this) }).then(() => true).catch(() => false);
  if (!gone) throw friendly({ message: `The tag "${tag}" is still on the contact "${who}" after its removal was confirmed.`, hint: 'The cross on a tag asks "Are you sure you want to remove this tag from the contact?", then the tag goes.' });
});

/**
 * Send a contact an email of one's own from its page, as a person does: "Send email", then the subject and the text
 * in the dialog, then "Send". The mail goes to the site's mail catcher.
 *
 * Example #1: When I send the contact "Lina Haddad" an email with the subject "Webship test: our webinar" saying "Thank you for joining."
 * Example #2: When we send the contact "Omar Saleh" an email with the subject "Webship test" saying "Hello."
 * Example #3: And I send the contact "maya.nasser@example.com" an email with the subject "Webship test: a brochure" saying "Here it is."
 * Example #4: When I send the contact "Karim Aziz" an email with the subject "Webship test: a call" saying "When can we talk?"
 * Example #5: When I send the contact "Lina Haddad" an email with the subject "Webship test: welcome" saying "Welcome!"
 */
When(/^(?:I|we) send the contact "([^"]*)" an email with the subject "([^"]*)" saying "([^"]*)"$/, { timeout: 90000 }, async function (who, subject, text) {
  const page = this.page;
  await openContact(this, who);
  const send = page.locator('#app-content #toolbar a[href*="/s/contacts/email/"], #app-content a[aria-label="Send email"]').first();
  if (!(await send.count())) throw friendly({ message: `The page of the contact "${who}" has no "Send email".`, hint: 'The button is in the toolbar of the contact\'s page; the contact needs an address.' });
  await h.act(page, () => send.click());
  const dialog = await h.waitForDialog(this, page, 'Send a custom email to');
  await dialog.locator.getByRole('textbox', { name: /^Subject/ }).fill(subject);
  const editor = dialog.locator.locator('.ck-editor__editable').first();
  await editor.click();
  await page.keyboard.type(text);
  await h.act(page, () => dialog.locator.locator('.modal-footer button').filter({ hasText: /Send/ }).first().click());
  await h.dialogClosed(page, h.budget(this) * 2);
  const still = await h.openDialog(page);
  if (still) throw friendly({ message: `The email was not sent: the dialog is still open, with ${h.listed(await h.formErrors(page))}.`, hint: 'The email needs a subject and a text.' });
});

/**
 * Assert that the site's scheduled tasks give a contact a tag: a campaign's action, or a segment that feeds a
 * campaign. The step opens the contact's page again every five seconds until the tag is there (180 seconds at most,
 * SCHEDULED_TASKS_TIMEOUT): the tasks run on the site's own schedule.
 *
 * Example #1: Then the contact "Lina Haddad" should have the tag "webship-test-onboarded" once the scheduled tasks have run
 * Example #2: Then the contact "Omar Saleh" should have the tag "webship-test-onboarded" once the scheduled tasks have run
 * Example #3: And the contact "Maya Nasser" should have the tag "webship-test-onboarded" once the scheduled tasks have run
 * Example #4: Then the contact "lina.haddad@example.com" should have the tag "webship-test-nurtured" once the scheduled tasks have run
 * Example #5: Then the contact "Karim Aziz" should have the tag "webship-test-onboarded" once the scheduled tasks have run
 */
Then(/^the contact "([^"]*)" should have the tag "([^"]*)" once the scheduled tasks have run$/, { timeout: 300000 }, async function (who, tag) {
  const page = this.page;
  const deadline = Date.now() + h.scheduledBudget();
  let tags = [];
  for (;;) {
    await openContact(this, who);
    tags = (await tile(page, 'Tags')) || [];
    if (tags.some((t) => h.normal(t) === h.normal(tag))) return;
    if (Date.now() > deadline) break;
    await page.waitForTimeout(5000);
  }
  throw friendly({
    message: `The contact "${who}" did not get the tag "${tag}" in ${Math.round(h.scheduledBudget() / 1000)} seconds. Its tags: ${h.listed(tags)}.`,
    hint: 'The site\'s scheduled tasks (its cron: the segments, then the campaigns) give it; check that they run on the site, and that the campaign is active and its source holds the contact.',
  });
});

module.exports = { openContact, tile, details, points, history, notes };
