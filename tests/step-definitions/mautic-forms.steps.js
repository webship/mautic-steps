'use strict';

// Forms the site makes and serves: a field or a submit action added to a form
// in its builder (each in a dialog of its own), the form a visitor fills in at
// its public address (/form/<id>), the message or the errors it answers with,
// and its results in the administration.
//
// The public form posts to a frame of the page; its script writes the form's
// message (`.mauticform-message`) or its errors (`.mauticform-errormsg` under a
// field, `.mauticform-error` above the form) when the site answered. The steps
// wait for those, never for a fixed time.

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./mautic-helpers');

/** Choose an entry of the picker of a builder tab ("Add a new field", "Add a new submit action"), and wait for its dialog. */
async function pickComponent(world, containerSelector, name, what) {
  const page = world.page;
  const container = page.locator(`${containerSelector} .chosen-container`).first();
  if (!(await container.count())) throw friendly({ message: `The form has no picker to add a ${what}: ${await h.pageSummary(page, world)}.`, hint: 'Open a form\'s edit page first (a new form, or Edit of a form).' });
  const select = page.locator(`${containerSelector} select.form-builder-new-component`).first();
  const options = await select.evaluate((s) => [...s.options].map((o) => o.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean));
  if (!options.some((o) => h.normal(o) === h.normal(name))) {
    throw friendly({ message: `The form offers no ${what} "${name}". It offers ${h.listed(options)}.`, hint: `Name a ${what} as the picker writes it.` });
  }
  await container.click();
  await container.locator('input').first().pressSequentially(name, { delay: 15 });
  const result = container.locator('.chosen-results li.active-result').filter({ hasText: new RegExp(`^\\s*${h.escapeRegExp(name)}\\s*$`, 'i') }).first();
  await result.click();
  return h.waitForDialog(world, page, name);
}

/** Set the fields of the dialog that is open from a table of label and value, then press its "Add" (or "Update") and wait for it to close. */
async function fillDialogAndAdd(world, table) {
  const page = world.page;
  for (const [label, value] of h.pairs(table)) await h.setField(world, label, value);
  const dialog = await h.openDialog(page);
  const add = dialog.locator.locator('.modal-footer button.btn-save').filter({ visible: true }).first();
  await h.act(page, () => add.click());
  await h.dialogClosed(page, h.budget(world) * 2);
  const still = await h.openDialog(page);
  if (still) throw friendly({ message: `The dialog "${still.title}" did not take what it was given: ${h.listed(await h.formErrors(page))}.`, hint: 'Fill in the required fields of the dialog.' });
}

/**
 * Add a field to the form being edited, as a person does: the "Fields" tab, its kind in "Add a new field", then its
 * dialog filled from a table of label and value (the "Label"; "Matching field" on the "Mapped Field" tab maps it to a
 * field of the contact), then "Add".
 *
 * Example #1: When I add a "Text: Short answer" field to the form with:
 * Example #2: When we add a "Email" field to the form with:
 * Example #3: And I add a "Text: Paragraph" field to the form with:
 * Example #4: When I add a "Select: Country" field to the form with:
 * Example #5: When I add a "Number" field to the form with:
 */
When(/^(?:I|we) add a "([^"]*)" field to the form with:$/, { timeout: 90000 }, async function (kind, table) {
  await h.openTab(this, 'Fields');
  await pickComponent(this, '#fields-container', kind, 'field');
  await fillDialogAndAdd(this, table);
});

/**
 * Add a submit action to the form being edited: the "Actions" tab, its kind in "Add a new submit action", then its
 * dialog filled from a table of label and value ("Name", "Amount to change points by", "Add tags"), then "Add".
 *
 * Example #1: When I add the submit action "Adjust contact's points" to the form with:
 * Example #2: When we add the submit action "Modify contact's tags" to the form with:
 * Example #3: And I add the submit action "Send email to user" to the form with:
 * Example #4: When I add the submit action "Modify contact's segments" to the form with:
 * Example #5: When I add the submit action "Update contact" to the form with:
 */
When(/^(?:I|we) add the submit action "([^"]*)" to the form with:$/, { timeout: 90000 }, async function (kind, table) {
  await h.openTab(this, 'Actions');
  await pickComponent(this, '#actions-container', kind, 'submit action');
  await fillDialogAndAdd(this, table);
});

