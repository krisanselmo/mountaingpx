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
