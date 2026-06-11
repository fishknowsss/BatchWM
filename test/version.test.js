import test from 'node:test';
import assert from 'node:assert/strict';

import { formatAppVersion } from '../src/shared/version.js';

test('formats app version for the interface', () => {
  assert.equal(formatAppVersion('0.1.1'), 'v0.1.1');
  assert.equal(formatAppVersion(' 1.2.3 '), 'v1.2.3');
});

test('falls back to a stable version label', () => {
  assert.equal(formatAppVersion(''), 'v0.0.0');
  assert.equal(formatAppVersion(null), 'v0.0.0');
});
