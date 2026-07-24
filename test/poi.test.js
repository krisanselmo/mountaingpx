import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POI, GENERIC_TYPE, poiTypeFrom } from '../js/poi.js';

test('catalog POI types map to themselves', () => {
  assert.equal(poiTypeFrom('peak'), 'peak');
  assert.equal(poiTypeFrom('drinking_water'), 'drinking_water');
  assert.equal(poiTypeFrom('camp_site'), 'camp_site');
});

test('the Garmin course-point vocabulary of our own exports round-trips', () => {
  // Types written by gpx.js courseType(): reading a Mountain GPX file back
  // must classify its waypoints, not degrade them to generic.
  assert.equal(poiTypeFrom('summit'), 'peak');
  assert.equal(poiTypeFrom('overlook'), 'viewpoint');
  assert.equal(poiTypeFrom('water'), 'drinking_water');
  assert.equal(poiTypeFrom('campsite'), 'camp_site');
  assert.equal(poiTypeFrom('toilet'), 'toilets');
  assert.equal(poiTypeFrom('danger'), 'barrier');
  assert.equal(poiTypeFrom('shelter'), 'shelter');
});

test('type matching is case/spacing-insensitive (Garmin <sym> style)', () => {
  assert.equal(poiTypeFrom('Summit'), 'peak');
  assert.equal(poiTypeFrom('Drinking Water'), 'drinking_water');
  assert.equal(poiTypeFrom('Campground'), 'camp_site');
  assert.equal(poiTypeFrom(' Peak '), 'peak');
});

test('unsupported or missing types fall back to the generic type', () => {
  assert.equal(poiTypeFrom('Flag, Blue'), GENERIC_TYPE);
  assert.equal(poiTypeFrom('whatever'), GENERIC_TYPE);
  assert.equal(poiTypeFrom(''), GENERIC_TYPE);
  assert.equal(poiTypeFrom(null), GENERIC_TYPE);
  assert.equal(poiTypeFrom(undefined), GENERIC_TYPE);
  // The generic type stays out of the catalog (no Overpass query, no
  // sidebar row): renderers rely on their own fallbacks for it.
  assert.equal(POI[GENERIC_TYPE], undefined);
  assert.equal(poiTypeFrom(GENERIC_TYPE), GENERIC_TYPE);
});
