'use strict';

// The session: logging in to the administration by a handle of the users
// registry or with a user name and a password, the refusal of the login form,
// logging out, who is logged in, the pages an account may not open, and the
// password reset the login page offers.
//
// Accounts are configuration, not test data: they are listed in cucumber.js
// (`worldParameters.users`) and made once by the build of the site. A feature
// never creates or deletes an account.

const { Given, When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./mautic-helpers');

/**
 * Log in to the administration as an account of the users registry (`worldParameters.users` in cucumber.js), by
 * its handle. An account that logged in earlier in the run takes its session over; otherwise the step logs in
 * through the login form.
 *
 * Example #1: Given I am a logged in user with the "marketer" user
 * Example #2: Given we are a logged in user with the "administrator" user
 * Example #3: Given I am a logged in user with "sales"
 * Example #4: And I am a logged in user with the "marketer" user
 * Example #5: Given we are a logged in user with the "sales" user
 */
Given(/^(I am |we are )*a logged in user with( the)* "([^"]*)"( user)*$/, { timeout: 120000 }, async function (pronounCase, theCase, handle, userCase) {
  await h.logInAs(this, handle);
  if (!/\/s\//.test(this.page.url()) || (await h.isLoginPage(this.page))) await h.open(this, '/s/dashboard');
});

/**
 * Log in through the login form as an account of the users registry, as a person does: a new session, never one
 * taken over. For the scenarios that test the form itself; the step fails when the site refuses the login.
 *
 * Example #1: When I log in as "marketer" with the login form
 * Example #2: When we log in as "sales" with the login form
 * Example #3: And I log in as "administrator" with the login form
 * Example #4: When I log in as "sales" with the login form
 * Example #5: Then we log in as "marketer" with the login form
 */
When(/^(I |we )*log in as "([^"]*)" with the login form$/, { timeout: 120000 }, async function (pronounCase, handle) {
  const user = h.resolveUser(this, handle);
  const outcome = await h.submitLogin(this, this.page, user.username, user.password);
  if (!outcome.ok) {
    throw friendly({
      message: `The login form refused "${handle}" (${user.username}): ${h.listed(outcome.errors)}.`,
      hint: outcome.cut ? h.CUT_HINT : 'Check the user name and the password of the account in worldParameters.users in cucumber.js.',
    });
  }
  h.SESSIONS.set(h.sessionKey(this, user.username), await this.page.context().cookies());
  this.__account = user.username;
});

/**
 * Send the login form with a user name (or an email address) and a password. The step does not expect the login to
 * succeed: assert the outcome with the next step.
 *
 * Example #1: When I log in with the username "nobody" and the password "Wrong-password-1"
 * Example #2: When we log in with the username "sales" and the password "Not-the-password-2"
 * Example #3: And I log in with the username "marketer@example.com" and the password "Wrong-password-3"
 * Example #4: When I log in with the username "marketer" and the password "dD.123123ddd"
 * Example #5: When we log in with the username "administrator" and the password "wrong"
 */
When(/^(I |we )*log in with the username "([^"]*)" and the password "([^"]*)"$/, { timeout: 120000 }, async function (pronounCase, username, password) {
  const outcome = await h.submitLogin(this, this.page, username || '', password || '');
  this.__loginOutcome = outcome;
  this.__account = outcome.ok ? h.accountOf(this, username).username : null;
});

/**
 * Assert that the login page refused the login with a message (or a part of it), and that nobody is logged in.
 * The site says the same for an unknown account and a wrong password: "Invalid login. Please verify credentials."
 *
 * Example #1: Then the login should be refused with "Invalid login. Please verify credentials."
 * Example #2: Then the login should be refused with "Invalid login"
 * Example #3: And the login should be refused with "Please verify credentials."
 * Example #4: Then the login should be refused with "verify credentials"
 * Example #5: Then the login should be refused with "Invalid login. Please verify credentials."
 */
Then(/^the login should be refused with "([^"]*)"$/, async function (expected) {
  const page = this.page;
  const who = await h.signedInUsername(this, page);
  const said = await h.messages(page);
  if (who || !(await h.isLoginPage(page)) || !said.some((m) => h.mentions(m.text, expected))) {
    throw friendly({
      message: who
        ? `The login was not refused: "${who}" is logged in; ${await h.pageSummary(page, this)}.`
        : `The login page did not refuse the login with "${expected}". It says ${h.listed(said.map((m) => m.text))}; ${await h.pageSummary(page, this)}.`,
      hint: said.some((m) => /too many failed login attempts/i.test(m.text))
        ? h.loginHint(page, said.map((m) => m.text))
        : h.hintFor(page, 'Send the form first (When I log in with the username "…" and the password "…"); the site writes its refusal at the top of the login page.'),
    });
  }
});

