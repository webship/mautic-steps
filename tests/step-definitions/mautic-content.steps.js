'use strict';

// Test content: what a scenario starts from, and the removal of what it made.
// A Given step works as the managing account (`worldParameters.manager`,
// "administrator" by default), in a browser of its own, through the pages a
// person uses (a list, a row's Delete and its confirmation): the scenario's
// browser and its session stay as they are.
//
// Content a suite makes is named "Webship test …" (contacts, segments, forms,
// pages, assets, emails, campaigns, stages, point actions, categories),
// "webship-test-…" (tags, addresses): the build's tidy removes what a stopped
// run left.

const { Given, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./mautic-helpers');

/** The list of each kind of content a Given step removes, by the name a scenario gives the kind. */
const KINDS = {
  contact: 'contacts',
  company: 'companies',
  segment: 'segments',
  form: 'forms',
  'landing page': 'landing pages',
  asset: 'assets',
  email: 'emails',
  campaign: 'campaigns',
  stage: 'stages',
  'point action': 'point actions',
  tag: 'tags',
  category: 'categories',
};

/** How the name in a row is compared: a segment's row adds its alias in brackets, an email's its subject before it. */
function matcher(kind) {
  // A contact is named by its name, or by its address (a column of its row).
  if (kind === 'contact') return (text, name, rowText) => h.normal(text) === h.normal(name) || (/@/.test(name) && ` ${h.normal(rowText || '')} `.includes(` ${h.normal(name)} `));
  if (kind === 'segment') return (text, name) => h.normal(text) === h.normal(name) || h.normal(text).startsWith(`${h.normal(name)} (`);
  if (kind === 'email') return (text, name) => h.normal(text) === h.normal(name) || h.normal(text).endsWith(h.normal(name));
  return (text, name) => h.normal(text) === h.normal(name);
}

/**
 * Remove an item a scenario is about to make, or that a stopped run left, by its exact name: as the managing account,
 * the list of its kind searched for it, each matching row's Delete and its confirmation.
 *
 * Example #1: Given there is no contact "Webship test contact"
 * Example #2: Given there is no segment "Webship test segment"
 * Example #3: And there is no form "Webship test form"
 * Example #4: Given there is no landing page "Webship test page"
 * Example #5: Given there is no tag "webship-test-onboarded"
 */
Given(/^there is no (contact|company|segment|form|landing page|asset|email|campaign|stage|point action|tag|category) "([^"]*)"$/, { timeout: 180000 }, async function (kind, name) {
  await h.deleteByName(this, KINDS[kind], name, { cellMatch: matcher(kind) });
});

/** On a contact's page in a page of the managing account: the contact opened through its list. */
async function openContactIn(world, page, who) {
  await h.openIn(page, h.absolute(world, `/s/contacts?search=${encodeURIComponent(who)}`), h.budget(world) * 3);
  const link = page.locator('#leadTable tbody tr').filter({ hasText: new RegExp(h.escapeRegExp(who), 'i') }).first().locator('td a[href*="/s/contacts/view/"]:not(.dropdown-menu a)').first();
  if (!(await link.count())) throw friendly({ message: `There is no contact "${who}" for the managing account.`, hint: 'Name a contact the site has (the build makes Lina Haddad, Omar Saleh, Maya Nasser, Karim Aziz, Sara Khalil).' });
  const href = await link.getAttribute('href');
  await h.openIn(page, h.absolute(world, href), h.budget(world) * 3);
  await h.openIn(page, h.absolute(world, '/s/contacts?search='), h.budget(world) * 3).catch(() => {});
  await h.openIn(page, h.absolute(world, href), h.budget(world) * 3);
}

/**
 * Remove the notes of a contact that hold a text, as the managing account: the contact's "Notes" tab, each note's
 * delete button and its confirmation.
 *
 * Example #1: Given the contact "Lina Haddad" has no note "Webship test"
 * Example #2: Given the contact "Omar Saleh" has no note "Webship test: sent the brochure"
 * Example #3: And the contact "Karim Aziz" has no note "Webship test note"
 * Example #4: Given the contact "Lina Haddad" has no note "Webship test: called about the webinar"
 * Example #5: Given the contact "Maya Nasser" has no note "Webship test"
 */
