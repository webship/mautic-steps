<p align="center"><img src="https://raw.githubusercontent.com/webship/mautic-steps/2.0.x/assets/logo.svg" alt="Mautic logo" width="96"></p>

# mautic-steps

[![Test](https://github.com/webship/mautic-steps/actions/workflows/test.yml/badge.svg)](https://github.com/webship/mautic-steps/actions/workflows/test.yml)

Cucumber step definitions for Mautic, the open-source marketing automation platform, with
[webship-js](https://webship.co/docs/webship-js/2.0.x), a BDD browser automation harness built on Playwright and
Cucumber-js.

Every Mautic site has the same administration, whatever it markets: the menus, the lists, the forms of each kind of
record, the contacts and their history, segments, forms and landing pages for visitors, assets, emails, campaigns and
the tasks the site runs on its schedule. `@webship-js/mautic-steps` covers them, on the open-source release:

- **the session**: the login page and its refusal, logging in by a handle of the users registry or taking over an
  account's session from earlier in the run, logging out, who is logged in, the pages a role may not open (the site's "Tsk tsk. Apparently you don't have access to this
  area.", 403), and the password reset through its mail;
- **the administration**: the main menu and its groups, the settings menu, what each offers to a role, the heading of
  a page, the messages the site answers with (recorded as they come: they close themselves after four seconds), its
  confirmations, its dialogs and the search of everything;
- **the lists**: a list opened with its search cleared (the site remembers the last one), searched, counted, sorted
  either way, a row's texts, a row opened, and the actions of its "Options" menu;
- **the forms**: a field set by its label, whatever its kind (a text, the rich text editor, the searchable picker of a
  list, a Yes/No switch, a set of choices), a value added to a field of several (tags), a field's value and its error,
  a tab, Save, Save & Close and Cancel;
- **contacts**: a contact opened by its name or its address, its points, tags, segments, company and details, its
  history, a note added, a tag taken off, an email of one's own sent to it;
- **segments**: a filter added (a field of the contact or of its company, its operator, its value), and the count of
  contacts a segment has once the site's scheduled tasks built it;
- **forms for visitors**: a field and a submit action added in the builder, the public form a visitor fills in, its
  message or its errors, and its results;
- **landing pages and assets**: the tracking script of a page, a file uploaded to an asset, and the file a visitor
  downloads;
- **campaigns**: the builder, a segment as the source, an action after it, and what the site's scheduled tasks do to a
  contact (a tag it gets);
- **reports and the dashboard**: the tables of a report, the widgets of the dashboard;
- **the mail** the site sends, read from the mail catcher: a mail that came, what it says, its link opened;
- **test content**: what a scenario starts from and the removal of what it made ("Webship test …"), done by a managing
  account in a browser of its own.

No step phrase names the platform: a scenario reads `When I add the filter "City" is equal to "Aqaba"` and
`Then the contact "Karim Aziz" should have the tag "webship-test-onboarded" once the scheduled tasks have run`.

CI builds a real site with [DDEV](https://ddev.com) on the runner, from the release package with its own
command-line installer, on two PHP lines, and runs the suite twice on every push and pull request, then the
assertions that must fail; see [The test site](#the-test-site) and
[`.github/workflows/test.yml`](.github/workflows/test.yml).


## From nothing to a green run

What the machine needs: Docker, [DDEV](https://ddev.com), git, Python 3, and Node.js 24 or later with npm. The site is
installed and run in its containers, with the PHP of its web image: no PHP on the machine, no public domain and no
account anywhere.

**1. The site.** The pack's own build script (the one CI runs) makes a DDEV project with a site at the current release
(Mautic 7.2.2), its scheduled tasks running, three accounts and the test content (see [The test site](#the-test-site)).
It takes about five minutes, most of it the download of the release.

```bash
git clone https://github.com/webship/mautic-steps.git
SITE_DIR="$PWD/mautic-site" mautic-steps/.github/scripts/build-ddev-site.sh
```

The site answers at `https://mauticsteps.ddev.site`, its mail catcher at `https://mauticsteps.ddev.site:8026`. The
accounts are `administrator` (the role Administrator), `marketer` (the role Marketer: the marketing tools, not the
users or the settings) and `sales` (the role Sales: the contacts it owns and their notes), each logging in with its
user name and the password `dD.123123ddd`.

In the [Webship Workspace](https://github.com/webship/workspace), its Mautic plugin builds the same site instead, in a
sites folder of the workspace (`dev/` here, the one `--with-needs` adds to a new workspace; `test/`, `sandboxes/` and
`demos/` work the same):

```bash
bash core/scripts/plugins.sh --require mautic --with-needs
bash core/scripts/plugins.sh --activate mautic --with-needs
bash core/scripts/plugins.sh --install mautic
bash dev/cmd-mautic-project.sh mauticsite --install --add-users --sample-content
```

That site answers at `https://mauticsite.ddev.site`. Its accounts are the plugin's: the same three, at `example.com`,
with the workspace's shared password `dD.123123ddd`, and the workspace account as the administrator the installer
makes. Without `--sample-content` the site has none of the test content: the first feature below runs there too, the
features of this repository need the test content.

**2. A test project.**

```bash
mkdir mautic-tests && cd mautic-tests
npm init -y
npm install --save-dev webship-js @webship-js/mautic-steps
npx init-webship-js
```

`npx init-webship-js` writes `cucumber.js`, `playwright.config.ts`, the `tests/` folders with a first feature and the
`npm test` scripts, and installs Chromium. npm usually runs it already when it installs webship-js; a second run
changes nothing. Its first feature opens the site's front page.

**3. `cucumber.js`.** Replace the file with the wiring of the pack: the step files of webship-js and of the pack, the
tags that keep the assertions that must fail out of a normal run, the mail catcher, the account that removes test
content, the browser messages the site is not to blame for, and the accounts (the JSON of [Test users](#test-users)).
The first lines are the starter's own: a feature named on the command line runs alone (step 5).

```javascript
// A feature file or a scenario (file:line) named on the command line runs alone:
// cucumber-js 12 would add it to the paths below, so `paths` is left empty then.
const OPTIONS_WITH_A_VALUE = new Set([
  '-c', '--config', '-f', '--format', '--format-options', '--i18n-keywords',
  '-i', '--import', '-l', '--loader', '--language', '--name', '--order',
  '-p', '--profile', '--parallel', '--plugin', '--plugin-options',
  '-r', '--require', '--require-module', '--retry', '--retry-tag-filter',
  '--shard', '-t', '--tags', '--world-parameters',
]);

function commandLinePaths() {
  if (!/cucumber(-js|\.js)?$/.test(String(process.argv[1] || ''))) return [];
  const args = process.argv.slice(2);
  const paths = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i].startsWith('-')) {
      if (OPTIONS_WITH_A_VALUE.has(args[i])) i += 1;
    } else {
      paths.push(args[i]);
    }
  }
  return paths;
}

const launchUrl = (process.env.LAUNCH_URL || 'https://mauticsteps.ddev.site').replace(/\/+$/, '');

module.exports = {
  default: {
    requireModule: ['tsx/cjs'],
    require: [
      'node_modules/webship-js/tests/step-definitions/**/*.js',
      'node_modules/@webship-js/mautic-steps/tests/step-definitions/**/*.js',
      'tests/step-definitions/**/*.js',
    ],
    paths: commandLinePaths().length ? [] : ['tests/features/**/*.feature'],
    // Work in progress and the assertions that must fail stay out of a normal run.
    tags: 'not @wip and not @must-fail',
    format: ['@cucumber/pretty-formatter', 'json:tests/reports/cucumber_report.json'],
    worldParameters: {
      launchUrl,
      // The mail catcher the site sends its mail to.
      mailUrl: process.env.MAIL_URL || `${launchUrl}:8026`,
      // The account that prepares and removes test content for the Given steps, in a browser of its own.
      manager: 'administrator',
      // Browser messages. Ignored: the avatar of the account logged in comes from an outside avatar service, whose
      // image proxy answers 400 for the default picture of a site it cannot reach ("Failed to load resource: the
      // server responded with a status of 400 ()"): not the site's fault. The scenarios of a refusal the site
      // answers with an error status (403, 404) carry @js-off.
      javascript: { mode: 'warn', levels: ['error'], ignore: '^Failed to load resource: the server responded with a status of 400 \\(\\)$', beforeScenario: false, afterScenario: true },
      minWaitTime: { page: 3000, before_scenario: 0, after_scenario: 0, before_step: 0, after_step: 0 },
      users: {
        administrator: { username: 'administrator', password: 'dD.123123ddd', email: 'administrator@example.com' },
        marketer: { username: 'marketer', password: 'dD.123123ddd', email: 'marketer@example.com' },
        sales: { username: 'sales', password: 'dD.123123ddd', email: 'sales@example.com' },
      },
    },
  },
};
```

On the site from the Webship Workspace (step 1) the accounts are the same; its address goes in `LAUNCH_URL` (step 5),
and the mail catcher follows it.

**4. A first feature**, `tests/features/first-run.feature`:

```gherkin
Feature: First run
  Scenario: The marketer logs in and finds the contacts
    Given I am not logged in
    When I log in as "marketer" with the login form
    Then I should be logged in as "marketer"
    When I go to "Contacts" in the main menu
    Then the page heading should be "Contacts"

  Scenario: The sales account may not open the campaigns
    Given I am a logged in user with the "sales" user
    Then the main menu should not offer "Campaigns"
    And the settings menu should not offer "Users"
```

**5. Run it.** Set `LAUNCH_URL` to the address of the site: `https://mauticsteps.ddev.site` for the build script's
site, `https://mauticsite.ddev.site` for the Workspace's.

```bash
LAUNCH_URL=https://mauticsteps.ddev.site npm test
```

A green first run prints every step, then the summary (the scenarios above and the starter's, passed) and the HTML
report it wrote:

```
3 scenarios (3 passed)
10 steps (10 passed)
```

One feature runs alone when the command line names it (a scenario too, with its line):

```bash
LAUNCH_URL=https://mauticsteps.ddev.site npx cucumber-js tests/features/first-run.feature
```

From there, copy the features of [`tests/features/`](tests/features/), which ship in the package, and the files they
upload (the steps read them from the package's own folder, or the project's `tests/assets/`):

```bash
cp node_modules/@webship-js/mautic-steps/tests/features/*.feature tests/features/
```

They use every step of the pack, run as they are on the site of either way of step 1 (the Workspace's with
`--sample-content`), and take away what they make. Their names say what they hold (`contacts.feature`,
`segments.feature`, `campaigns.feature`, …): none is called like the first feature a test project or the Workspace
starts with (`check-homepage.feature`, `first-run.feature`, `site.feature`), so copying them replaces nothing.

Two of them wait for the site's scheduled tasks (its cron: the segments, then the campaigns), tagged
`@scheduled-tasks`: a new segment fills, a campaign tags a contact. They need the tasks running on the site: the build
script runs them every 15 seconds as a daemon of the DDEV project, and so does the Workspace's builder
(`bash cmd-tools-mautic-cli.sh <site>` says whether they run on their own there, and `--scheduled-tasks --every 15`
runs them beside the suite where they do not). A site
whose cron runs less often needs `SCHEDULED_TASKS_TIMEOUT` (seconds, 180 by default) set higher; a site without any
runs `CUCUMBER_TAGS='not @wip and not @must-fail and not @scheduled-tasks'`.

For your own site, point `launchUrl` at it, `mailUrl` at the mail catcher its mail goes to, `manager` at an account
that may delete what the scenarios make, and `users` at its test accounts (`username` and `password`; `email` for the
mail steps). The steps read what the site draws the same way on every site in English: a site in another language is
read with webship-js's `I should see "…"` where its words differ.

### What the suite tests

The features of this repository run every step of the pack against a real site, on two PHP lines, twice in a row in
CI on every change:

- `tests/features/` (73 scenarios): the login of each account through the form, and of one by its address, a wrong
  password refused, logging out, a visitor sent to the login page;
  the password reset through its mail and its link, two passwords that differ refused, and the same answer and no mail
  for an unknown address; what each role is offered in the main menu and the settings menu and what it may not open
  (a sales account its own contacts only, a marketer no users, roles or settings), an address the site does not have;
  eleven items of the main menu and five of the settings menu; a contact's page (its points, a tag, its company, its
  owner, its address and city), the segments a contact is in, a contact
  made with a tag and removed, an address the quick add refuses, details changed and put back, a note added, a tag
  taken off; the lists searched, counted, sorted both ways, a row's details, the tags and the contacts they count;
  the segments of the build and their counts, a segment's contacts, a new segment of filters built by the scheduled
  tasks, a filter by tag; a visitor who signs up through the public form and becomes a contact with its tag, points
  and history, the public form's refusal of an empty required field, a form made in the builder with a field and a
  submit action, a form refused without its message; a landing page and its tracking script, a new landing page at its
  own address, the asset a visitor downloads, a new asset uploaded and downloaded; an email of one's own to a contact
  that reaches its mailbox, a triggered email made and removed; a campaign that tags the contacts of a segment through
  the scheduled tasks; a point action and a stage made and removed; a report of the forms and their submissions, the
  widgets of the dashboard, the search of everything (and what a sales account finds there);
- `tests/must-fail/` (83 scenarios): an assertion that is not true for each step that can fail, which must fail
  with its message and a hint.

Not tested: languages other than English (the steps read the site's words: "Save & Close", "New", "Options"), themes
of the administration other than the release's, plugins and the marketplace, the drag and drop of the email and page
builders (an email and a page are written in the code mode of their editor), the channels other than email (SMS,
web notifications, social monitoring), the API and webhooks, imports and exports of contacts, the company merge and
the contact merge, the reports' charts and their exports, the theme of a public form, and the refusal of an account
that does not exist at the login form (the suite tries one wrong password a run, on a name of its own: the site locks
a name for 30 minutes after three failed logins).
The settings (Configuration, Users, Roles) are read, never written.

## Requirements

- Node.js 24 or later
- A webship-js 2.0 test project (webship-js 2.0.16 or later)
- A Mautic 7 site in English, its accounts for the suite, its scheduled tasks running for the `@scheduled-tasks`
  scenarios, and a mail catcher for the mail steps

## Install

```bash
npm install --save-dev @webship-js/mautic-steps
```

## The test site

[`.github/scripts/build-ddev-site.sh`](.github/scripts/build-ddev-site.sh) builds the site the suite of this repository
runs against:

- [Mautic](https://www.mautic.org) (GPL-3.0), the open-source release, from its release package
  (`MAUTIC_VERSION`: 7.2.2 by default), checked against the SHA-256 sum its publisher gives for it, installed with its
  own command-line installer (`bin/console mautic:install`) on the project's database;
- a PHP DDEV project (`PHP_VERSION`: 8.3 by default; CI also runs 8.2) served by Apache with the release's own rules,
  MariaDB 10.11 from DDEV, the mail catcher of DDEV for the site's mail (SMTP on `localhost:1025`), Node.js 24 for a
  suite run in the container;
- the site's scheduled tasks (`mautic:segments:update`, `mautic:campaigns:update`, `mautic:campaigns:trigger`) every
  15 seconds, as a daemon of the project (`.ddev/config.mautic.yaml`);
- the settings of a test site, set by [`site/mautic-site.php`](site/mautic-site.php) with the site's own code: its mail
  to the mail catcher, a sender of its own, no statistics sent to an outside service;
- the roles Marketer and Sales, and the accounts of [Test users](#test-users), made through the site's own models;
- the test content: the stages "Lead" and "Customer", the company "Example Trading", five contacts (Lina Haddad, Omar
  Saleh, Maya Nasser, Karim Aziz, Sara Khalil) with their owners, cities, points, tags, stages and company, the
  segments "Newsletter readers" (the tag "newsletter") and "Amman contacts" (the city), the email "Welcome email", the
  landing page "Spring webinar" (`/spring-webinar`), the asset "Product brochure", and the form "Newsletter sign-up"
  (an email, required, and a first name; a visitor who signs up gets the tag "newsletter" and ten points).

Run again with `ACCOUNTS_ONLY=1` and the same `SITE_DIR`, the build script puts the accounts back as they were made; with
`TIDY_ONLY=1` it removes what a run that was stopped half way left (the test content a scenario makes is named
"Webship test …", its tags and addresses "webship-test-…") and the site's record of failed logins.

## How the steps find things and wait

- **By what a person reads.** A part of the site by its item in the menu, a record by its name in its list, a field by
  its label (letter case and the required mark aside), an action of a row by its name in the row's "Options", a dialog
  by its title, a contact by its name or its address, an account by a handle of the users registry. What the site
  draws the same way everywhere is the fallback: its lists (`#app-content table`), its forms' toolbars (`.btn-save`,
  `.btn-apply`, `.btn-cancel`), its pickers (the `_chosen` container of a list), its switches
  (`label[role="switch"][aria-checked]`), its messages (`#flashes`).
- **The site's own signals, no fixed sleeps.** The administration loads its parts by Ajax: while a request runs the
  site shows its loading bar (`.loading-bar.active`) and jQuery counts it (`mQuery.active`); a step waits for both to
  fall back, and for a dialog to load its form. A public form posts to a frame and writes its message or its errors
  in the form: the step waits for those.
- **Messages are recorded as they come.** The site closes a message ("… has been created!") after four seconds: a
  script the pack adds to every page records each one, so `the site should say "…"` reads it even when it is gone.
- **The remembered search.** The site keeps the last search of a list for the session: `I open the list of …` opens
  it cleared. A search with a colon is a command of the site's search ("segment:alias"): the steps search such a name
  as a phrase, in quotes.
- **The scheduled tasks.** A segment of filters, a campaign's action, run in the site's cron: a step that reads what
  they do opens the page again every five seconds until it is there (`SCHEDULED_TASKS_TIMEOUT`, 180 seconds).
- **Who is logged in** is what the account page of the browser's session says.
- **The lock after failed logins.** The site refuses every login of a name, as it is typed (letter case aside), for 30
  minutes after three failed ones from one address, and a login that works does not set the count back. So the
  suite's one wrong password is tried with the account's address (`marketer@example.com`), a name no other scenario
  logs in with: a fourth run within half an hour finds that name locked, and every other login goes on. A login
  refused that way says so, with a hint; `TIDY_ONLY=1` of the build script clears the site's record of login attempts
  (`bin/console cache:pool:clear cache.rate_limiter`).
- **The mail** is read from the mail catcher's API (`mailUrl`, a Mailpit): only the mail that came since the scenario
  began.
- **Test content comes and goes.** A scenario names what it makes "Webship test …", starts from a site without it
  (`Given there is no segment "…"`, `Given the contact "…" has no note "…"`) and takes it away. Those Given steps work
  as the managing account (`manager`) in a browser of its own: the scenario's page and its session stay as they are.
- **A cut connection is opened again.** A shared machine's network changes when a container starts (DDEV's router
  starts again for another project): a page that was cut is opened again for up to 30 seconds, a login sent again.
- **Failures say what was found.** `The list does not show "Nobody Here". It shows "Lina Haddad …", "Omar Saleh …"`,
  `The options of "Lina Haddad" have no "Archive". They offer "Edit", "Details", "Send email", "Delete".`, with a hint on
  where to look.

## Accounts

The suite never creates or deletes an account. Accounts are configuration: list the ones the site has in
`worldParameters.users`, by a handle the scenarios use, each with its `username` and `password`, and its `email` for
the mail steps. An account that logged in once keeps its session for the rest of the run (`reuseSessions: false`
turns it off); a logout ends it.

## Test users

The accounts this repository's suite logs in as, exactly as `cucumber.js` lists them in `worldParameters.users` (the
default values; the `<HANDLE>_PASSWORD` variables replace them). The build script makes them; the Workspace's Mautic
plugin makes the same three.

```json
{
  "administrator": { "username": "administrator", "password": "dD.123123ddd", "email": "administrator@example.com" },
  "marketer": { "username": "marketer", "password": "dD.123123ddd", "email": "marketer@example.com" },
  "sales": { "username": "sales", "password": "dD.123123ddd", "email": "sales@example.com" }
}
```

`administrator` has the role Administrator: every part of the site, its users and its settings. `marketer` has the
role Marketer: contacts, companies, segments, components, channels, campaigns, points, stages, reports and tags; not
the users, the roles or the settings. `sales` has the role Sales: the contacts it owns (Lina Haddad and Karim Aziz) and
their notes, nothing else. They are accounts of a throwaway test site, with a placeholder password, not accounts of
any real one.

## Steps

### `mautic-session.steps.js` (13)

- `Given I am a logged in user with the "marketer" user`
- `When I log in as "marketer" with the login form`
- `When I log in with the username "nobody" and the password "Wrong-password-1"`
- `Then the login should be refused with "Invalid login. Please verify credentials."`
- `Given I am not logged in`
- `When I log out`
- `Then I should be logged in as "marketer"`
- `Then I should not be logged in`
- `Then I should be on the login page`
- `Then I should not be allowed to open "/s/campaigns"`
- `When I ask for a password reset link for "sales"`
- `When I set the password of "sales" on the reset page`
- `When I set the password of "sales" on the reset page with the confirmation "Something-else-1"`

### `mautic-administration.steps.js` (13)

- `When I go to "Contacts" in the main menu`
- `Then the main menu should offer "Campaigns"`
- `When I go to "Users" in the settings menu`
- `Then the settings menu should offer "Users"`
- `Then the page heading should be "Contacts"`
- `Then the site should say "has been created!"`
- `Then the site should ask "Delete this contact?"`
- `When I answer the confirmation with "Delete"`
- `Then the dialog "Quick Add" should be open`
- `Then no dialog should be open`
- `When I press "Save" in the dialog`
- `When I search everything for "Haddad"`
- `Then the search results should list "Haddad, Lina"`

### `mautic-lists.steps.js` (9)

- `When I open the list of contacts`
- `When I search the list for "Haddad"`
- `Then the list should show "Lina Haddad"`
- `Then the list should have 2 items`
- `Then the row of "marketer" should show "Marketer"`
- `When I open "Lina Haddad" from the list`
- `When I choose "Delete" in the options of "Webship test contact"`
- `When I sort the list by "Points" in descending order`
- `Then the list should start with "Omar Saleh", "Lina Haddad"`

### `mautic-fields.steps.js` (9)

- `When I set "First Name" to "Webship test"`
- `When I set the following fields:`
- `When I add "webship-test-tag" to "Tags"`
- `Then "First Name" should be set to "Webship test"`
- `Then the field "Email" should show the error "is invalid."`
- `When I open the "Filters" tab`
- `When I save the form`
- `When I save and close the form`
- `When I cancel the form`

### `mautic-contacts.steps.js` (12)

- `When I open the contact "Lina Haddad"`
- `Then the contact "Lina Haddad" should have 25 points`
- `Then the contact "Lina Haddad" should have the tag "newsletter"`
- `Then the contact "Lina Haddad" should be in the segment "Newsletter readers"`
- `Then the contact "Lina Haddad" should be at the company "Example Trading"`
- `Then the "Contact owner" of the contact "Lina Haddad" should be "Sales Test"`
- `Then the history of the contact "Lina Haddad" should show "Contact created"`
- `When I add the note "Webship test: called about the webinar" to the contact "Lina Haddad"`
- `Then the notes of the contact "Lina Haddad" should list "Webship test: called about the webinar"`
- `When I remove the tag "webship-test-tag" from the contact "Lina Haddad"`
- `When I send the contact "Lina Haddad" an email with the subject "Webship test: our webinar" saying "Thank you for joining."`
- `Then the contact "Lina Haddad" should have the tag "webship-test-onboarded" once the scheduled tasks have run`

### `mautic-segments.steps.js` (2)

- `When I add the filter "City" is equal to "Amman"`
- `Then the segment "Newsletter readers" should have 2 contacts`

### `mautic-forms.steps.js` (8)

- `When I add a "Text: Short answer" field to the form with:`
- `When I add the submit action "Adjust contact's points" to the form with:`
- `Then the form should hold the field "First name"`
- `When I open the public form "Newsletter sign-up"`
- `When I send the public form`
- `Then the public form should say "Thank you for signing up."`
- `Then the public form field "Email" should show the error "This is required."`
- `Then the results of the form "Newsletter sign-up" should list "webship-test-signup@example.com"`

### `mautic-components.steps.js` (3)

- `When I upload the file "webship-test-notes.txt" to the asset`
- `Then the asset "Product brochure" should download as "product-brochure.txt"`
- `Then the page should load the tracking script`

### `mautic-campaigns.steps.js` (5)

- `When I open the campaign builder`
- `When I add the segment "Newsletter readers" as the source of the campaign`
- `When I add the action "Modify contact's tags" to the campaign with:`
- `When I close the campaign builder`
- `Then the campaign builder should show "Newsletter readers"`

### `mautic-reports.steps.js` (2)

- `Then the report should list "Newsletter sign-up" under "Title"`
- `Then the dashboard should show the widget "Contacts Created"`

### `mautic-mail.steps.js` (4)

- `Then an email with the subject "password reset" should be sent to "sales"`
- `Then no email should be sent to "nobody@example.com"`
- `Then the email with the subject "password reset" to "sales" should contain "You requested a password reset"`
- `When I open the link of the email with the subject "password reset" to "sales"`

### `mautic-content.steps.js` (4)

- `Given there is no contact "Webship test contact"`
- `Given the contact "Lina Haddad" has no note "Webship test"`
- `Given the contact "Lina Haddad" has no tag "webship-test-tag"`
- `Then there should be a segment "Newsletter readers"`

Text, links, buttons, fields and status codes are webship-js's own steps (`I should see "…"`, `I click "…"`,
`I fill in "…" with "…"`, `I go to "…"`, `the response status code should be 404`); this pack adds what the site
decides. Some steps take more than their first example shows: `the main menu should not offer "…"`,
`the list should not show "…"`, `I sort the list by "…" in ascending order`, `the contact "…" should not be in the
segment "…"`, `I add the filter "…" from "Primary company" is equal to "…"`, `the form should hold the action "…"`,
`the asset "…" should download as "…" with "…"`, `the dashboard should show the widget "…" saying "…"`,
`I open the "…" link of the email with the subject "…" to "…"`, `I should be on the login page saying "…"`; the JSDoc
of each step lists five.

## Phrases shared with other packs

The session phrases are the ones every platform pack has, so a feature reads the same on every system (one
`cucumber.js` profile per system; the platform packs are not meant to be loaded together). The phrases of the lists
and the forms of an administration are those of the other packs of an administration (Django, Filament, Payload,
Strapi), so a scenario of a list reads the same on each. Loaded beside each of the 41 other packs, these phrases of
this pack also match one of theirs:

| Phrase of this pack | Also in |
| --- | --- |
| `I am a logged in user with the "…" user` | aspnet-core, codeigniter, discourse, django, django-cms, drupal-core, joomla, keycloak, laravel, mediawiki, moodle, nextcloud, nextjs, odoo, payload, phpbb, spring-boot, strapi, symfony, typo3, wagtail, wordpress |
| `I log out` | aspnet-core, codeigniter, discourse, django, django-cms, drupal-core, keycloak, laravel, mediawiki, moodle, nextcloud, nextjs, odoo, payload, phpbb, spring-boot, strapi, symfony, typo3, wagtail, wordpress |
| `I should not be logged in` | aspnet-core, codeigniter, discourse, django, django-cms, drupal-core, keycloak, laravel, mediawiki, moodle, nextcloud, nextjs, odoo, payload, phpbb, spring-boot, strapi, symfony, typo3, wagtail, wordpress |
| `I should be logged in as "…"` | aspnet-core, backdrop-cms, codeigniter, discourse, django, keycloak, laravel, mediawiki, moodle, nextcloud, nextjs, odoo, payload, phpbb, spring-boot, strapi, symfony, typo3, wagtail |
| `I am not logged in` | aspnet-core, discourse, django, django-cms, drupal-core, joomla, keycloak, nextcloud, odoo, payload, phpbb, spring-boot, strapi, typo3, wagtail, wordpress |
| `I log in as "…" with the login form` | aspnet-core, codeigniter, discourse, django, keycloak, laravel, mediawiki, moodle, nextcloud, nextjs, payload, phpbb, spring-boot, strapi, symfony, wagtail |
| `the login should be refused with "…"` | aspnet-core, discourse, django, keycloak, mediawiki, nextcloud, payload, phpbb, spring-boot, strapi, wagtail |
| `I should not be allowed to open "…"` | aspnet-core, bbpress, discourse, django, django-cms, payload, phpbb, spring-boot, strapi, wagtail |
| `I log in with the username "…" and the password "…"` | aspnet-core, discourse, keycloak, moodle, nextcloud, phpbb, spring-boot, symfony, wagtail |
| `no email should be sent to "…"` | aspnet-core, codeigniter, keycloak, laravel, nextcloud, phpbb, symfony, wagtail, woocommerce |
| `I should be on the login page` | aspnet-core, discourse, keycloak, nextcloud, phpbb, spring-boot, wagtail, wordpress |
| `an email with the subject "…" should be sent to "…"` | aspnet-core, codeigniter, keycloak, laravel, phpbb, symfony, wagtail, woocommerce |
| `the email with the subject "…" to "…" should contain "…"` | aspnet-core, codeigniter, keycloak, laravel, phpbb, symfony, wagtail, woocommerce |
| `I ask for a password reset link for "…"` | aspnet-core, keycloak, laravel, nextcloud, phpbb, wagtail |
| `"…" should be set to "…"` | django, filament, payload, strapi, wagtail |
| `I open "…" from the list` | discourse, django, filament, payload, strapi |
| `I open the "…" tab` | filament, joomla, keycloak, odoo, payload |
| `I search the list for "…"` | django, filament, joomla, payload, strapi |
| `I set "…" to "…"` | django, filament, payload, strapi, wagtail |
| `I sort the list by "…" in descending order` | django, filament, payload, prestashop, strapi |
| `I save the form` | django, filament, magento, odoo |
| `the list should show "…"` | django, filament, payload, strapi |
| `I open the link of the email with the subject "…" to "…"` | phpbb, wagtail |
| `I press "…" in the dialog` | backdrop-cms, typo3 |
| `I set the password of "…" on the reset page` | phpbb, wagtail |
| `the page heading should be "…"` | backdrop-cms, filament |
| `the search results should list "…"` | backdrop-cms, wagtail |
| `I set the following fields:` | odoo |
| `I sort the list by "…"` | ghost |
| `the field "…" should show the error "…"` | nextjs |
| `the list should have 2 items` | ghost |
| `the main menu should offer "…"` | wagtail |

None matches a webship-js step, and none matches a phrase of the component pack (Bootstrap), of the Diffy pack or of
the Shopify pack, which can be loaded beside this one.

## Testing this package

```bash
npm ci
npm run test:examples    # every step's JSDoc examples match it and nothing else; every feature step resolves
npm run test:paths       # a feature named on the command line runs alone
npx cucumber-js --dry-run
SITE_DIR="$PWD/../mautic-site" .github/scripts/build-ddev-site.sh
npx cucumber-js          # the whole suite
npm run test:must-fail   # the assertions that must fail, each with its message and a hint
PHP_VERSION=8.2 SITE_DIR="$PWD/../mautic-site" .github/scripts/build-ddev-site.sh
npx cucumber-js
```

## How the steps were written

Every step was written from a round of manual testing of the real local site in the browser first: each screen it
touches was opened as the account the step works as, its lists, labels and messages noted, and the signal it gives
while it works found (the loading bar and jQuery's count of requests, the loading bar of a dialog, the confirmation
over the darkened page, the row of an upload). The failures of the first runs went back to the browser before the
step changed: a message gone four seconds after it came, a list that kept the search of the run before, a search with
a colon that the site read as one of its commands, a tag that came back because taking it off asks first, a segment's
Cancel that lands on the segment's page and not on the list, the subject of an email copied into its empty name while
the name was being typed, a contact's "Details" link hidden in the row's options, a campaign builder that opens its
list of sources by itself, and an account locked out for half an hour by the failed logins of earlier runs, which a
login that works does not lift.

## License

MIT, see [LICENSE](LICENSE).

## Logo

The logo in this README is the Mautic logo from Simple Icons 16.37.0 (CC0-1.0), filled with the colour the set lists
for the brand. The Mautic name and logo are trademarks of their owner; this pack is not affiliated with or endorsed by
them.