/**
 * Assert that the form being edited holds a field with a label, or a submit action with a name (in its "Fields" or
 * "Actions" tab), or does not.
 *
 * Example #1: Then the form should hold the field "First name"
 * Example #2: Then the form should hold the action "Ten points for signing up"
 * Example #3: And the form should not hold the field "Phone"
 * Example #4: Then the form should hold the field "Email"
 * Example #5: Then the form should not hold the action "Ten points for signing up"
 */
Then(/^the form should( not)? hold the (field|action) "([^"]*)"$/, async function (notCase, kind, name) {
  const page = this.page;
  const read = () => page.evaluate((k) => {
    if (k === 'field') return [...document.querySelectorAll('#fields-container .panel label, #fields-container label.control-label, #fields-container .mauticform-label')].map((l) => l.textContent.replace(/\s+/g, ' ').trim());
    return [...document.querySelectorAll('#actions-container a[href*="/s/forms/action/edit/"]')].map((a) => a.textContent.replace(/\s+/g, ' ').trim());
  }, kind).catch(() => []);
  await h.eventually(page, read, (all) => all.some((n) => h.normal(n) === h.normal(name)) === !notCase, (all) => ({
    message: `The form ${notCase ? 'holds' : 'does not hold'} the ${kind} "${name}". It holds ${h.listed(all)}.`,
    hint: 'The fields are on the "Fields" tab of the form, the submit actions on its "Actions" tab.',
  }), h.budget(this));
});

/**
 * Open the public address of a form by its name (/form/<id>), as a visitor finds it: the form's id is read from the
 * list of forms by the managing account (`worldParameters.manager`), so the scenario's browser keeps its session.
 *
 * Example #1: When I open the public form "Newsletter sign-up"
 * Example #2: When we open the public form "Webship test form"
 * Example #3: And I open the public form "Newsletter sign-up"
 * Example #4: Given I open the public form "Newsletter sign-up"
 * Example #5: When I open the public form "Webship test sign-up"
 */
When(/^(?:I|we) open the public form "([^"]*)"$/, { timeout: 120000 }, async function (name) {
  const id = await h.idByName(this, 'forms', name);
  if (!id) throw friendly({ message: `There is no form "${name}" in the list of forms.`, hint: 'Name the form as the list of forms writes it; the build of the site makes "Newsletter sign-up".' });
  await h.open(this, `/form/${id}`);
  if (!(await this.page.locator('form[data-mautic-form]').count())) {
    throw friendly({ message: `The public address of "${name}" shows no form: ${await h.pageSummary(this.page, this)}.`, hint: 'A form that is not available for use is not served.' });
  }
});

/**
 * Send the public form on screen with its submit button, and wait for its answer: its message, or its errors.
 *
 * Example #1: When I send the public form
 * Example #2: When we send the public form
 * Example #3: And I send the public form
 * Example #4: Then I send the public form
 * Example #5: When I send the public form
 */
When(/^(?:I|we) send the public form$/, { timeout: 90000 }, async function () {
  const page = this.page;
  const form = page.locator('form[data-mautic-form]').first();
  if (!(await form.count())) throw friendly({ message: `The page shows no public form: ${await h.pageSummary(page, this)}.`, hint: 'Open the form first: When I open the public form "…".' });
  await form.locator('button[type="submit"], input[type="submit"]').first().click();
  await page.waitForFunction(() => {
    const f = document.querySelector('form[data-mautic-form]');
    if (!f) return true;
    const message = f.querySelector('.mauticform-message');
    const error = f.querySelector('.mauticform-error');
    const fieldErrors = [...f.querySelectorAll('.mauticform-errormsg')].some((e) => getComputedStyle(e).display !== 'none' && e.textContent.trim());
    return (message && message.textContent.trim()) || (error && error.textContent.trim()) || fieldErrors;
  }, null, { timeout: h.budget(this) * 3 }).catch(() => {});
});

/**
 * Assert the message the public form shows after it was sent ("Thank you for signing up."), or a part of it.
 *
 * Example #1: Then the public form should say "Thank you for signing up."
 * Example #2: Then the public form should say "Thank you"
 * Example #3: And the public form should say "Thank you for signing up."
 * Example #4: Then the public form should say "signing up"
 * Example #5: Then the public form should say "Thank you for your interest."
 */
