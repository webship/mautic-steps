'use strict';

// Campaigns: the builder of a campaign (a canvas over the page), its source of
// contacts (a segment), an action after it (each event in a dialog of its own),
// and what the canvas shows. The builder is closed before the campaign is
// saved; the site's scheduled tasks then run the campaign.

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./mautic-helpers');

/** Whether the builder is open over the page. */
async function builderOpen(page) {
  return page.evaluate(() => { const b = document.querySelector('#campaign-builder'); return !!b && getComputedStyle(b).display !== 'none'; }).catch(() => false);
}

/** The names the events of the canvas show (the source's segments, each event's kind and name). */
async function canvasEvents(page) {
  return page.locator('#CampaignCanvas [id^="CampaignEvent_"]:not(#CampaignEvent_newsource_hide)').evaluateAll((els) => els.map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim()).filter(Boolean)).catch(() => []);
}

/** Fail unless the builder is open. */
async function needBuilder(world) {
  if (!(await builderOpen(world.page))) {
    throw friendly({ message: `The campaign builder is not open: ${await h.pageSummary(world.page, world)}.`, hint: 'Open it first: When I open the campaign builder (on a campaign\'s edit page).' });
  }
}

/**
 * Open the builder of the campaign being edited: "Launch Campaign Builder" of its toolbar.
 *
 * Example #1: When I open the campaign builder
 * Example #2: When we open the campaign builder
 * Example #3: And I open the campaign builder
 * Example #4: Then I open the campaign builder
 * Example #5: When I open the campaign builder
 */
When(/^(?:I|we) open the campaign builder$/, async function () {
  const page = this.page;
  const button = page.locator('#app-content button').filter({ hasText: /Launch Campaign Builder/ }).filter({ visible: true }).first();
  if (!(await button.count())) throw friendly({ message: `The page has no "Launch Campaign Builder": ${await h.pageSummary(page, this)}.`, hint: 'Open a new campaign, or the edit page of one.' });
  await h.act(page, () => button.click());
  await page.waitForFunction(() => { const b = document.querySelector('#campaign-builder'); return b && getComputedStyle(b).display !== 'none'; }, null, { timeout: h.budget(this) });
});

/**
 * Give the campaign in the builder its source of contacts: "Add a contact source...", "Contact segments", then the
 * segment in the dialog's "Contact segments", then "Add".
 *
 * Example #1: When I add the segment "Newsletter readers" as the source of the campaign
 * Example #2: When we add the segment "Amman contacts" as the source of the campaign
 * Example #3: And I add the segment "Newsletter readers" as the source of the campaign
 * Example #4: When I add the segment "Webship test segment" as the source of the campaign
 * Example #5: When I add the segment "Amman contacts" as the source of the campaign
 */
When(/^(?:I|we) add the segment "([^"]*)" as the source of the campaign$/, { timeout: 90000 }, async function (segment) {
  const page = this.page;
  await needBuilder(this);
  // A new campaign's builder opens with the list of sources shown; else "Add a contact source..." shows it.
  const sources = page.locator('#SourceList_chosen');
  const item = sources.locator('.chosen-results li.active-result').filter({ hasText: /^\s*Contact segments\s*$/ }).first();
  if (!(await item.isVisible().catch(() => false))) {
    await page.locator('#CampaignCanvas [id^="CampaignEvent_newsource"]').first().click();
    await sources.waitFor({ state: 'visible', timeout: h.budget(this) });
    if (!(await item.isVisible().catch(() => false))) await sources.click();
  }
  await item.click();
  const dialog = await h.waitForDialog(this, page, 'Contact Source');
  await dialog.locator.locator('.modal-body form').waitFor({ timeout: h.budget(this) });
  const f = await h.field(this, 'Contact segments');
  await h.chooseOption(this, f, segment);
  await h.act(page, () => dialog.locator.locator('.modal-footer button.btn-save').filter({ visible: true }).first().click());
  await h.dialogClosed(page, h.budget(this));
  await h.eventually(page, () => canvasEvents(page), (all) => all.some((e) => h.mentions(e, segment)), (all) => ({
    message: `The canvas does not show the source "${segment}". It shows ${h.listed(all)}.`,
    hint: 'The source shows on the canvas once its dialog took the segment.',
  }), h.budget(this));
});

/**
 * Add an action after the source of the campaign in the builder: the dot under the source, "Action", the action's
 * kind in the list ("Modify contact's tags", "Adjust contact points", "Send email"), then its dialog filled from a
 * table of label and value ("Name", "Add tags", "Points"), then "Add".
 *
 * Example #1: When I add the action "Modify contact's tags" to the campaign with:
 * Example #2: When we add the action "Adjust contact points" to the campaign with:
 * Example #3: And I add the action "Send email" to the campaign with:
 * Example #4: When I add the action "Change contact's stage" to the campaign with:
 * Example #5: When I add the action "Modify contact's segments" to the campaign with:
 */
