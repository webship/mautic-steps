'use strict';

// What the site sums up: a report's tables (its view, under its graphs) and
// the widgets of the dashboard, which load in their own requests after the
// page.

const { Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./mautic-helpers');

/** The tables of a report's view: the headings of their columns and their rows. */
async function reportTables(page) {
  return page.locator('#app-content table').evaluateAll((tables) => tables.map((t) => ({
    columns: [...t.querySelectorAll('thead th')].map((th) => th.textContent.replace(/\s+/g, ' ').trim()),
    rows: [...t.querySelectorAll('tbody tr')].map((r) => [...r.querySelectorAll('td')].map((td) => td.textContent.replace(/\s+/g, ' ').trim())),
  })).filter((t) => t.columns.length)).catch(() => []);
}

/**
 * Assert that a table of the report on screen lists a text in a column ("Newsletter sign-up" under "Title"), or does
 * not. A report's view shows a table under each of its graphs.
 *
 * Example #1: Then the report should list "Newsletter sign-up" under "Title"
 * Example #2: Then the report should not list "Webship test form" under "Title"
 * Example #3: And the report should list "Newsletter sign-up" under "Title"
 * Example #4: Then the report should list "Spring webinar" under "Title"
 * Example #5: Then the report should list "Product brochure" under "Title"
 */
Then(/^the report should( not)? list "([^"]*)" under "([^"]*)"$/, async function (notCase, text, column) {
  const page = this.page;
  const read = async () => {
    const tables = await reportTables(page);
    const cells = [];
    for (const t of tables) {
      const index = t.columns.findIndex((c) => h.normal(c) === h.normal(column));
      if (index < 0) continue;
      for (const r of t.rows) if (r[index] !== undefined) cells.push(r[index]);
    }
    return { tables, cells };
  };
  await h.eventually(page, read, (r) => r.cells.some((c) => h.mentions(c, text)) === !notCase, (r) => ({
    message: r.tables.some((t) => t.columns.some((c) => h.normal(c) === h.normal(column)))
      ? `The report ${notCase ? 'lists' : 'does not list'} "${text}" under "${column}". Under "${column}" it lists ${h.listed(r.cells)}.`
      : `The report has no column "${column}". Its tables have ${h.listed(r.tables.map((t) => t.columns.join(' | ')))}.`,
    hint: 'Open the report first (the list of reports, then its name); its tables are under its graphs.',
  }), h.budget(this));
});

/** The widgets of the dashboard: their titles and what each shows once loaded. */
async function widgets(page) {
  return page.locator('#app-content .widget').evaluateAll((els) => els.map((w) => ({
    title: ((w.querySelector('h4') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
    text: (w.innerText || '').replace(/\s+/g, ' ').trim(),
    loading: !!w.querySelector('.spinner, .loading, .ri-loader-line') || (w.innerText || '').trim() === ((w.querySelector('h4') || {}).textContent || '').trim(),
  }))).catch(() => []);
}

/**
 * Assert that the dashboard (the page on screen) shows a widget by its title, and, when given, that the widget shows
 * a text once it has loaded.
 *
 * Example #1: Then the dashboard should show the widget "Contacts Created"
 * Example #2: Then the dashboard should show the widget "Recent Activity"
 * Example #3: And the dashboard should show the widget "Upcoming Emails" saying "No emails are scheduled to be sent."
 * Example #4: Then the dashboard should show the widget "Form Submissions"
 * Example #5: Then the dashboard should show the widget "Page Visits"
 */
Then(/^the dashboard should show the widget "([^"]*)"(?: saying "([^"]*)")?$/, async function (title, text) {
  const page = this.page;
  if (!/\/s\/dashboard/.test(page.url())) await h.open(this, '/s/dashboard');
  await h.eventually(page, () => widgets(page), (all) => all.some((w) => h.normal(w.title) === h.normal(title) && (!text || h.mentions(w.text, text))), (all) => {
    const w = all.find((x) => h.normal(x.title) === h.normal(title));
    return {
      message: w ? `The widget "${title}" does not say "${text}". It says "${w.text.slice(0, 200)}".` : `The dashboard shows no widget "${title}". It shows ${h.listed(all.map((x) => x.title))}.`,
      hint: 'The widgets load after the page, each in its own request; the dashboard of each user holds its own widgets.',
    };
  }, h.budget(this) * 2);
});