Given(/^the contact "([^"]*)" has no note "([^"]*)"$/, { timeout: 180000 }, async function (who, text) {
  await h.asManager(this, async (page) => {
    await openContactIn(this, page, who);
    for (let round = 0; round < 10; round += 1) {
      const tab = page.locator('#app-content [role="tab"]').filter({ hasText: /Notes/ }).first();
      await tab.click();
      await h.settle(page);
      const note = page.locator('#LeadNotes li.note-single').filter({ hasText: new RegExp(h.escapeRegExp(text), 'i') }).first();
      if (!(await note.count())) return;
      await note.locator('a[data-toggle="confirmation"]').first().click();
      await h.answerConfirmation(this, page, 'Delete');
      await h.settle(page);
    }
  });
});

/**
 * Take a tag off a contact when it has it, as the managing account: the tag's "Dismiss" button on the contact's page,
 * and "Confirm" to the site's question.
 *
 * Example #1: Given the contact "Lina Haddad" has no tag "webship-test-tag"
 * Example #2: Given the contact "Omar Saleh" has no tag "webship-test-onboarded"
 * Example #3: And the contact "Karim Aziz" has no tag "webship-test-tag"
 * Example #4: Given the contact "Maya Nasser" has no tag "webship-test-onboarded"
 * Example #5: Given the contact "Lina Haddad" has no tag "webship-test-onboarded"
 */
Given(/^the contact "([^"]*)" has no tag "([^"]*)"$/, { timeout: 180000 }, async function (who, tag) {
  await h.asManager(this, async (page) => {
    await openContactIn(this, page, who);
    const label = page.locator('#app-content .tile a[id^="tag-"]').filter({ has: page.locator('button[aria-label="Dismiss"]') }).filter({ hasText: new RegExp(`^\\s*${h.escapeRegExp(tag)}\\s*$`, 'i') }).first();
    if (!(await label.count())) return;
    await label.locator('button[aria-label="Dismiss"]').click();
    await h.answerConfirmation(this, page, 'Confirm');
  });
});

/**
 * Assert, as the managing account, that the site holds an item of a kind by its exact name (made by the build, or by
 * an earlier step of the scenario), whatever the account the scenario is logged in as may see.
 *
 * Example #1: Then there should be a segment "Newsletter readers"
 * Example #2: Then there should be a form "Newsletter sign-up"
 * Example #3: And there should be a landing page "Spring webinar"
 * Example #4: Then there should be an asset "Product brochure"
 * Example #5: Then there should be a contact "Lina Haddad"
 */
Then(/^there should be (?:a|an) (contact|company|segment|form|landing page|asset|email|campaign|stage|point action|tag|category) "([^"]*)"$/, { timeout: 120000 }, async function (kind, name) {
  const found = await h.asManager(this, async (page) => {
    await h.openIn(page, h.absolute(this, `${h.listPath(KINDS[kind])}?search=${encodeURIComponent(h.searchText(name))}`), h.budget(this) * 3);
    const match = matcher(kind);
    const rows = await page.locator('#app-content table tbody tr').evaluateAll((trs) => trs.map((tr) => {
      const a = [...tr.querySelectorAll('td a[href*="/view/"], td a[href*="/edit/"]')].find((x) => !x.closest('.dropdown-menu'));
      return { text: a ? a.textContent : '', row: tr.innerText };
    })).catch(() => []);
    await h.openIn(page, h.absolute(this, `${h.listPath(KINDS[kind])}?search=`), h.budget(this) * 3).catch(() => {});
    const texts = rows.map((r) => h.clean(r.text)).filter(Boolean);
    return { ok: rows.some((r) => match(h.clean(r.text), name, h.clean(r.row))), texts };
  });
  if (!found.ok) throw friendly({ message: `There is no ${kind} "${name}". The list of ${KINDS[kind]} shows ${h.listed(found.texts)}.`, hint: 'The build of the site makes the sample content; a scenario makes its own "Webship test …" items.' });
});
