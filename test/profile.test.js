import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import * as Profile from '../js/profile.js';

let document;
before(() => {
  const dom = new JSDOM('<body><svg id="profile"></svg></body>');
  document = dom.window.document;
});

const route = {
  lat: [45.00, 45.01, 45.02, 45.03],
  lon: [6.00, 6.00, 6.00, 6.00],
  ele: [1000, 1200, 1100, 1400],
};

function freshSvg() {
  const svg = document.querySelector('#profile');
  svg.innerHTML = '';
  return svg;
}

test('render: draws the curve and returns the geometry and stats', () => {
  const svg = freshSvg();
  const p = Profile.render(svg, route, { width: 600 });
  assert.ok(p);
  assert.equal(p.dist.length, 4);
  assert.ok(Math.abs(p.total - 3.336) < 0.02); // ~1.112 km per 0.01° step
  assert.equal(p.minE, 1000);
  assert.equal(p.maxE, 1400);
  assert.equal(p.dplus, 500); // +200 then +300
  assert.ok(svg.innerHTML.includes('1400m'));
  assert.ok(svg.innerHTML.includes('1000m'));
  assert.ok(svg.querySelector('#profile-cursor'));
  assert.equal(svg.getAttribute('viewBox'), '0 0 600 120');
  // Geometry: x grows with the index, start/end within the padded area.
  assert.ok(p.cx(0) < p.cx(1) && p.cx(1) < p.cx(3));
  assert.equal(p.cx(0), 40); // pad.l
});

test('render: no elevation -> message and null', () => {
  const svg = freshSvg();
  const flat = { lat: [45, 45.01], lon: [6, 6], ele: [0, 0] };
  const p = Profile.render(svg, flat, { width: 600, noElevationText: 'Pas de <données>' });
  assert.equal(p, null);
  // The message is escaped.
  assert.ok(svg.innerHTML.includes('Pas de &lt;données&gt;'));
});

test('renderWaypoints: one dot per waypoint, linked by data-wpt', () => {
  const svg = freshSvg();
  const p = Profile.render(svg, route, { width: 600 });
  const pts = [
    { osmType: 'node', id: 1, index: 1, queryName: 'peak', name: 'Pic <A>', ele: 1200 },
    { osmType: 'file', id: 0, index: 2, queryName: 'spring', name: 'Source', ele: 0 },
  ];
  Profile.renderWaypoints(svg, p, pts, { show: true, colorFor: (q) => (q === 'peak' ? '#123456' : null) });
  const dots = svg.querySelectorAll('#profile-wpts circle');
  assert.equal(dots.length, 2);
  assert.equal(dots[0].getAttribute('data-wpt'), 'node1');
  assert.equal(dots[0].getAttribute('fill'), '#123456');
  assert.equal(dots[1].getAttribute('fill'), '#64748b'); // fallback color
  assert.ok(svg.innerHTML.includes('Pic &lt;A&gt; — 1200 m'));

  // Re-render replaces the group instead of stacking a second one.
  Profile.renderWaypoints(svg, p, pts, { show: false });
  assert.equal(svg.querySelectorAll('#profile-wpts').length, 1);
  assert.equal(svg.querySelector('#profile-wpts').getAttribute('style'), 'display:none');
});

test('indexAt: maps an abscissa back to the nearest route index', () => {
  const svg = freshSvg();
  const p = Profile.render(svg, route, { width: 600 });
  assert.equal(Profile.indexAt(p, p.cx(0)), 0);
  assert.equal(Profile.indexAt(p, p.cx(2)), 2);
  assert.equal(Profile.indexAt(p, p.cx(3)), 3);
  // Outside the plotted range on both sides.
  assert.equal(Profile.indexAt(p, 0), null);
  assert.equal(Profile.indexAt(p, 599), null);
});

test('setDotHighlight: grows the dot and restores it', () => {
  const svg = freshSvg();
  const p = Profile.render(svg, route, { width: 600 });
  const pts = [{ osmType: 'node', id: 7, index: 1, queryName: 'peak', name: 'Pic', ele: 0 }];
  Profile.renderWaypoints(svg, p, pts, { show: true });
  Profile.setDotHighlight(svg, 'node7', true);
  const dot = svg.querySelector('[data-wpt="node7"]');
  assert.equal(dot.getAttribute('r'), '6.5');
  Profile.setDotHighlight(svg, 'node7', false);
  assert.equal(dot.getAttribute('r'), '4');
  // Unknown key: no crash.
  Profile.setDotHighlight(svg, 'nope', true);
});
