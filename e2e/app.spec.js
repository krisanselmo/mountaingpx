/*
 * End-to-end flow: open a GPX, generate waypoints (Overpass mocked),
 * check the UI and export the enriched GPX.
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_GPX = path.join(here, 'fixtures', 'track.gpx');

// Two POIs sitting a few meters east of the fixture track (which runs
// straight north along lon 6.870): a named peak and an unnamed water point.
const OVERPASS_RESPONSE = {
  version: 0.6,
  elements: [
    {
      type: 'node', id: 101, lat: 45.904, lon: 6.8702,
      tags: { natural: 'peak', name: 'Pic du Test', ele: '2500' },
    },
    {
      type: 'node', id: 102, lat: 45.906, lon: 6.8701,
      tags: { amenity: 'drinking_water' },
    },
  ],
};

test.beforeEach(async ({ page }) => {
  // Hermetic run: Overpass is mocked, every other external request
  // (map tiles…) is dropped.
  await page.route(/^https?:\/\/(?!localhost)/, (route) => {
    if (route.request().url().includes('/api/interpreter')) {
      return route.fulfill({ json: OVERPASS_RESPONSE });
    }
    return route.abort();
  });
  await page.goto('/');
});

async function loadTrack(page) {
  await page.setInputFiles('#file-input', FIXTURE_GPX);
  await expect(page.locator('#stat-dist')).toHaveText('1.0 km');
}

test('load a GPX, generate waypoints, export the enriched GPX', async ({ page }) => {
  await loadTrack(page);
  await expect(page.locator('#stat-dplus')).toHaveText('+180 m');
  await expect(page.locator('#btn-download')).toBeDisabled();

  // The profile viewBox must match the on-screen width: the wrap starts
  // hidden (.empty) and a profile drawn while hidden would fall back to a
  // 600-unit width, then be stretched by preserveAspectRatio="none".
  const profile = page.locator('#profile');
  const viewBoxWidth = parseFloat((await profile.getAttribute('viewBox')).split(' ')[2]);
  const realWidth = (await profile.boundingBox()).width;
  expect(Math.abs(viewBoxWidth - realWidth)).toBeLessThan(2);

  await page.click('#btn-generate');

  // Both fixture POIs snap onto the track.
  await expect(page.locator('#stat-wpt')).toHaveText('2');
  await expect(page.locator('#btn-download')).toBeEnabled();
  await expect(page.locator('#btn-download-tcx')).toBeEnabled();

  // The roadbook lists the named peak between the start and end rows.
  await page.click('#btn-roadbook');
  await expect(page.locator('#roadbook-body .rb-row')).toHaveCount(4);
  await expect(page.locator('#roadbook-body')).toContainText('Pic du Test');

  // The waypoints show up as dots on the elevation profile.
  await expect(page.locator('#profile-wpts circle')).toHaveCount(2);

  // Export and inspect the downloaded GPX.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#btn-download'),
  ]);
  const xml = fs.readFileSync(await download.path(), 'utf8');

  // The snapped waypoints are exported with the Garmin course-point types.
  expect(xml).toContain('<name>Pic du Test</name>');
  expect(xml).toContain('<type>summit</type>');
  expect(xml).toContain('<type>water</type>');
  expect((xml.match(/<wpt /g) || []).length).toBe(2);

  // The source timestamps survive the export, stay monotonic, and cover
  // every track point (10 original + the inserted projections).
  const times = [...xml.matchAll(/<time>([^<]+)<\/time>/g)].map((m) => Date.parse(m[1]));
  const trkpts = (xml.match(/<trkpt /g) || []).length;
  expect(trkpts).toBeGreaterThanOrEqual(10);
  expect(times.length).toBe(trkpts);
  expect(times[0]).toBe(Date.parse('2024-06-01T08:00:00Z'));
  expect(times[times.length - 1]).toBe(Date.parse('2024-06-01T08:09:00Z'));
  for (let i = 1; i < times.length; i++) {
    expect(times[i]).toBeGreaterThanOrEqual(times[i - 1]);
  }
});

test('an invalid custom Overpass query is refused with a targeted error', async ({ page }) => {
  await loadTrack(page);

  let overpassCalls = 0;
  page.on('request', (r) => {
    if (r.url().includes('/api/interpreter')) overpassCalls++;
  });

  // The custom query field lives in the collapsed "Advanced" section.
  await page.click('details.advanced > summary');
  await page.fill('#overpass-custom', 'node[amenity]; out body;');
  await page.click('#btn-generate');

  await expect(page.locator('#toast')).toContainText('Invalid custom Overpass query');
  expect(overpassCalls).toBe(0);
  await expect(page.locator('#stat-wpt')).toHaveText('0');
});

test('the share modal copies the encoded link', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await loadTrack(page);

  await page.click('#btn-share');
  await expect(page.locator('#share-modal')).toBeVisible();
  await expect(page.locator('#share-choice')).toBeVisible();

  // Link mode: closes the modal, fills the hash and the clipboard.
  await page.click('#share-link');
  await expect(page.locator('#share-modal')).toBeHidden();
  await expect(page.locator('#toast')).toContainText('copied');
  expect(page.url()).toContain('track=');
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain('#');
  expect(copied).toContain('track=');
});

test('the file option shares the full GPX through the Web Share API', async ({ page }) => {
  // Desktop Chromium has no Web Share: stub it before the app boots. The
  // option is hidden without the stub (covered by the modal test's layout).
  await page.addInitScript(() => {
    window.__shared = null;
    navigator.canShare = (d) => !!(d && d.files && d.files.length);
    navigator.share = async (d) => {
      const f = d.files[0];
      window.__shared = { name: f.name, type: f.type, size: f.size, title: d.title };
    };
  });
  await page.reload();
  await loadTrack(page);

  await page.click('#btn-share');
  await expect(page.locator('#share-file')).toBeVisible();
  await page.click('#share-file');
  await expect(page.locator('#share-modal')).toBeHidden();

  const shared = await page.evaluate(() => window.__shared);
  expect(shared.name).toMatch(/\.gpx$/);
  expect(shared.type).toBe('application/gpx+xml');
  expect(shared.size).toBeGreaterThan(500); // the whole track, not a stub
});

test('the about section links to the GitHub repository', async ({ page }) => {
  // On the dev server the link is derived from the canonical URL injected
  // at build time (package.json homepage).
  await page.click('details.about > summary');
  const link = page.locator('#github-link');
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute(
    'href',
    'https://github.com/krisanselmo/mountaingpx'
  );
});

// ---- Loading a track from a URL (#gpx=) ---------------------------------
// The fixture is served through an intercepted route: no real host, and the
// CORS headers (or their absence) are ours to choose.
const FIXTURE_BODY = fs.readFileSync(FIXTURE_GPX);
// Deliberately extensionless, like a real export endpoint: the format can
// only be detected from the bytes.
const GPX_URL = 'https://tracks.example.org/routes/42/export';

/**
 * Serve `url` to the page. Registered inside the test, so it wins over the
 * catch-all installed by beforeEach.
 *
 * `blocked: true` stands for a host that does not allow cross-origin reads:
 * fulfilled routes bypass the browser's CORS checks, so the refusal is
 * simulated by failing the request — which is exactly what the page sees of
 * a CORS block (a rejected fetch, no status, no reason).
 */
