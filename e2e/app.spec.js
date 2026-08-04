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

// ---- Custom layers -------------------------------------------------------
const CUSTOM_TILES = 'https://tiles.example.org/{z}/{x}/{y}.png';

async function addCustomLayer(page, name, url, type, opts = {}) {
  // The editor is a collapsed <details>: opening it twice would close it.
  const panel = page.locator('#custom-layers');
  if (!(await panel.evaluate((n) => n.open))) await page.click('details.custom-layers > summary');
  await page.fill('#cl-name', name);
  await page.fill('#cl-url', url);
  if (type) await page.selectOption('#cl-type', type);
  const options = Object.entries(opts);
  if (options.length) {
    const adv = page.locator('.cl-adv');
    if (!(await adv.evaluate((n) => n.open))) await adv.locator('summary').click();
    for (const [field, value] of options) await page.fill(`#cl-${field}`, String(value));
  }
  await page.click('#cl-add');
}

test('a custom overlay joins the layers control and survives a reload', async ({ page }) => {
  await addCustomLayer(page, 'Pentes', CUSTOM_TILES);
  await expect(page.locator('#toast')).toContainText('added');
  await expect(page.locator('#cl-list .cl-item')).toHaveCount(1);
  await expect(page.locator('#cl-empty')).toBeHidden();

  // Listed in the control's overlays, and enabled right away.
  const entry = page.locator('.leaflet-control-layers-overlays label', { hasText: 'Pentes' });
  await expect(entry.locator('input')).toBeChecked();

  await page.reload();
  await page.click('details.custom-layers > summary');
  await expect(page.locator('#cl-list .cl-item')).toContainText('Pentes');
  // Still the active overlay: the selection is remembered by its own key.
  await expect(
    page.locator('.leaflet-control-layers-overlays label', { hasText: 'Pentes' }).locator('input')
  ).toBeChecked();

  // Removing it empties the list, in the control too, and for good.
  await page.click('#cl-list .cl-del');
  await expect(page.locator('#toast')).toContainText('removed');
  await expect(page.locator('#cl-empty')).toBeVisible();
  await expect(page.locator('.leaflet-control-layers-overlays label', { hasText: 'Pentes' }))
    .toHaveCount(0);
  await page.reload();
  await page.click('details.custom-layers > summary');
  await expect(page.locator('#cl-list .cl-item')).toHaveCount(0);
});

test('a custom base map replaces the visible one', async ({ page }) => {
  await addCustomLayer(page, 'Mon fond', CUSTOM_TILES, 'base');
  const bases = page.locator('.leaflet-control-layers-base label');
  await expect(bases.filter({ hasText: 'Mon fond' }).locator('input')).toBeChecked();
  // Exactly one base map stays selected.
  await expect(bases.locator('input:checked')).toHaveCount(1);
});

test('an unusable tile URL is refused with a targeted error', async ({ page }) => {
  await addCustomLayer(page, 'Sans variables', 'https://tiles.example.org/preview.png');
  await expect(page.locator('#toast')).toContainText('{z}');
  await expect(page.locator('#cl-list .cl-item')).toHaveCount(0);

  await addCustomLayer(page, 'En clair', 'http://tiles.example.org/{z}/{x}/{y}.png');
  await expect(page.locator('#toast')).toContainText('https://');
  await expect(page.locator('#cl-list .cl-item')).toHaveCount(0);
});

test('the zoom and opacity options reach the tile layer', async ({ page }) => {
  const tiles = [];
  await page.route('https://tiles.example.org/**', (route) => {
    tiles.push(new URL(route.request().url()).pathname);
    return route.abort();
  });

  await addCustomLayer(page, 'Pentes', CUSTOM_TILES, 'overlay', {
    minzoom: 1, maxzoom: 19, nativezoom: 15, opacity: 0.5,
  });
  await expect(page.locator('#cl-list .cl-item small')).toContainText('z1–19 (15)');
  await expect(page.locator('#cl-list .cl-item small')).toContainText('50 %');

  // The overlay is drawn at the requested opacity.
  await expect
    .poll(() => page.evaluate(() => [...document.querySelectorAll('.leaflet-tile-pane .leaflet-layer')]
      .map((l) => l.style.opacity)))
    .toContain('0.5');

  // Past the native level, Leaflet upscales z15 tiles instead of asking the
  // source for levels it does not serve (the fixture map starts at zoom 12).
  tiles.length = 0;
  // One step at a time: clicks during the zoom animation are swallowed.
  for (const zoom of [13, 14, 15, 16, 17]) {
    await page.click('.leaflet-control-zoom-in');
    await expect.poll(() => page.url()).toContain(`#map=${zoom}/`);
  }
  const levels = [...new Set(tiles.map((p) => Number(p.split('/')[1])))];
  expect(levels).toContain(15);
  expect(Math.max(...levels)).toBe(15);
});

