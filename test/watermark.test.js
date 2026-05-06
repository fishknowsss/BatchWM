import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildImageWatermarkFilter,
  buildTextWatermarkFilter,
  getOverlayExpression,
  normalizeOpacity
} from '../src/shared/watermark.js';

test('maps all nine placement options to ffmpeg overlay expressions', () => {
  assert.equal(getOverlayExpression('center'), '(W-w)/2:(H-h)/2');
  assert.equal(getOverlayExpression('top-left'), '24:24');
  assert.equal(getOverlayExpression('top'), '(W-w)/2:24');
  assert.equal(getOverlayExpression('top-right'), 'W-w-24:24');
  assert.equal(getOverlayExpression('right'), 'W-w-24:(H-h)/2');
  assert.equal(getOverlayExpression('bottom-right'), 'W-w-24:H-h-24');
  assert.equal(getOverlayExpression('bottom'), '(W-w)/2:H-h-24');
  assert.equal(getOverlayExpression('bottom-left'), '24:H-h-24');
  assert.equal(getOverlayExpression('left'), '24:(H-h)/2');
});

test('clamps opacity to a stable 0-1 range', () => {
  assert.equal(normalizeOpacity(-0.4), 0);
  assert.equal(normalizeOpacity(0.42), 0.42);
  assert.equal(normalizeOpacity(2), 1);
  assert.equal(normalizeOpacity(Number.NaN), 1);
});

test('builds image watermark filter with alpha and scaling', () => {
  const filter = buildImageWatermarkFilter({
    placement: 'bottom-right',
    opacity: 0.35,
    imageTargetWidthPx: 154
  });

  assert.equal(
    filter,
    '[1:v]format=rgba,colorchannelmixer=aa=0.35,scale=154:-1[wm];[0:v][wm]overlay=W-w-24:H-h-24:format=auto'
  );
});

test('builds text watermark filter with escaped text and alpha color', () => {
  const filter = buildTextWatermarkFilter({
    text: "由十力's 水印",
    placement: 'center',
    opacity: 0.5,
    fontSize: 42
  });

  assert.equal(
    filter,
    "drawtext=text='由十力\\'s 水印':fontsize=42:fontcolor=white@0.5:box=0:x=(w-text_w)/2:y=(h-text_h)/2"
  );
});
