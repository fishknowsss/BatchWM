import test from 'node:test';
import assert from 'node:assert/strict';

import { readLastOutputDir, rememberLastOutputDir } from '../src/shared/preferences.js';

test('remembers the last selected output directory', () => {
  const storage = createMemoryStorage();

  rememberLastOutputDir('/Users/me/Movies/out', storage);

  assert.equal(readLastOutputDir(storage), '/Users/me/Movies/out');
});

test('ignores empty output directory values', () => {
  const storage = createMemoryStorage();

  rememberLastOutputDir('  ', storage);

  assert.equal(readLastOutputDir(storage), '');
});

test('handles unavailable storage without crashing', () => {
  const brokenStorage = {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('blocked');
    }
  };

  assert.equal(readLastOutputDir(brokenStorage), '');
  assert.doesNotThrow(() => rememberLastOutputDir('/tmp/out', brokenStorage));
});

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.get(key) || null;
    },
    setItem(key, value) {
      values.set(key, value);
    }
  };
}
