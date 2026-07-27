import { test } from 'node:test';
import assert from 'node:assert/strict';

import { repoUrlFrom } from '../js/github.js';

test('derives the repository from a project-pages URL', () => {
  assert.equal(
    repoUrlFrom(['https://krisanselmo.github.io/mountaingpx/']),
    'https://github.com/krisanselmo/mountaingpx'
  );
  assert.equal(
    repoUrlFrom(['https://krisanselmo.github.io/mountaingpx/en.html#map=12/45.9/6.87']),
    'https://github.com/krisanselmo/mountaingpx'
  );
});

test('a user-pages site maps to the <owner>.github.io repository', () => {
  assert.equal(
    repoUrlFrom(['https://someone.github.io/']),
    'https://github.com/someone/someone.github.io'
  );
  // A page file at the domain root is not a repository name.
  assert.equal(
    repoUrlFrom(['https://someone.github.io/en.html']),
    'https://github.com/someone/someone.github.io'
  );
});

test('falls back through the candidate list', () => {
  assert.equal(
    repoUrlFrom([
      'http://localhost:4173/',
      undefined,
      'https://krisanselmo.github.io/mountaingpx/',
    ]),
    'https://github.com/krisanselmo/mountaingpx'
  );
});

test('returns null when no candidate is a GitHub Pages URL', () => {
  assert.equal(repoUrlFrom(['http://localhost:4173/', 'https://example.com/']), null);
  assert.equal(repoUrlFrom([]), null);
  // Lookalike hosts must not match (github.io must be the registered domain).
  assert.equal(repoUrlFrom(['https://evil.github.io.example.com/x/']), null);
});