Then(/^the public form should say "([^"]*)"$/, async function (expected) {
  const page = this.page;
  const read = () => page.evaluate(() => {
    const f = document.querySelector('form[data-mautic-form]');
    return f ? { message: (f.querySelector('.mauticform-message') || {}).textContent || '', error: (f.querySelector('.mauticform-error') || {}).textContent || '' } : { message: '', error: '' };
  }).catch(() => ({ message: '', error: '' }));
  await h.eventually(page, read, (r) => h.mentions(r.message, expected), (r) => ({
    message: `The public form does not say "${expected}". ${r.message.trim() ? `It says "${h.clean(r.message)}"` : (r.error.trim() ? `It shows the error "${h.clean(r.error)}"` : 'It shows no message')}.`,
    hint: 'Send the form first (When I send the public form); its message is the one its "Successful Submit Action" sets.',
  }), h.budget(this));
});

/**
 * Assert the error the public form shows under a field (by its label) after it was sent ("This is required."), or
 * a part of it.
 *
 * Example #1: Then the public form field "Email" should show the error "This is required."
 * Example #2: Then the public form field "Email" should show the error "required"
 * Example #3: And the public form field "Email" should show the error "This is required."
 * Example #4: Then the public form field "First name" should show the error "This is required."
 * Example #5: Then the public form field "Email" should show the error "This is required"
 */
Then(/^the public form field "([^"]*)" should show the error "([^"]*)"$/, async function (label, expected) {
  const page = this.page;
  const read = () => page.evaluate((wanted) => {
    const norm = (t) => String(t || '').replace(/\s+/g, ' ').trim().toLowerCase();
    for (const row of document.querySelectorAll('form[data-mautic-form] .mauticform-row')) {
      const l = row.querySelector('.mauticform-label');
      if (!l || norm(l.textContent) !== norm(wanted)) continue;
      const e = row.querySelector('.mauticform-errormsg');
      return { found: true, error: e && getComputedStyle(e).display !== 'none' ? e.textContent : '' };
    }
    return { found: false, error: '' };
  }, label).catch(() => ({ found: false, error: '' }));
  await h.eventually(page, read, (r) => r.found && h.mentions(r.error, expected), (r) => ({
    message: r.found ? `The public form field "${label}" shows ${h.clean(r.error) ? `the error "${h.clean(r.error)}"` : 'no error'}, not "${expected}".` : `The public form has no field "${label}".`,
    hint: 'Send the form first; a required field left empty says "This is required." under it.',
  }), h.budget(this));
});

/**
 * Assert that the results of a form (its page "Results for …" in the administration) list a submission with a text
 * (an address, a name), or do not.
 *
 * Example #1: Then the results of the form "Newsletter sign-up" should list "webship-test-signup@example.com"
 * Example #2: Then the results of the form "Newsletter sign-up" should not list "nobody@example.com"
 * Example #3: And the results of the form "Webship test form" should list "Webship"
 * Example #4: Then the results of the form "Newsletter sign-up" should list "Webship test"
 * Example #5: Then the results of the form "Newsletter sign-up" should not list "webship-test-never@example.com"
 */
Then(/^the results of the form "([^"]*)" should( not)? list "([^"]*)"$/, { timeout: 120000 }, async function (name, notCase, text) {
  const page = this.page;
  await h.openList(this, 'forms', name);
  const link = page.locator('#app-content table tbody tr td a[href*="/s/forms/view/"]:not(.dropdown-menu a)').filter({ hasText: new RegExp(h.escapeRegExp(name), 'i') }).first();
  if (!(await link.count())) throw friendly({ message: `The list of forms has no form "${name}".`, hint: 'Name the form as the list writes it.' });
  const id = ((await link.getAttribute('href')).match(/\/view\/(\d+)/) || [])[1];
  await h.openList(this, 'forms');
  await h.open(this, `/s/forms/results/${id}`);
  if (await h.isRefusal(page)) throw friendly({ message: `The site refused the results of "${name}" to this account.`, hint: 'The role of the account needs the right to see the form.' });
  await h.eventually(page, () => h.listRows(page), (rows) => rows.some((r) => h.mentions(r, text)) === !notCase, (rows) => ({
    message: `The results of the form "${name}" ${notCase ? 'list' : 'do not list'} "${text}". They list ${h.listed(rows)}.`,
    hint: 'The results are the submissions of the form, one a row, with the values of its fields.',
  }), h.budget(this));
});