function serveTrackUrl(page, url, opts = {}) {
  const { status = 200, body = FIXTURE_BODY, blocked = false,
    contentType = 'application/octet-stream' } = opts;
  return page.route(url, (route) => (blocked
    ? route.abort('failed')
    : route.fulfill({
      status,
      contentType,
      headers: { 'access-control-allow-origin': '*' },
      body,
    })));
}

/** Boot the app on `hash`: goto() alone would only move the fragment. */
async function openWithHash(page, hash) {
  await page.goto('/' + hash);
  await page.reload();
}

const gpxHash = (url) => '#gpx=' + encodeURIComponent(url);

test('#gpx= loads the track, its format detected from the content', async ({ page }) => {
  await serveTrackUrl(page, GPX_URL);
  await openWithHash(page, gpxHash(GPX_URL));

  await expect(page.locator('#toast')).toContainText('Track loaded');
  await expect(page.locator('#stat-dist')).toHaveText('1.0 km');
  await expect(page.locator('#stat-dplus')).toHaveText('+180 m');
  await expect(page.locator('#track-name')).toHaveText('Trace E2E');
  // The URL is the app's track reference now: it stays in the hash.
  await expect.poll(() => page.url()).toContain('gpx=');
});

test('#gpx= on a host without CORS says so, and that it is not a 404', async ({ page }) => {
  await serveTrackUrl(page, GPX_URL, { blocked: true });
  await openWithHash(page, gpxHash(GPX_URL));

  const toast = page.locator('#toast');
  await expect(toast).toContainText('CORS');
  await expect(toast).toContainText('404'); // explicitly ruled out
  await expect(page.locator('#stat-dist')).toHaveText('—');
});

