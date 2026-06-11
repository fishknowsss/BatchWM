import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_SOURCE_MODE,
  DEFAULT_TEXT_FONT_SIZE,
  DEFAULT_TEXT_WATERMARK,
  MAX_TEXT_FONT_SIZE,
  MIN_TEXT_FONT_SIZE
} from '../src/shared/defaults.js';

test('opens in text watermark mode with DEMO text', () => {
  assert.equal(DEFAULT_SOURCE_MODE, 'text');
  assert.equal(DEFAULT_TEXT_WATERMARK, 'DEMO');
});

test('uses the requested text watermark font size range', () => {
  assert.equal(DEFAULT_TEXT_FONT_SIZE, 160);
  assert.equal(MIN_TEXT_FONT_SIZE, 60);
  assert.equal(MAX_TEXT_FONT_SIZE, 300);
});
