import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import * as Roadbook from '../js/roadbook.js';

let document;
before(() => {
  const dom = new JSDOM('<body><div id="rb"></div></body>');
  document = dom.window.document;
});

// Straight route heading north, ~1.112 km between points.
const mkRoute = () => ({
  lat: [45.00, 45.01, 45.02, 45.03],
  lon: [6.00, 6.00, 6.00, 6.00],
  ele: [1000, 1200, 1100, 1400],
});

const pts = [
  { osmType: 'node', id: 2, index: 2, queryName: 'spring', name: 'Source & co', ele: 0 },
  { osmType: 'node', id: 1, index: 1, queryName: 'peak', name: 'Pic', ele: 1200 },
];

function opts(log) {
  return {
    iconSvg: (p) => `<svg data-icon="${p.queryName}"></svg>`,
    flagSvg: (kind) => `<svg data-flag="${kind}"></svg>`,
    typeLabel: (p) => (p.queryName === 'peak' ? 'Sommet' : ''),
    startLabel: 'Départ',
    endLabel: 'Arrivée',
    onFocus: (p) => log.push(['focus', p.name]),
    onHover: (p, on) => log.push(['hover', p.name, on]),
    onEndpoint: (idx) => log.push(['endpoint', idx]),
  };
}

test('cumDistFor: cumulative kilometers, cached on the route', () => {
  const route = mkRoute();
  const cum = Roadbook.cumDistFor(route);
  assert.equal(cum.length, 4);
  assert.equal(cum[0], 0);
  assert.ok(Math.abs(cum[3] - 3.336) < 0.02);
  assert.equal(Roadbook.cumDistFor(route), cum); // cached
});

test('render: endpoint rows around waypoints sorted by track order', () => {
  const body = document.querySelector('#rb');
  Roadbook.render(body, mkRoute(), pts, opts([]));
  const rows = body.querySelectorAll('.rb-row');
  assert.equal(rows.length, 4); // start + 2 wpts + end

  const names = [...rows].map((r) => r.querySelector('.rb-name').textContent);
  // Waypoints reordered by their route index, despite the input order.
  assert.deepEqual(names, ['Départ', 'Pic', 'Source & co', 'Arrivée']);

  // km and altitude columns.
  assert.ok(rows[1].innerHTML.includes('1.1 km'));
  assert.ok(rows[1].innerHTML.includes('1200 m'));
  // Type label only when provided; injected icons are used.
  assert.ok(rows[1].innerHTML.includes('Sommet'));
  assert.ok(!rows[2].innerHTML.includes('rb-type'));
  assert.ok(rows[1].innerHTML.includes('data-icon="peak"'));
  assert.ok(rows[0].innerHTML.includes('data-flag="start"'));
  // data-wpt key links the row to the map pin and the profile dot.
  assert.equal(rows[1].dataset.wpt, 'node1');
});

test('render: callbacks fire on click and hover', () => {
  const body = document.querySelector('#rb');
  const log = [];
  Roadbook.render(body, mkRoute(), pts, opts(log));
  const rows = body.querySelectorAll('.rb-row');

  rows[1].dispatchEvent(new (document.defaultView.Event)('click'));
  rows[1].dispatchEvent(new (document.defaultView.Event)('mouseenter'));
  rows[1].dispatchEvent(new (document.defaultView.Event)('mouseleave'));
  rows[0].dispatchEvent(new (document.defaultView.Event)('click'));
  rows[3].dispatchEvent(new (document.defaultView.Event)('click'));

  assert.deepEqual(log, [
    ['focus', 'Pic'],
    ['hover', 'Pic', true],
    ['hover', 'Pic', false],
    ['endpoint', 0],
    ['endpoint', 3],
  ]);
});

test('render: waypoint names are escaped', () => {
  const body = document.querySelector('#rb');
  Roadbook.render(body, mkRoute(), [
    { osmType: 'node', id: 9, index: 1, queryName: 'peak', name: '<img src=x>', ele: 0 },
  ], opts([]));
  assert.ok(!body.innerHTML.includes('<img'));
  assert.ok(body.innerHTML.includes('&lt;img src=x&gt;'));
});