test('#gpx= on a broken link reports the HTTP status', async ({ page }) => {
  await serveTrackUrl(page, GPX_URL, { status: 404, body: 'Not Found' });
  await openWithHash(page, gpxHash(GPX_URL));

  await expect(page.locator('#toast')).toContainText('HTTP 404');
  await expect(page.locator('#toast')).not.toContainText('CORS');
});

test('#gpx= pointing at a web page is refused as an unknown format', async ({ page }) => {
  await serveTrackUrl(page, GPX_URL, {
    contentType: 'text/html',
    body: '<!doctype html><html><body><h1>Route 42</h1></body></html>',
  });
  await openWithHash(page, gpxHash(GPX_URL));

  await expect(page.locator('#toast')).toContainText('not a recognizable track');
  await expect(page.locator('#stat-dist')).toHaveText('—');
});

test('#gpx= refuses anything but an https URL', async ({ page }) => {
  await openWithHash(page, gpxHash('http://tracks.example.org/routes/42.gpx'));
  await expect(page.locator('#toast')).toContainText('https://');
});

test('a hash carrying both track= and gpx= keeps the inline track', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  // Get a real share code from the app itself.
  await loadTrack(page);
  await page.click('#btn-share');
  await page.click('#share-link');
  await expect(page.locator('#toast')).toContainText('copied');
  const code = /track=([A-Za-z0-9_-]+)/.exec(page.url())[1];

  let downloads = 0;
  page.on('request', (r) => {
    if (r.url().startsWith(GPX_URL)) downloads++;
  });
  await serveTrackUrl(page, GPX_URL); // served, but nothing must ask for it
  await openWithHash(page, `#track=${code}&gpx=${encodeURIComponent(GPX_URL)}`);

  await expect(page.locator('#stat-dist')).toHaveText('1.0 km');
  await expect.poll(() => page.url()).toContain('track=');
  expect(page.url()).not.toContain('gpx=');
  expect(downloads).toBe(0);
});