/**
 * Start as a visitor of the site: no session (the cookies of the browser cleared), on the login page of the
 * administration.
 *
 * Example #1: Given I am not logged in
 * Example #2: Given we are not logged in
 * Example #3: And I am not logged in
 * Example #4: Given I am not logged in
 * Example #5: When we are not logged in
 */
Given(/^(I am |we are )*not logged in$/, async function (pronounCase) {
  await this.page.context().clearCookies();
  this.__account = null;
  await h.open(this, '/s/login');
});

/**
 * Log out as a person does: "Logout" in the profile menu at the top right; the site answers with its login page.
 * On a page without that menu, the step opens the dashboard first.
 *
 * Example #1: When I log out
 * Example #2: When we log out
 * Example #3: And I log out
 * Example #4: Then I log out
 * Example #5: Given I log out
 */
When(/^(I |we )*log out$/, { timeout: 90000 }, async function (pronounCase) {
  const page = this.page;
  if (!(await page.locator('#app-header [aria-label="Profile"]').count())) await h.open(this, '/s/dashboard');
  const profile = page.locator('#app-header a[aria-label="Profile"]').first();
  if (!(await profile.count())) {
    throw friendly({ message: `Nobody is logged in: ${await h.pageSummary(page, this)}.`, hint: 'Log in first: Given I am a logged in user with the "marketer" user.' });
  }
  await profile.click();
  const link = page.locator('#app-header a[href$="/s/logout"]').first();
  await link.waitFor({ state: 'visible', timeout: h.budget(this) });
  await h.act(page, () => link.click());
  if (this.__account) h.forgetSession(this, this.__account);
  this.__account = null;
});

/**
 * Assert who is logged in: the user name the account page of the browser's session shows, against an account of
 * the users registry (its handle) or a user name.
 *
 * Example #1: Then I should be logged in as "marketer"
 * Example #2: Then we should be logged in as "administrator"
 * Example #3: And I should be logged in as "sales"
 * Example #4: Then I should be logged in as "marketer"
 * Example #5: Then we should be logged in as "sales"
 */
Then(/^(I |we )*should be logged in as "([^"]*)"$/, async function (pronounCase, who) {
  const wanted = h.accountOf(this, who).username;
  const now = await h.signedInUsername(this, this.page);
  if (now.toLowerCase() !== String(wanted).toLowerCase()) {
    throw friendly({
      message: now ? `"${now}" is logged in, not "${wanted}".` : `Nobody is logged in; "${wanted}" was expected. ${await h.pageSummary(this.page, this)}.`,
      hint: h.hintFor(this.page, 'Log in first, by the handle of the account in the users registry.'),
    });
  }
});

/**
 * Assert whether anybody is logged in to the browser (its session, as the site answers it).
 *
 * Example #1: Then I should not be logged in
 * Example #2: Then I should be logged in
 * Example #3: And we should not be logged in
 * Example #4: Then we should be logged in
 * Example #5: But I should not be logged in
 */
Then(/^(I |we )*should( not)* be logged in$/, async function (pronounCase, notCase) {
  const now = await h.signedInUsername(this, this.page);
  if (notCase && now) throw friendly({ message: `"${now}" is logged in.`, hint: 'Log out first: When I log out.' });
  if (!notCase && !now) throw friendly({ message: `Nobody is logged in. ${await h.pageSummary(this.page, this)}.`, hint: 'Log in first: Given I am a logged in user with the "marketer" user.' });
});

/**
 * Assert that the browser is on the login page of the administration, saying a message (or a part of it) when
 * one is given.
 *
 * Example #1: Then I should be on the login page
 * Example #2: Then we should be on the login page
 * Example #3: Then I should be on the login page saying "A new password has been generated and will be emailed to you"
 * Example #4: And I should be on the login page saying "you have successfully reset your password"
 * Example #5: Then we should be on the login page saying "Invalid login"
 */
Then(/^(?:I|we) should be on the login page(?: saying "([^"]*)")?$/, async function (expected) {
  const page = this.page;
  await h.settle(page);
  if (!(await h.isLoginPage(page))) {
    throw friendly({ message: `The page is not the login page: ${await h.pageSummary(page, this)}.`, hint: h.hintFor(page, 'The login page is /s/login, with the fields "Username or email" and "Password".') });
  }
  if (expected) await h.expectMessage(this, expected, 'The login page writes its message at the top of the form.');
});

/**
 * Open a page of the site and assert that the site refuses it to the account logged in (403 Forbidden, "Tsk tsk.
 * Apparently you don't have access to this area."), or, to a visitor, sends the browser to the login page.
 *
 * Example #1: Then I should not be allowed to open "/s/campaigns"
 * Example #2: Then we should not be allowed to open "/s/users"
 * Example #3: And I should not be allowed to open "/s/config/edit"
 * Example #4: Then I should not be allowed to open "/s/emails/new"
 * Example #5: Then I should not be allowed to open "/s/contacts"
 */
