'use strict';

// Segments: the filters of a segment, the count of its contacts in the list of
// segments, and the contacts its page lists. A segment of filters is built by
// the site's scheduled tasks (its cron): until they run, the list says
// "Building". A step that waits for a count opens the list again every five
// seconds until the count is there.

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./mautic-helpers');

/**
 * Add a filter to the segment on screen, as a person does: the "Filters" tab, the field chosen in the list of
 * filters (from the "Contact" fields, or from the group named after "from": "Primary company", "Contact Behavior and
 * Actions"), then its operator and its value. A value of a list (a tag, a country) is chosen in its picker.
 *
 * Example #1: When I add the filter "City" is equal to "Amman"
 * Example #2: When we add the filter "Tags" includes any of "newsletter"
 * Example #3: And I add the filter "Last Name" contains "Haddad"
 * Example #4: When I add the filter "City" from "Primary company" is equal to "Amman"
 * Example #5: When I add the filter "Email" ends with "@example.com"
 */
When(/^(?:I|we) add the filter "([^"]*)"(?: from "([^"]*)")? (.+?) "([^"]*)"$/, { timeout: 90000 }, async function (fieldName, group, operator, value) {
  const page = this.page;
  await h.openTab(this, 'Filters');
  const before = await page.locator('#app-content .segment-filter[id^="leadlist_filters_"]').count();
  const select = page.locator('#available_segment_filters');
  const option = await select.evaluate((s, { name, grp }) => {
    const norm = (t) => String(t || '').replace(/\s+/g, ' ').trim().toLowerCase();
    for (const g of s.querySelectorAll('optgroup')) {
      if (grp ? norm(g.label) !== norm(grp) : norm(g.label) !== 'contact') continue;
      for (const o of g.querySelectorAll('option')) if (norm(o.textContent) === norm(name)) return { value: o.value, text: o.textContent.trim(), group: g.label };
    }
    return null;
  }, { name: fieldName, grp: group || '' });
  if (!option) {
    const offered = await select.evaluate((s, grp) => [...s.querySelectorAll('optgroup')].filter((g) => !grp || g.label.toLowerCase() === grp.toLowerCase()).map((g) => [...g.querySelectorAll('option')].map((o) => o.textContent.trim())).flat().slice(0, 60), group || 'Contact');
    throw friendly({ message: `The filters of "${group || 'Contact'}" have no "${fieldName}". They offer ${h.listed(offered)}.`, hint: 'Name a field of the filter list as it is written; a field of another group needs its group: from "Primary company".' });
  }
  // The picker of the filters: open it, search the field, choose it in its group.
  const container = page.locator('#available_segment_filters_chosen');
  await container.click();
  await container.locator('input').first().pressSequentially(fieldName, { delay: 15 });
  const groups = container.locator('.chosen-results li');
  const index = await groups.evaluateAll((els, { name, grp }) => {
    let current = '';
    for (let i = 0; i < els.length; i += 1) {
      const t = els[i].textContent.replace(/\s+/g, ' ').trim();
      if (els[i].classList.contains('group-result')) current = t;
      else if (els[i].classList.contains('active-result') && t.toLowerCase() === name.toLowerCase() && current.toLowerCase() === grp.toLowerCase()) return i;
    }
    return -1;
  }, { name: fieldName, grp: option.group });
  if (index < 0) throw friendly({ message: `The filter "${fieldName}" of "${option.group}" did not show in the picker.`, hint: 'The picker searches the fields as one types.' });
  await groups.nth(index).click();
  const row = page.locator('#app-content .segment-filter[id^="leadlist_filters_"]').nth(before);
  await row.waitFor({ state: 'visible', timeout: h.budget(this) });
  await h.settle(page);
  // The operator: a plain list of the row.
  const operators = row.locator('select[id$="_operator"]');
  const offered = await operators.evaluate((s) => [...s.options].map((o) => o.textContent.trim()));
  const op = offered.find((o) => h.normal(o) === h.normal(operator));
  if (!op) throw friendly({ message: `The filter "${fieldName}" has no operator "${operator}". It offers ${h.listed(offered)}.`, hint: 'Write the operator as the list of the filter writes it ("is equal to", "contains", "includes any of").' });
  await operators.selectOption({ label: op });
  await h.settle(page);
  // The value: a text field, or a list (a picker).
  const props = row.locator('[id$="_properties"]');
  const list = props.locator('select').first();
  if (await list.count()) {
    const id = await list.getAttribute('id');
    const f = { kind: (await list.evaluate((s) => s.multiple)) ? 'chosen-multi' : 'chosen', label: fieldName, locator: list };
    if (await page.locator(`#${id}_chosen`).count()) {
      await h.chooseOption(this, f, value);
    } else {
      const options = await list.evaluate((s) => [...s.options].map((o) => o.textContent.trim()));
      const pick = options.find((o) => h.normal(o) === h.normal(value));
      if (!pick) throw friendly({ message: `The filter "${fieldName}" has no value "${value}". It offers ${h.listed(options)}.`, hint: 'Name a value of the list as it is written.' });
      await list.selectOption({ label: pick });
    }
  } else {
    const input = props.locator('input:not([type="hidden"])').first();
    if (!(await input.count())) throw friendly({ message: `The filter "${fieldName}" takes no value with "${operator}".`, hint: 'Some operators ("is empty") take none: leave the value out of such a filter.' });
    await input.fill(value);
  }
});