test('a custom layer can be edited in place, or the edit cancelled', async ({ page }) => {
  await addCustomLayer(page, 'Pentes', CUSTOM_TILES, 'overlay', { opacity: 0.5 });

  // Cancelling restores the "add" mode and changes nothing.
  await page.click('#cl-list .cl-edit');
  await expect(page.locator('#cl-name')).toHaveValue('Pentes');
  await expect(page.locator('#cl-opacity')).toHaveValue('0.5');
  await page.fill('#cl-name', 'Jeté');
  await page.click('#cl-cancel');
  await expect(page.locator('#cl-name')).toHaveValue('');
  await expect(page.locator('#cl-list .cl-item b')).toHaveText('Pentes');

  // Saving renames the layer, keeps it enabled and persists the change.
  await page.click('#cl-list .cl-edit');
  await page.fill('#cl-name', 'Pentes hiver');
  await page.fill('#cl-opacity', '0.9');
  await page.click('#cl-add'); // labelled "Save" in edit mode
  await expect(page.locator('#toast')).toContainText('updated');
  await expect(page.locator('#cl-list .cl-item')).toHaveCount(1);
  await expect(page.locator('#cl-list .cl-item b')).toHaveText('Pentes hiver');
  await expect(page.locator('#cl-list .cl-item small')).toContainText('90 %');
  await expect(
    page.locator('.leaflet-control-layers-overlays label', { hasText: 'Pentes hiver' })
      .locator('input')
  ).toBeChecked();
  await expect(page.locator('#cl-cancel')).toBeHidden();

  await page.reload();
  await page.click('details.custom-layers > summary');
  await expect(page.locator('#cl-list .cl-item b')).toHaveText('Pentes hiver');
});

test('editing a layer can turn an overlay into a base map', async ({ page }) => {
  await addCustomLayer(page, 'Pentes', CUSTOM_TILES);
  await page.click('#cl-list .cl-edit');
  await page.selectOption('#cl-type', 'base');
  await page.click('#cl-add');

  await expect(page.locator('.leaflet-control-layers-overlays label', { hasText: 'Pentes' }))
    .toHaveCount(0);
  const bases = page.locator('.leaflet-control-layers-base label');
  await expect(bases.filter({ hasText: 'Pentes' }).locator('input')).toBeChecked();
  await expect(bases.locator('input:checked')).toHaveCount(1);
});

test('the layers control links to the custom-layers editor', async ({ page }) => {
  // The control only shows its list (and the link) once expanded.
  await page.hover('.leaflet-control-layers');
  await page.click('.leaflet-control-layers .cl-open');
  await expect(page.locator('#custom-layers')).toHaveAttribute('open', '');
  await expect(page.locator('#cl-name')).toBeFocused();
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

// 1×1 transparent PNG, stands in for a radar tile.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=',
  'base64'
);

// Shape of RainViewer's weather-maps.json: observed scans, then the nowcast.
const RAINVIEWER_INDEX = {
  version: '2.0',
  host: 'https://tilecache.rainviewer.com',
  radar: {
    past: [
      { time: 1700000000, path: '/v2/radar/1700000000' },
      { time: 1700000600, path: '/v2/radar/1700000600' },
    ],
    nowcast: [{ time: 1700001200, path: '/v2/radar/nowcast_abc123' }],
  },
};

/** Mock RainViewer and return the tile URLs the map asks for. */
async function mockRadar(page) {
  const tiles = [];
  // Registered after the beforeEach catch-all, so these win.
  await page.route('https://api.rainviewer.com/**', (route) =>
    route.fulfill({ json: RAINVIEWER_INDEX })
  );
  await page.route('https://tilecache.rainviewer.com/**', (route) => {
    tiles.push(route.request().url());
    return route.fulfill({ body: PNG, contentType: 'image/png' });
  });
  return tiles;
}

/** Toggle an overlay from the (collapsed) Leaflet layers control. */
async function toggleOverlay(page, name, on) {
  await page.hover('.leaflet-control-layers');
  const label = page.locator('.leaflet-control-layers-overlays label', { hasText: name });
  await label.locator('input[type=checkbox]').setChecked(on);
}

test('the radar overlay paints the latest observed frame and credits RainViewer', async ({ page }) => {
  const tiles = await mockRadar(page);

  await toggleOverlay(page, 'Rain radar', true);

  // Tiles of the most recent *observed* frame, not the nowcast one, and never
  // past zoom 7: the free radar serves a placeholder image beyond that, so
  // Leaflet must upscale the z7 tiles instead (the default view is at z12).
  await expect.poll(() => tiles.length).toBeGreaterThan(0);
  for (const url of tiles) {
    expect(url).toMatch(
      /^https:\/\/tilecache\.rainviewer\.com\/v2\/radar\/1700000600\/256\/7\/\d+\/\d+\/2\/1_1\.png$/
    );
  }

  // The credit line carries the time of the frame on screen.
  const attribution = page.locator('.leaflet-control-attribution');
  await expect(attribution).toContainText('RainViewer');
  await expect(attribution).toContainText(/\d{1,2}:\d{2}/);

  // Turning it off drops the tiles and the credit.
  await toggleOverlay(page, 'Rain radar', false);
  await expect(attribution).not.toContainText('RainViewer');
});

test('the radar overlay is restored on reload, and survives an unreachable API', async ({ page }) => {
  await mockRadar(page);
  await toggleOverlay(page, 'Rain radar', true);
  await expect(page.locator('.leaflet-control-attribution')).toContainText('RainViewer');

  // The overlay selection is persisted: it comes back enabled, and a failing
  // index is reported without breaking the map.
  await page.route('https://api.rainviewer.com/**', (route) => route.abort());
  await page.reload();
  await expect(page.locator('#toast')).toContainText('Weather radar unavailable');
  await expect(page.locator('#map')).toBeVisible();
});
