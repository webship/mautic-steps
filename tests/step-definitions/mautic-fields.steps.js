'use strict';

// The forms of the administration (a contact, a segment, a form, a page, an
// asset, an email, a campaign, a stage, a point action, …) and the forms of
// its dialogs: a field found by its label, the way a person reads it, and set
// the way its kind needs (a text field, the rich text editor, the searchable
// picker of a list, a Yes/No switch, a set of choices); a field's error; a tab
// of the form; the buttons Save, Save & Close and Cancel of its toolbar.
//
// When a dialog is open its form is the one the steps work in; else the form
// of the page.

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./mautic-helpers');

/**
 * Set a field by its label (letter case and the required mark aside), the way its kind needs: a text in a text field
 * or the rich text editor, an option of a list ("Stage", "Category", "Contact owner"), "Yes" or "No" of a switch
 * ("Active", "Available for use"), one of a set of choices. A field in a tab that is not shown gets its tab opened.
 *
 * Example #1: When I set "First Name" to "Webship test"
 * Example #2: When I set "Name" to "Webship test segment"
 * Example #3: And I set "Stage" to "Lead"
 * Example #4: When I set "Active" to "Yes"
 * Example #5: When we set "Redirect URL/Message" to "Thank you for signing up."
 */
When(/^(?:I|we) set "([^"]*)" to "([^"]*)"$/, async function (label, value) {
  await h.setField(this, label, value === null || value === undefined ? '' : value);
});

/**
 * Set several fields at once, a row each: the label, then the value (see the step "I set … to …").
 *
 * Example #1: When I set the following fields:
 * Example #2: When we set the following fields:
 * Example #3: And I set the following fields:
 * Example #4: When I set the following fields:
 * Example #5: Then I set the following fields:
 */
When(/^(?:I|we) set the following fields:$/, async function (table) {
  for (const [label, value] of h.pairs(table)) await h.setField(this, label, value);
});

/**
 * Add a value to a field that holds several ("Tags", "Projects", "Contact segments"): an option it has, or, where the
 * field takes new ones (tags), a new value, made as the field makes it (Enter).
 *
 * Example #1: When I add "webship-test-tag" to "Tags"
 * Example #2: When we add "Newsletter readers" to "Contact segments"
 * Example #3: And I add "vip" to "Tags"
 * Example #4: When I add "webship-test-onboarded" to "Add tags"
 * Example #5: When I add "Amman contacts" to "Contact segments"
 */
When(/^(?:I|we) add "([^"]*)" to "([^"]*)"$/, async function (value, label) {
  const f = await h.field(this, label);
  if (!/multi/.test(f.kind)) {
    throw friendly({ message: `The field "${label}" holds one value: set it instead.`, hint: `When I set "${label}" to "${value}"` });
  }
  await h.chooseOption(this, f, value, { create: true });
});

/**
 * Assert the value of a field, by its label: its text, the options chosen in a list (several joined by ", "), "Yes"
 * or "No" of a switch, the choice made in a set of choices.
 *
 * Example #1: Then "First Name" should be set to "Webship test"
 * Example #2: Then "Active" should be set to "No"
 * Example #3: And "Stage" should be set to "Lead"
 * Example #4: Then "Internal Name" should be set to "Webship test email"
 * Example #5: Then "Storage Location" should be set to "Local"
 */
Then(/^"([^"]*)" should be set to "([^"]*)"$/, async function (label, expected) {
  const page = this.page;
  const want = expected === null || expected === undefined ? '' : expected;
  await h.eventually(page, () => h.fieldValue(this, label), (v) => h.normal(v) === h.normal(want), (v) => ({
    message: `"${label}" is set to "${v}", not "${want}".`,
    hint: 'A list shows its chosen options joined by ", "; a switch shows "Yes" or "No".',
  }), 5000);
});

/**
 * Assert that a field shows an error under it (or a part of it), after the site refused the form: "not-an-email
 * is invalid.", "A name is required.", "Passwords do not match.".
 *
 * Example #1: Then the field "Email" should show the error "is invalid."
 * Example #2: Then the field "Name" should show the error "A name is required."
 * Example #3: And the field "Password" should show the error "Passwords do not match."
 * Example #4: Then the field "Redirect URL/Message" should show the error "Fill in a message to display."
 * Example #5: Then the field "Subject" should show the error "A subject is required."
 */
Then(/^the field "([^"]*)" should show the error "([^"]*)"$/, async function (label, expected) {
  const page = this.page;
  await h.eventually(page, () => h.fieldError(this, label), (e) => h.mentions(e, expected), async (e) => ({
    message: `The field "${label}" shows ${e ? `the error "${e}"` : 'no error'}, not "${expected}". The form shows ${h.listed(await h.formErrors(page))}.`,
    hint: 'Send the form first; the site writes an error under the field it refuses.',
  }), h.budget(this));
});

/**
 * Open a tab of the page or of the open dialog by its name, the count it shows aside ("3 Notes" is the tab "Notes"):
 * "Filters" of a segment, "Fields" and "Actions" of a form, "Mapped Field" of a form's field, "Notes" of a contact.
 *
 * Example #1: When I open the "Filters" tab
 * Example #2: When we open the "Fields" tab
 * Example #3: And I open the "Notes" tab
 * Example #4: When I open the "Mapped Field" tab
 * Example #5: When I open the "Actions" tab
 */
When(/^(?:I|we) open the "([^"]*)" tab$/, async function (name) {
  await h.openTab(this, name);
});

/**
 * Save the form on screen with "Save" of its toolbar, and stay on it (the site goes on to the edit form of what it
 * saved), or see its errors.
 *
 * Example #1: When I save the form
 * Example #2: When we save the form
 * Example #3: And I save the form
 * Example #4: Then I save the form
 * Example #5: When I save the form
 */
When(/^(?:I|we) save the form$/, { timeout: 120000 }, async function () {
  await h.pressFormButton(this, 'save');
});

/**
 * Save the form on screen with "Save & Close" of its toolbar: the site goes to what it saved (or its list), or shows
 * the form again with its errors.
 *
 * Example #1: When I save and close the form
 * Example #2: When we save and close the form
 * Example #3: And I save and close the form
 * Example #4: Then I save and close the form
 * Example #5: When I save and close the form
 */
When(/^(?:I|we) save and close the form$/, { timeout: 120000 }, async function () {
  await h.pressFormButton(this, 'close');
});

/**
 * Leave the form on screen with "Cancel" of its toolbar, without saving.
 *
 * Example #1: When I cancel the form
 * Example #2: When we cancel the form
 * Example #3: And I cancel the form
 * Example #4: Then I cancel the form
 * Example #5: When I cancel the form
 */
When(/^(?:I|we) cancel the form$/, { timeout: 120000 }, async function () {
  await h.pressFormButton(this, 'cancel');
});
