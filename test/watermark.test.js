import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildImageWatermarkFilter,
  buildPreviewWatermarkStyle,
  buildTextWatermarkFilter,
  getOverlayExpression,
  normalizeBlendMode,
  normalizeOpacity,
  watermarkBlendModes
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
  assert.equal(normalizeOpacity('0.42'), 0.42);
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
    '[1:v]scale=154:-1,format=rgba,colorchannelmixer=aa=0.35[wm];[0:v][wm]overlay=W-w-24:H-h-24:format=auto'
  );
});

test('falls back to scaling image watermarks from the main video width', () => {
  const filter = buildImageWatermarkFilter({
    placement: 'center',
    opacity: 0.55,
    imageWidthPercent: 18
  });

  assert.equal(
    filter,
    '[1:v][0:v]scale2ref=w=main_w*0.18:h=ow/mdar[wmraw][base];[wmraw]format=rgba,colorchannelmixer=aa=0.55[wm];[base][wm]overlay=(W-w)/2:(H-h)/2:format=auto'
  );
});

test('applies image watermark blend effects before overlaying', () => {
  const filter = buildImageWatermarkFilter({
    placement: 'top-left',
    opacity: 0.4,
    imageTargetWidthPx: 320,
    blendMode: 'dark'
  });

  assert.equal(
    filter,
    '[1:v]scale=320:-1,format=rgba,lutrgb=r=val*0.18:g=val*0.18:b=val*0.18,colorchannelmixer=aa=0.4[wm];[0:v][wm]overlay=24:24:format=auto'
  );
});

test('builds text watermark filter with escaped text and alpha color', () => {
  const filter = buildTextWatermarkFilter({
    text: "由十力's 水印",
    placement: 'center',
    opacity: 0.5,
    fontSize: 160
  });

  assert.equal(
    filter,
    "drawtext=text='由十力\\'s 水印':fontsize=160:fontcolor=white@0.5:box=0:x=(w-text_w)/2:y=(h-text_h)/2"
  );
});

test('scales text watermark font size from the output display height', () => {
  assert.equal(
    buildTextWatermarkFilter({ text: '同规格', fontSize: 160, videoWidth: 720, videoHeight: 1280 }),
    "drawtext=text='同规格':fontsize=107:fontcolor=white@1:box=0:x=(w-text_w)/2:y=(h-text_h)/2"
  );
  assert.equal(
    buildTextWatermarkFilter({ text: '同规格', fontSize: 160, videoWidth: 2160, videoHeight: 3840 }),
    "drawtext=text='同规格':fontsize=320:fontcolor=white@1:box=0:x=(w-text_w)/2:y=(h-text_h)/2"
  );
});

test('builds text watermark filter with an explicit font file', () => {
  const filter = buildTextWatermarkFilter({
    text: 'Abc 中文',
    placement: 'bottom',
    opacity: 0.8,
    fontSize: 80,
    fontFile: '/System/Library/Fonts/PingFang.ttc'
  });

  assert.equal(
    filter,
    "drawtext=fontfile='/System/Library/Fonts/PingFang.ttc':text='Abc 中文':fontsize=80:fontcolor=white@0.8:box=0:x=(w-text_w)/2:y=h-text_h-24"
  );
});

test('builds text watermark filter with a stamp blend effect', () => {
  const filter = buildTextWatermarkFilter({
    text: '印记',
    placement: 'center',
    opacity: 0.65,
    fontSize: 60,
    blendMode: 'stamp'
  });

  assert.equal(
    filter,
    "drawtext=text='印记':fontsize=60:fontcolor=white@0.65:borderw=1:bordercolor=black@0.28:box=0:x=(w-text_w)/2:y=(h-text_h)/2"
  );
});

test('clamps text watermark font size to the configured range', () => {
  assert.equal(
    buildTextWatermarkFilter({ text: '小', fontSize: 12 }),
    "drawtext=text='小':fontsize=60:fontcolor=white@1:box=0:x=(w-text_w)/2:y=(h-text_h)/2"
  );
  assert.equal(
    buildTextWatermarkFilter({ text: '大', fontSize: 420 }),
    "drawtext=text='大':fontsize=300:fontcolor=white@1:box=0:x=(w-text_w)/2:y=(h-text_h)/2"
  );
});

test('normalizes supported watermark blend modes', () => {
  assert.deepEqual(
    watermarkBlendModes.map((mode) => mode.id),
    ['normal', 'soft', 'bright', 'dark', 'stamp']
  );
  assert.equal(normalizeBlendMode('bright'), 'bright');
  assert.equal(normalizeBlendMode('missing'), 'normal');
});

test('builds preview watermark style with normalized size and blend mode', () => {
  assert.deepEqual(
    buildPreviewWatermarkStyle({
      sourceMode: 'image',
      placement: 'bottom-right',
      opacity: 0.6,
      imageWidthPercent: 120,
      fontSize: 42,
      blendMode: 'bright'
    }),
    {
      right: '18px',
      bottom: '18px',
      opacity: 0.6,
      width: '80%',
      fontSize: '28.56px',
      color: '#fffaf4',
      mixBlendMode: 'screen',
      filter: 'brightness(1.08) contrast(1.04)'
    }
  );
});

test('scales text preview size from the preview frame height', () => {
  assert.deepEqual(
    buildPreviewWatermarkStyle({
      sourceMode: 'text',
      placement: 'center',
      opacity: 0.55,
      fontSize: 160,
      previewMode: 'landscape'
    }),
    {
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      opacity: 0.55,
      width: 'auto',
      fontSize: '14.81cqh',
      color: '#fffaf4',
      mixBlendMode: 'normal',
      filter: 'none'
    }
  );
});

test('uses portrait video height as text preview reference', () => {
  const style = buildPreviewWatermarkStyle({
    sourceMode: 'text',
    placement: 'center',
    fontSize: 160,
    previewMode: 'portrait'
  });

  assert.equal(style.fontSize, '8.33cqh');
});
