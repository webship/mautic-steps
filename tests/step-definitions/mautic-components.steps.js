'use strict';

// Components a visitor gets from the site: the file of an asset (uploaded in
// the administration, downloaded at its public address) and a landing page
// (served at its alias, with the site's tracking script).

const fs = require('fs');
const path = require('path');
const { When, Then } = require('@cucumber/cucumber');
const { friendly, resolveAssetFile } = require('webship-js/tests/step-definitions/webship');
const h = require('./mautic-helpers');

/** A file a step uploads: one of this pack's fixtures, else the project's (tests/assets, or a path from its root). */
function fixture(world, name) {
  const own = path.join(__dirname, '..', 'fixtures', name);
  if (fs.existsSync(own)) return own;
  return resolveAssetFile(world, name);
}

/**
 * Upload a file to the asset being edited, as a person does: the drop zone "Upload a file", the file, then the
 * upload finishing (the zone marks the file done). The title of the asset is the file's name until it is set. The
 * file is one of the pack's fixtures (tests/fixtures/) or the project's (tests/assets/).
 *
 * Example #1: When I upload the file "webship-test-notes.txt" to the asset
 * Example #2: When we upload the file "webship-test-notes.txt" to the asset
 * Example #3: And I upload the file "webship-test-notes.txt" to the asset
 * Example #4: When I upload the file "tests/fixtures/webship-test-notes.txt" to the asset
 * Example #5: When I upload the file "webship-test-picture.png" to the asset
 */
When(/^(?:I|we) upload the file "([^"]*)" to the asset$/, { timeout: 90000 }, async function (name) {
  const page = this.page;
  const file = fixture(this, name);
  const input = page.locator('#app-content input.dz-hidden-input, input.dz-hidden-input').first();
  if (!(await input.count())) throw friendly({ message: `The page has no file drop zone: ${await h.pageSummary(page, this)}.`, hint: 'Open a new asset (the list of assets, "New") with the storage location "Local".' });
  await input.setInputFiles(file);
  const done = await page.waitForFunction(() => {
    const p = document.querySelector('.dz-preview');
    return p && (p.classList.contains('dz-complete') || p.classList.contains('dz-error')) ? (p.classList.contains('dz-error') ? 'error' : 'ok') : '';
  }, null, { timeout: h.budget(this) * 3 }).then((r) => r.jsonValue()).catch(() => '');
  if (done !== 'ok') {
    const error = h.clean(await page.locator('.dz-error-message, .mdropzone-error').first().textContent().catch(() => ''));
    throw friendly({ message: `The file "${name}" was not uploaded${error ? `: "${error}"` : ''}.`, hint: 'The site takes the kinds of file its configuration allows (txt, pdf, png, …), up to its size limit.' });
  }
});

/**
 * Assert that an asset (by its title) downloads at its public address (the link its page shows) with a file name,
 * and, when given, that the file holds a text.
 *
 * Example #1: Then the asset "Product brochure" should download as "product-brochure.txt"
 * Example #2: Then the asset "Webship test notes" should download as "webship-test-notes.txt"
 * Example #3: And the asset "Product brochure" should download as "product-brochure.txt" with "A sample file of the test site"
 * Example #4: Then the asset "Webship test notes" should download as "webship-test-notes.txt" with "Webship test notes"
 * Example #5: Then the asset "Product brochure" should download as "product-brochure.txt" with "Product brochure"
 */
Then(/^the asset "([^"]*)" should download as "([^"]*)"(?: with "([^"]*)")?$/, { timeout: 120000 }, async function (title, fileName, text) {
  const page = this.page;
  await h.openList(this, 'assets', title);
  const link = page.locator('#app-content table tbody tr td a[href*="/s/assets/view/"]:not(.dropdown-menu a)').filter({ hasText: new RegExp(h.escapeRegExp(title), 'i') }).first();
  if (!(await link.count())) throw friendly({ message: `The list of assets has no asset "${title}". It shows ${h.listed(await h.listRows(page))}.`, hint: 'Name the asset by its title.' });
  await h.act(page, () => link.click(), h.budget(this) * 3);
  const href = await page.locator('#app-content a[href*="/asset/"]').first().getAttribute('href').catch(() => null);
  await h.openList(this, 'assets');
  if (!href) throw friendly({ message: `The page of the asset "${title}" shows no public link.`, hint: 'An asset\'s page links to its public address (/asset/…).' });
  const res = await page.request.get(href, { failOnStatusCode: false, timeout: h.budget(this) * 2 });
  const disposition = res.headers()['content-disposition'] || '';
  const name = (disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i) || [])[1] || '';
  if (res.status() !== 200 || h.normal(decodeURIComponent(name)) !== h.normal(fileName)) {
    throw friendly({ message: `The asset "${title}" answered ${res.status()} at ${href}${name ? ` with the file "${decodeURIComponent(name)}"` : ', with no file name'}, not "${fileName}".`, hint: 'A published asset downloads at its public address with the name of the file that was uploaded.' });
  }
  if (text) {
    const body = await res.text().catch(() => '');
    if (!h.mentions(body, text)) throw friendly({ message: `The file of the asset "${title}" does not hold "${text}". It starts "${h.clean(body).slice(0, 160)}".`, hint: 'The text is looked for in the file as it downloads.' });
  }
});

/**
 * Assert that the page on screen (a landing page, a public form) loads the site's tracking script (`/mtc.js`), which
 * counts the visit and recognises the visitor, or does not.
 *
 * Example #1: Then the page should load the tracking script
 * Example #2: Then the page should not load the tracking script
 * Example #3: And the page should load the tracking script
 * Example #4: Then the page should load the tracking script
 * Example #5: But the page should not load the tracking script
 */
Then(/^the page should( not)? load the tracking script$/, async function (notCase) {
  const page = this.page;
  const scripts = await page.evaluate(() => [...document.scripts].map((s) => s.src).filter(Boolean)).catch(() => []);
  const has = scripts.some((s) => /\/mtc\.js(\?|$)/.test(s));
  if (has === !!notCase) throw friendly({ message: `The page ${notCase ? 'loads' : 'does not load'} the tracking script (mtc.js). Its scripts: ${h.listed(scripts)}.`, hint: 'A landing page of the site loads /mtc.js in its head.' });
});