test('the #gpx= parameter survives a map move', async ({ page }) => {
  await serveTrackUrl(page, GPX_URL);
  await openWithHash(page, gpxHash(GPX_URL));
  await expect(page.locator('#stat-dist')).toHaveText('1.0 km');
  await expect.poll(() => page.url()).toMatch(/#map=[^&]+&gpx=https/);
  const before = page.url();

  // Drag the map away from the track (which runs down the middle).
  const box = await page.locator('#map').boundingBox();
  const x = box.x + box.width * 0.8;
  const y = box.y + box.height * 0.75;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 140, y - 70, { steps: 10 });
  await page.mouse.up();

  // Rewritten view, same track reference — a pan must not drop it.
  await expect.poll(() => page.url()).not.toBe(before);
  expect(page.url()).toMatch(/#map=[^&]+&gpx=https/);
  await expect(page.locator('#stat-dist')).toHaveText('1.0 km');
});

test('opening a local file clears the #gpx= parameter', async ({ page }) => {
  await serveTrackUrl(page, GPX_URL);
  await openWithHash(page, gpxHash(GPX_URL));
  await expect.poll(() => page.url()).toContain('gpx=');

  await page.setInputFiles('#file-input', FIXTURE_GPX);
  await expect.poll(() => page.url()).not.toContain('gpx=');
  await expect(page.locator('#stat-dist')).toHaveText('1.0 km');
});

test('a multi-track GPX warns that the tracks were concatenated', async ({ page }) => {
  const multi = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><name>Jour 1</name><trkseg>
    <trkpt lat="45.900" lon="6.870"><ele>1000</ele></trkpt>
    <trkpt lat="45.901" lon="6.870"><ele>1010</ele></trkpt>
  </trkseg></trk>
  <trk><name>Jour 2</name><trkseg>
    <trkpt lat="45.910" lon="6.880"><ele>1200</ele></trkpt>
    <trkpt lat="45.911" lon="6.880"><ele>1210</ele></trkpt>
  </trkseg></trk>
</gpx>`;
  await page.setInputFiles('#file-input', {
    name: 'multi.gpx', mimeType: 'application/gpx+xml', buffer: Buffer.from(multi),
  });
  await expect(page.locator('#toast')).toContainText('contains 2 tracks');
});

// ---- Hydration & resupply plan -------------------------------------------
// The 1 km fixture is too short to be thirsty on: these tests run on a
// 20 km / +1080 m track built on the fly, with the mocked water point of
// OVERPASS_RESPONSE sitting in its first kilometre.
function longTrackGpx() {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">\n' +
    '  <trk><name>Long</name><trkseg>\n';
  for (let i = 0; i <= 180; i++) {
    xml += `    <trkpt lat="${(45.9 + i * 0.001).toFixed(3)}" lon="6.870">` +
      `<ele>${1000 + i * 6}</ele></trkpt>\n`;
  }
  return xml + '  </trkseg></trk>\n</gpx>\n';
}

/**
 * Move one of the hydration sliders. `fill` refuses a range input, so the
 * value is set directly and both events the app listens to are fired.
 */
async function setSlider(page, selector, value) {
  await page.$eval(selector, (el, v) => {
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, String(value));
}

async function loadLongTrack(page) {
  await page.setInputFiles('#file-input', {
    name: 'long.gpx', mimeType: 'application/gpx+xml', buffer: Buffer.from(longTrackGpx()),
  });
  await expect(page.locator('#stat-dist')).toHaveText('20.0 km');
  await page.click('#hydration > summary');
}

test('the hydration plan stays off until it is switched on', async ({ page }) => {
  await loadLongTrack(page);

  // Nothing on the profile, in the panel or in the toolbar by default.
  await expect(page.locator('#stat-water-wrap')).toBeHidden();
  await expect(page.locator('#profile-hydration')).toHaveCount(0);
  await expect(page.locator('.hyd-sum')).toHaveCount(0);

  await page.check('#hyd-enable');
  await page.dispatchEvent('#hyd-enable', 'change');

  // 20 km + 1080 m of climb = 30.8 km-effort, 6 h 10 at 5 km-effort/h,
  // 500 mL/h -> ~3.1 L, none of which fits in a 1 L pack.
  await expect(page.locator('#stat-water')).toHaveText('3.1 L');
  await expect(page.locator('.hyd-sum b').nth(1)).toHaveText('6 h 10');
  await expect(page.locator('.hyd-alert')).toBeVisible();
  await expect(page.locator('.hyd-leg')).toHaveCount(1); // no source yet
  await expect(page.locator('.hyd-leg.risky')).toHaveCount(1);
  // The dry stretch is shaded on the profile.
  await expect(page.locator('#profile-hydration .hyd-band')).toHaveCount(1);

  // Switching it back off clears everything outside the panel.
  await page.uncheck('#hyd-enable');
  await page.dispatchEvent('#hyd-enable', 'change');
  await expect(page.locator('#stat-water-wrap')).toBeHidden();
  await expect(page.locator('#profile-hydration')).toHaveCount(0);
});

test('a water point on the track splits the plan in two legs', async ({ page }) => {
  await loadLongTrack(page);
  await page.check('#hyd-enable');
  await page.dispatchEvent('#hyd-enable', 'change');

  // The mocked water point sits in the first kilometre: the short leg up to
  // it is fine, everything after it is not.
  await page.click('#btn-generate');
  await expect(page.locator('.hyd-leg')).toHaveCount(2);
  await expect(page.locator('.hyd-leg.risky')).toHaveCount(1);
  await expect(page.locator('#profile-hydration .hyd-tick-dot')).toHaveCount(1);
  // The roadbook warns on the row the dry stretch starts from — a risk,
  // not a volume to pour: the flasks get filled to the brim anyway.
  await page.click('#btn-roadbook');
  const note = page.locator('#roadbook-body .rb-note');
  await expect(note).toHaveCount(1);
  await expect(note).toContainText('with no water point ahead');
  await expect(note).not.toContainText(' L');

  // A bigger pack covers the whole route: no risky leg left.
  await setSlider(page, '#hyd-capacity', 4000);
  await expect(page.locator('#hyd-capacity-band')).toHaveText('bladder + flasks');
  await expect(page.locator('.hyd-leg.risky')).toHaveCount(0);
  await expect(page.locator('.hyd-alert')).toHaveCount(0);
  await expect(page.locator('.hyd-ok')).toBeVisible();
  await expect(page.locator('#profile-hydration .hyd-band')).toHaveCount(0);
  await expect(page.locator('#roadbook-body .rb-note')).toHaveCount(0);
});

test('the heat setting drives the amount, and the settings are remembered', async ({ page }) => {
  await loadLongTrack(page);
  await page.check('#hyd-enable');
  await page.dispatchEvent('#hyd-enable', 'change');
  await expect(page.locator('#stat-water')).toHaveText('3.1 L');

  // Each slider spells out what its value means in plain language: that is
  // the only landmark a first-time user has.
  // Values shown must be the defaults themselves: a slider whose min is
  // off its step would snap 1000 mL to 1050.
  await expect(page.locator('#hyd-intake-val')).toHaveText('500 mL/h');
  await expect(page.locator('#hyd-capacity-val')).toHaveText('1000 mL');
  await expect(page.locator('#hyd-speed-val')).toHaveText('5 effort-km/h');
  await expect(page.locator('#hyd-intake-band')).toHaveText('usual');
  await expect(page.locator('#hyd-speed-band')).toHaveText('hiking');
  await expect(page.locator('#hyd-capacity-band')).toHaveText('two flasks');

  // The multiplier is on the option labels, and the help line spells out
  // the rate the plan runs on.
  await expect(page.locator('#hyd-heat option[value=hot]')).toHaveText('Hot (\u00d71.3)');
  await expect(page.locator('#hyd-rate')).toHaveText('Drink rate applied: 500 \u00d7 1 = 500 mL/h');

  await page.selectOption('#hyd-heat', 'scorching');
  await expect(page.locator('#stat-water')).toHaveText('4.9 L'); // x1.6
  await expect(page.locator('#hyd-rate')).toHaveText('Drink rate applied: 500 \u00d7 1.6 = 800 mL/h');

  await page.reload();
  await loadLongTrack(page);
  await expect(page.locator('#hyd-enable')).toBeChecked();
  await expect(page.locator('#hyd-heat')).toHaveValue('scorching');
  await expect(page.locator('#stat-water')).toHaveText('4.9 L');
});