Then(/^(I |we )*should not be allowed to open "([^"]*)"$/, async function (pronounCase, path) {
  const page = this.page;
  const response = await h.open(this, path);
  const status = response ? response.status() : null;
  if (await h.isRefusal(page)) {
    if (status !== null && status !== 403) throw friendly({ message: `The site showed its refusal page for ${path} with the status ${status}, not 403.`, hint: 'A refused page answers 403 Forbidden.' });
    return;
  }
  if (await h.isLoginPage(page)) return;
  throw friendly({
    message: `The site let this browser open ${path}: ${await h.pageSummary(page, this)}${status ? ` (status ${status})` : ''}.`,
    hint: h.hintFor(page, 'An account whose role has no right to a part of the site gets "Tsk tsk. Apparently you don\'t have access to this area." (403); a visitor goes to the login page.'),
  });
});

/**
 * Ask for a password reset, as a person does on the page the login page links to ("Forgot your password?"): the
 * account's user name (from the users registry) or an address in "Username or email", then "Reset password". The
 * site answers on the login page that a mail is on its way, whether or not the account exists.
 *
 * Example #1: When I ask for a password reset link for "sales"
 * Example #2: When we ask for a password reset link for "marketer"
 * Example #3: And I ask for a password reset link for "nobody@example.com"
 * Example #4: When I ask for a password reset link for "sales@example.com"
 * Example #5: When we ask for a password reset link for "administrator"
 */
When(/^(I |we )*ask for a password reset link for "([^"]*)"$/, { timeout: 90000 }, async function (pronounCase, who) {
  const page = this.page;
  const account = h.accountOf(this, who);
  await page.context().clearCookies();
  this.__account = null;
  await h.open(this, '/passwordreset');
  const input = page.getByRole('textbox', { name: /Username or email/ });
  if (!(await input.count())) throw friendly({ message: `The password reset page has no "Username or email" field: ${await h.pageSummary(page, this)}.`, hint: 'The page is /passwordreset, linked from the login page as "Forgot your password?".' });
  await input.fill(account.password ? account.username : who);
  await h.act(page, () => page.getByRole('button', { name: 'Reset password' }).click());
});

/** Fill in and send the form of the reset link: the account's user name and a password, twice. */
async function setPasswordOnResetPage(world, who, confirmation) {
  const page = world.page;
  const user = h.resolveUser(world, who);
  const form = page.locator('form').filter({ has: page.locator('input[type="password"]') }).first();
  if (!(await form.count()) || !/passwordresetconfirm/.test(page.url())) {
    throw friendly({ message: `The page is not the form of a reset link: ${await h.pageSummary(page, world)}.`, hint: 'Open the link of the reset mail first: When I open the link of the email with the subject "password reset" to "sales".' });
  }
  const passwords = form.locator('input[type="password"]');
  await form.getByRole('textbox', { name: /Username or email/ }).fill(user.username);
  await passwords.nth(0).fill(user.password);
  await passwords.nth(1).fill(confirmation === undefined ? user.password : confirmation);
  await h.act(page, () => form.getByRole('button', { name: 'Reset password' }).click());
}

/**
 * On the form the reset mail links to, set the account's password to the one the users registry gives it (so the
 * suite can run again), and send it. The site answers on the login page.
 *
 * Example #1: When I set the password of "sales" on the reset page
 * Example #2: When we set the password of "marketer" on the reset page
 * Example #3: And I set the password of "sales" on the reset page
 * Example #4: When I set the password of "administrator" on the reset page
 * Example #5: Then we set the password of "sales" on the reset page
 */
When(/^(?:I|we) set the password of "([^"]*)" on the reset page$/, { timeout: 90000 }, async function (who) {
  await setPasswordOnResetPage(this, who);
});

/**
 * On the form the reset mail links to, send the account's password with another confirmation: the site refuses it
 * ("Passwords do not match.") and keeps the old password.
 *
 * Example #1: When I set the password of "sales" on the reset page with the confirmation "Something-else-1"
 * Example #2: When we set the password of "marketer" on the reset page with the confirmation "Other-2"
 * Example #3: And I set the password of "sales" on the reset page with the confirmation ""
 * Example #4: When I set the password of "sales" on the reset page with the confirmation "dD.123123dd"
 * Example #5: When we set the password of "sales" on the reset page with the confirmation "Not-the-same-3"
 */
When(/^(?:I|we) set the password of "([^"]*)" on the reset page with the confirmation "([^"]*)"$/, { timeout: 90000 }, async function (who, confirmation) {
  await setPasswordOnResetPage(this, who, confirmation || '');
});