/**
 * Assert the count of contacts a segment has, as the list of segments shows it ("View 2 Contacts"). A segment of
 * filters is built by the site's scheduled tasks: the step opens the list again every five seconds until the count
 * is there (180 seconds at most, SCHEDULED_TASKS_TIMEOUT), and fails with what it shows ("Building").
 *
 * Example #1: Then the segment "Newsletter readers" should have 2 contacts
 * Example #2: Then the segment "Webship test segment" should have 1 contact
 * Example #3: And the segment "Amman contacts" should have 2 contacts
 * Example #4: Then the segment "Webship test segment" should have 0 contacts
 * Example #5: Then the segment "Newsletter readers" should have 3 contacts
 */
Then(/^the segment "([^"]*)" should have (\d+) contacts?$/, { timeout: 300000 }, async function (name, count) {
  const page = this.page;
  const read = async () => {
    await h.openList(this, 'segments', name);
    return page.evaluate((wanted) => {
      for (const row of document.querySelectorAll('#leadListTable tbody tr')) {
        const link = row.querySelector('td a[href*="/s/segments/view/"]');
        if (!link || !link.textContent.replace(/\s+/g, ' ').trim().toLowerCase().startsWith(wanted.toLowerCase())) continue;
        const cell = row.querySelector('.col-count');
        return cell ? cell.textContent.replace(/\s+/g, ' ').trim() : '';
      }
      return null;
    }, name);
  };
  const deadline = Date.now() + h.scheduledBudget();
  let shown;
  for (;;) {
    shown = await read();
    if (shown === null) throw friendly({ message: `The list of segments has no segment "${name}". It shows ${h.listed(await h.listRows(page))}.`, hint: 'Name the segment as the list writes it, before its alias in brackets.' });
    const m = shown.match(/(\d+)/);
    const n = m ? Number(m[1]) : (/^No\b/i.test(shown) ? 0 : null);
    if (n === Number(count)) break;
    if (Date.now() > deadline) {
      throw friendly({
        message: `The segment "${name}" shows "${shown}", not ${count} contact(s), after ${Math.round(h.scheduledBudget() / 1000)} seconds.`,
        hint: /Building/i.test(shown) ? 'The site\'s scheduled tasks (its cron) build a segment of filters; check that they run on the site.' : 'The count is the "# contacts" column of the list of segments.',
      });
    }
    await page.waitForTimeout(5000);
  }
  await h.openList(this, 'segments');
});
