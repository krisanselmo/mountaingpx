import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LS_KEY, MAX_LAYERS, DEFAULTS, keyFor, validate, load, save, toDef,
} from '../js/customlayers.js';

const URL_OK = 'https://tiles.example.org/{z}/{x}/{y}.png';

// localStorage stub; `broken` simulates a storage that refuses every access
// (Safari private browsing).
function fakeStorage(initial, broken = false) {
  const store = new Map(Object.entries(initial || {}));
  return {
    getItem(k) {
      if (broken) throw new Error('denied');
      return store.has(k) ? store.get(k) : null;
    },
    setItem(k, v) {
      if (broken) throw new Error('denied');
      store.set(k, v);
    },
    raw: store,
  };
}

test('validate accepts an https XYZ template and trims the fields', () => {
  const { def, error } = validate({ name: '  IGN Plan  ', url: ` ${URL_OK} `, overlay: true });
  assert.equal(error, undefined);
  assert.deepEqual(def, { name: 'IGN Plan', url: URL_OK, overlay: true });
});

test('validate keeps the braces intact (a URL round-trip would encode them)', () => {
  const { def } = validate({ name: 'X', url: URL_OK });
  assert.equal(def.url, URL_OK);
  assert.equal(def.overlay, false);
});

test('validate accepts the {-y} flipped axis and the {s} subdomain', () => {
  const url = 'https://{s}.tiles.example.org/{z}/{x}/{-y}.jpg?key=abc';
  assert.equal(validate({ name: 'TMS', url }).def.url, url);
});

test('validate refuses a missing name', () => {
  assert.equal(validate({ name: '   ', url: URL_OK }).error, 'error.layerName');
});

test('validate refuses a name already in use, whatever the case', () => {
  const taken = ['Satellite', 'Points d\'eau'];
  assert.equal(validate({ name: 'satellite', url: URL_OK }, taken).error, 'error.layerDuplicate');
  assert.ok(validate({ name: 'Satellite 2', url: URL_OK }, taken).def);
});

test('validate refuses a malformed or non-https URL', () => {
  assert.equal(validate({ name: 'X', url: 'not a url' }).error, 'error.layerUrl');
  assert.equal(validate({ name: 'X', url: '/{z}/{x}/{y}.png' }).error, 'error.layerUrl');
  assert.equal(
    validate({ name: 'X', url: 'http://tiles.example.org/{z}/{x}/{y}.png' }).error,
    'error.layerScheme'
  );
});

test('validate accepts http from a loopback host (local tile server)', () => {
  for (const host of ['localhost:8080', '127.0.0.1:8080', '[::1]:8080']) {
    const url = `http://${host}/tiles/{z}/{x}/{y}.png`;
    assert.equal(validate({ name: host, url }).def.url, url, host);
  }
});

test('validate refuses a URL without the tile placeholders', () => {
  assert.equal(
    validate({ name: 'X', url: 'https://tiles.example.org/preview.png' }).error,
    'error.layerTemplate'
  );
  assert.equal(
    validate({ name: 'X', url: 'https://tiles.example.org/{z}/{x}.png' }).error,
    'error.layerTemplate'
  );
});

test('validate keeps the zoom and opacity options, as numbers', () => {
  // The form hands over strings, empty when the field is left alone.
  const { def } = validate({
    name: 'X', url: URL_OK, overlay: true,
    minZoom: '1', maxZoom: '19', maxNativeZoom: '15', opacity: '0.7',
  });
  assert.deepEqual(def, {
    name: 'X', url: URL_OK, overlay: true,
    minZoom: 1, maxZoom: 19, maxNativeZoom: 15, opacity: 0.7,
  });
});

test('validate omits the options left empty rather than guessing them', () => {
  const { def } = validate({
    name: 'X', url: URL_OK, minZoom: '', maxZoom: '  ', maxNativeZoom: null, opacity: undefined,
  });
  assert.deepEqual(Object.keys(def), ['name', 'url', 'overlay']);
});

test('validate refuses out-of-range or fractional zoom levels', () => {
  for (const bad of [{ minZoom: '-1' }, { maxZoom: '25' }, { maxZoom: '12.5' },
    { maxZoom: 'abc' }, { minZoom: '10', maxZoom: '5' }]) {
    assert.equal(validate({ name: 'X', url: URL_OK, ...bad }).error, 'error.layerZoom',
      JSON.stringify(bad));
  }
});

