import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RAINVIEWER, rainviewerFrames, latestObserved, createWeatherOverlay,
} from '../js/weather.js';

// Minimal Leaflet-like map: event emitter + "is this layer shown".
function fakeMap(layer) {
  const handlers = {};
  return {
    shown: false,
    on(names, fn) {
      for (const nm of names.split(' ')) (handlers[nm] = handlers[nm] || []).push(fn);
    },
    async fire(name, ev) {
      for (const fn of handlers[name] || []) fn(ev);
      await tick();
    },
    hasLayer(l) { return this.shown && l === layer; },
  };
}

function fakeLayer() {
  return {
    cleared: 0,
    tiles: [],
    clearLayers() { this.cleared++; this.tiles = []; },
    addLayer(t) { this.tiles.push(t); },
  };
}

const tick = () => new Promise((r) => setTimeout(r, 5));

// Two observed scans then one nowcast, as RainViewer serves them.
const INDEX = {
  host: 'https://tilecache.rainviewer.com',
  radar: {
    past: [
      { time: 1700000000, path: '/v2/radar/1700000000' },
      { time: 1700000600, path: '/v2/radar/1700000600' },
    ],
    nowcast: [{ time: 1700001200, path: '/v2/radar/nowcast_abc123' }],
  },
};

// The real provider, minus the periodic reload: a pending timer would keep
// `node --test` running. The timer has a test of its own below.
const PROVIDER = { ...RAINVIEWER, refreshMs: 0 };

function setup(index = INDEX, { provider = PROVIDER } = {}) {
  const layer = fakeLayer();
  const map = fakeMap(layer);
  const fetched = [];
  const errors = [];
  let payload = index;
  const ctrl = createWeatherOverlay({
    map,
    layer,
    provider,
    fetchIndex: async (url) => {
      fetched.push(url);
      if (payload instanceof Error) throw payload;
      return payload;
    },
    makeTileLayer: (frame) => ({ url: frame.url, forecast: frame.forecast }),
    onError: (err) => errors.push(err),
  });
  return {
    ctrl, map, layer, fetched, errors,
    show: async () => {
      map.shown = true;
      await map.fire('overlayadd', { layer });
    },
    hide: async () => {
      map.shown = false;
      await map.fire('overlayremove', { layer });
    },
    setPayload: (p) => { payload = p; },
  };
}

test('rainviewerFrames: observed scans then nowcast, oldest first', () => {
  const frames = rainviewerFrames(INDEX);
  assert.equal(frames.length, 3);
  assert.deepEqual(frames.map((f) => f.time), [1700000000000, 1700000600000, 1700001200000]);
  assert.deepEqual(frames.map((f) => f.forecast), [false, false, true]);
  assert.equal(
    frames[0].url,
    'https://tilecache.rainviewer.com/v2/radar/1700000000/256/{z}/{x}/{y}/2/1_1.png'
  );
});

test('rainviewerFrames: skips malformed entries', () => {
  const frames = rainviewerFrames({
    host: INDEX.host,
    radar: {
      past: [
        { time: 'soon', path: '/v2/radar/1' }, // not a timestamp
        { time: 1700000000 }, // no path
        { time: 1700000001, path: 'https://evil.example/x' }, // not a path
        { time: 1700000002, path: '/v2/radar/ok' },
      ],
      nowcast: null,
    },
  });
  assert.deepEqual(frames.map((f) => f.time), [1700000002000]);
});

test('rainviewerFrames: refuses a tile host that is not RainViewer over https', () => {
  assert.deepEqual(rainviewerFrames({ ...INDEX, host: 'https://evil.example' }), []);
  assert.deepEqual(rainviewerFrames({ ...INDEX, host: 'http://tilecache.rainviewer.com' }), []);
  assert.deepEqual(rainviewerFrames({ ...INDEX, host: undefined }), []);
  assert.deepEqual(rainviewerFrames(null), []);
});

test('latestObserved: last non-forecast frame, else the last one', () => {
  assert.equal(latestObserved(rainviewerFrames(INDEX)), 1);
  assert.equal(latestObserved([{ forecast: true }, { forecast: true }]), 1);
  assert.equal(latestObserved([]), -1);
});

test('showing the overlay loads the index and paints the latest observed frame', async () => {
  const { ctrl, layer, fetched, show } = setup();
  assert.equal(fetched.length, 0); // nothing fetched while hidden
  await show();
  assert.deepEqual(fetched, [RAINVIEWER.indexUrl]);
  assert.equal(layer.tiles.length, 1);
  assert.equal(ctrl.current(), 1);
  assert.equal(layer.tiles[0].forecast, false);
});

test('hiding the overlay drops its tiles', async () => {
  const { layer, show, hide } = setup();
  await show();
  await hide();
  assert.equal(layer.tiles.length, 0);
});

test('setFrame paints another frame and is kept across a refresh', async () => {
  const { ctrl, layer, show } = setup();
  await show();
  ctrl.setFrame(0);
  assert.equal(ctrl.current(), 0);
  assert.match(layer.tiles[0].url, /1700000000/);

  // A newer index arrives: the pinned frame is still the one displayed.
  await ctrl.refresh();
  assert.equal(ctrl.current(), 0);
  assert.match(layer.tiles[0].url, /1700000000/);

  // Back on the latest observed frame: refreshes track it again.
  ctrl.setFrame(1);
  const newer = {
    host: INDEX.host,
    radar: { past: [...INDEX.radar.past, { time: 1700001800, path: '/v2/radar/1700001800' }] },
  };
  const ctrl2 = setup(newer);
  await ctrl2.show();
  assert.match(ctrl2.layer.tiles[0].url, /1700001800/);
});

test('setFrame clamps out-of-range indexes', async () => {
  const { ctrl, show } = setup();
  await show();
  ctrl.setFrame(99);
  assert.equal(ctrl.current(), 2);
  ctrl.setFrame(-5);
  assert.equal(ctrl.current(), 0);
});

test('an unchanged latest frame is not repainted', async () => {
  const { ctrl, layer, show } = setup();
  await show();
  const cleared = layer.cleared;
  await ctrl.refresh();
  assert.equal(layer.cleared, cleared);
  assert.equal(layer.tiles.length, 1);
});

test('a failing index reports the error and leaves the map alone', async () => {
  const { layer, errors, show } = setup(new Error('boom'));
  await show();
  assert.equal(errors.length, 1);
  assert.equal(layer.tiles.length, 0);
});

test('an empty index is reported as an error too', async () => {
  const { errors, show } = setup({ host: INDEX.host, radar: {} });
  await show();
  assert.equal(errors.length, 1);
});

test('the index is reloaded on a timer while the overlay stays visible', async () => {
  const { ctrl, fetched, show } = setup(INDEX, {
    provider: { ...RAINVIEWER, refreshMs: 10 },
  });
  await show();
  assert.equal(fetched.length, 1);
  await new Promise((r) => setTimeout(r, 40));
  assert.ok(fetched.length > 1, `got ${fetched.length}`);
  ctrl.stop();
});

test('a provider without indexUrl needs no HTTP call', async () => {
  const STATIC = {
    id: 'static',
    attribution: '© Somewhere',
    tile: { opacity: 0.5 },
    frames: () => [{ time: null, forecast: false, url: 'https://tiles.example/{z}/{x}/{y}.png' }],
  };
  const { layer, fetched, show } = setup(INDEX, { provider: STATIC });
  await show();
  assert.equal(fetched.length, 0);
  assert.equal(layer.tiles.length, 1);
  assert.equal(layer.tiles[0].url, 'https://tiles.example/{z}/{x}/{y}.png');
});