When(/^(?:I|we) add the action "([^"]*)" to the campaign with:$/, { timeout: 120000 }, async function (kind, table) {
  const page = this.page;
  await needBuilder(this);
  const dot = page.locator('#CampaignCanvas .jtk-endpoint.jtk-endpoint-anchor-leadsource').first();
  if (!(await dot.count())) throw friendly({ message: 'The campaign has no source to add an action after.', hint: 'Add a source first: When I add the segment "…" as the source of the campaign.' });
  await dot.click();
  const tile = page.locator('#CampaignEventPanel button[data-type="Action"]').first();
  await tile.waitFor({ state: 'visible', timeout: h.budget(this) });
  await tile.click();
  const list = page.locator('#ActionList');
  const offered = await list.evaluate((s) => [...s.options].map((o) => o.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean));
  if (!offered.some((o) => h.normal(o) === h.normal(kind))) throw friendly({ message: `The campaign offers no action "${kind}". It offers ${h.listed(offered)}.`, hint: 'Name an action as the list writes it.' });
  // The list of actions is a searchable picker: the kind typed in its search, the match chosen with Enter (the
  // list can be longer than the canvas shows).
  const chosen = page.locator('#ActionList_chosen');
  await chosen.waitFor({ state: 'visible', timeout: h.budget(this) });
  const search = chosen.locator('.chosen-search input, .chosen-search-input').first();
  if (!(await search.isVisible().catch(() => false))) await chosen.click();
  await search.pressSequentially(kind, { delay: 15 });
  const highlighted = chosen.locator('.chosen-results li.active-result.highlighted').first();
  await highlighted.waitFor({ state: 'attached', timeout: h.budget(this) });
  const picked = h.clean(await highlighted.textContent());
  if (h.normal(picked) !== h.normal(kind)) {
    const exact = chosen.locator('.chosen-results li.active-result').filter({ hasText: new RegExp(`^\\s*${h.escapeRegExp(kind)}\\s*$`, 'i') }).first();
    await exact.hover();
  }
  await search.press('Enter');
  const dialog = await h.waitForDialog(this, page, kind);
  await dialog.locator.locator('.modal-body form').waitFor({ timeout: h.budget(this) });
  const pairs = h.pairs(table);
  for (const [label, value] of pairs) {
    const f = await h.field(this, label);
    if (/multi/.test(f.kind)) await h.chooseOption(this, f, value, { create: true });
    else await h.setField(this, label, value);
  }
  await h.act(page, () => dialog.locator.locator('.modal-footer button.btn-save').filter({ visible: true }).first().click());
  await h.dialogClosed(page, h.budget(this));
  const still = await h.openDialog(page);
  if (still) throw friendly({ message: `The action's dialog did not take what it was given: ${h.listed(await h.formErrors(page))}.`, hint: 'Fill in the required fields of the action.' });
  const name = (pairs.find(([l]) => h.normal(l) === 'name') || [])[1];
  if (name) {
    await h.eventually(page, () => canvasEvents(page), (all) => all.some((e) => h.mentions(e, name)), (all) => ({
      message: `The canvas does not show the action "${name}". It shows ${h.listed(all)}.`,
      hint: 'An action shows on the canvas, under its source, once its dialog took it.',
    }), h.budget(this));
  }
});

/**
 * Close the campaign builder ("Close Builder"): the campaign's form is on screen again, to save.
 *
 * Example #1: When I close the campaign builder
 * Example #2: When we close the campaign builder
 * Example #3: And I close the campaign builder
 * Example #4: Then I close the campaign builder
 * Example #5: When I close the campaign builder
 */
When(/^(?:I|we) close the campaign builder$/, async function () {
  const page = this.page;
  await needBuilder(this);
  await page.getByRole('button', { name: 'Close Builder' }).click();
  await page.waitForFunction(() => { const b = document.querySelector('#campaign-builder'); return !b || getComputedStyle(b).display === 'none'; }, null, { timeout: h.budget(this) });
  await h.settle(page);
});

/**
 * Assert that the canvas of the campaign builder shows an event (the source's segment, an action's name or kind), or
 * does not.
 *
 * Example #1: Then the campaign builder should show "Newsletter readers"
 * Example #2: Then the campaign builder should show "Webship test: tag the readers"
 * Example #3: And the campaign builder should show "Change tags"
 * Example #4: Then the campaign builder should not show "Send email"
 * Example #5: Then the campaign builder should show "Contact source"
 */
Then(/^the campaign builder should( not)? show "([^"]*)"$/, async function (notCase, text) {
  const page = this.page;
  await needBuilder(this);
  await h.eventually(page, () => canvasEvents(page), (all) => all.some((e) => h.mentions(e, text)) === !notCase, (all) => ({
    message: `The campaign builder ${notCase ? 'shows' : 'does not show'} "${text}". It shows ${h.listed(all)}.`,
    hint: 'The canvas shows the source of the campaign and its events by their kind and name.',
  }), h.budget(this));
});