test('validate keeps the native zoom inside the layer zoom range', () => {
  // The default max applies when the field is left empty.
  assert.equal(
    validate({ name: 'X', url: URL_OK, maxNativeZoom: String(DEFAULTS.maxZoom + 1) }).error,
    'error.layerZoom'
  );
  assert.equal(
    validate({ name: 'X', url: URL_OK, minZoom: '10', maxNativeZoom: '8' }).error,
    'error.layerZoom'
  );
  assert.ok(validate({ name: 'X', url: URL_OK, minZoom: '1', maxZoom: '19', maxNativeZoom: '15' }).def);
});

test('validate refuses an opacity outside (0, 1]', () => {
  for (const bad of ['0', '-0.5', '1.5', '70', 'x']) {
    assert.equal(validate({ name: 'X', url: URL_OK, opacity: bad }).error,
      'error.layerOpacity', bad);
  }
  assert.equal(validate({ name: 'X', url: URL_OK, opacity: '1' }).def.opacity, 1);
});

test('toDef strips the runtime fields but keeps the options', () => {
  assert.deepEqual(
    toDef({ name: 'X', url: URL_OK, overlay: true, maxNativeZoom: 15, opacity: 0.7,
      key: 'custom:X', custom: true, layer: {} }),
    { name: 'X', url: URL_OK, overlay: true, maxNativeZoom: 15, opacity: 0.7 }
  );
});

test('keyFor namespaces the id used by the layer-selection persistence', () => {
  assert.equal(keyFor('IGN Plan'), 'custom:IGN Plan');
});

test('save stores only the definition fields', () => {
  const storage = fakeStorage();
  // Entries carry a Leaflet layer and a key at runtime: neither is persisted.
  save(storage, [{ name: 'IGN', url: URL_OK, overlay: true, layer: {}, key: 'custom:IGN' }]);
  assert.deepEqual(JSON.parse(storage.raw.get(LS_KEY)), [
    { name: 'IGN', url: URL_OK, overlay: true },
  ]);
});

test('a layer with options survives the save / load round-trip', () => {
  const storage = fakeStorage();
  const def = {
    name: 'IGN', url: URL_OK, overlay: true, minZoom: 1, maxZoom: 19,
    maxNativeZoom: 15, opacity: 0.7,
  };
  save(storage, [def]);
  assert.deepEqual(load(storage), [def]);
});

test('load returns the stored definitions in order', () => {
  const defs = [
    { name: 'Base', url: URL_OK, overlay: false },
    { name: 'Over', url: URL_OK, overlay: true },
  ];
  const storage = fakeStorage({ [LS_KEY]: JSON.stringify(defs) });
  assert.deepEqual(load(storage), defs);
});

test('load drops entries that no longer validate', () => {
  const storage = fakeStorage({
    [LS_KEY]: JSON.stringify([
      { name: 'Good', url: URL_OK, overlay: true },
      { name: '', url: URL_OK },                                  // no name
      { name: 'Insecure', url: 'http://x.org/{z}/{x}/{y}.png' },   // not https
      { name: 'Dup', url: URL_OK },
      { name: 'dup', url: URL_OK },                               // duplicate
      { name: 'Satellite', url: URL_OK },                         // built-in name
      null,
    ]),
  });
  assert.deepEqual(load(storage, ['Satellite']).map((d) => d.name), ['Good', 'Dup']);
});

test('load caps the list and tolerates junk or unreachable storage', () => {
  const many = Array.from({ length: MAX_LAYERS + 5 }, (_, i) => ({
    name: 'L' + i, url: URL_OK, overlay: true,
  }));
  assert.equal(load(fakeStorage({ [LS_KEY]: JSON.stringify(many) })).length, MAX_LAYERS);

  assert.deepEqual(load(fakeStorage()), []);
  assert.deepEqual(load(fakeStorage({ [LS_KEY]: '{oops' })), []);
  assert.deepEqual(load(fakeStorage({ [LS_KEY]: '"a string"' })), []);
  assert.deepEqual(load(fakeStorage({}, true)), []);
});

test('save on an unreachable storage is a no-op, not a crash', () => {
  save(fakeStorage({}, true), [{ name: 'X', url: URL_OK }]);
});
