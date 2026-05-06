import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { buildFfmpegArgs, createOutputPath } from '../electron/processor.js';

test('creates a stable output path without overwriting the source', () => {
  const output = createOutputPath('/Users/me/Desktop/source/demo.mp4', '/Users/me/Desktop/out');
  assert.equal(output, path.join('/Users/me/Desktop/out', 'demo_watermarked.mp4'));
});

test('builds ffmpeg args for an image watermark', () => {
  const args = buildFfmpegArgs({
    inputPath: '/tmp/in.mp4',
    outputPath: '/tmp/out.mp4',
    watermark: {
      mode: 'image',
      imagePath: '/tmp/logo.png',
      placement: 'top',
      opacity: 0.72,
      imageWidthPercent: 18
    }
  });

  assert.deepEqual(args, [
    '-y',
    '-i',
    '/tmp/in.mp4',
    '-i',
    '/tmp/logo.png',
    '-filter_complex',
    '[1:v]format=rgba,colorchannelmixer=aa=0.72[wmraw];[wmraw][0:v]scale2ref=w=main_w*0.18:h=ow/mdar[wm][base];[base][wm]overlay=(W-w)/2:24:format=auto[v]',
    '-map',
    '[v]',
    '-map',
    '0:a?',
    '-c:a',
    'copy',
    '-movflags',
    '+faststart',
    '/tmp/out.mp4'
  ]);
});

test('builds ffmpeg args for a text watermark', () => {
  const args = buildFfmpegArgs({
    inputPath: '/tmp/in.mov',
    outputPath: '/tmp/out.mp4',
    watermark: {
      mode: 'text',
      text: '测试水印',
      placement: 'left',
      opacity: 0.6,
      fontSize: 36
    }
  });

  assert.deepEqual(args, [
    '-y',
    '-i',
    '/tmp/in.mov',
    '-filter_complex',
    "[0:v]drawtext=text='测试水印':fontsize=36:fontcolor=white@0.6:box=0:x=24:y=(h-text_h)/2[v]",
    '-map',
    '[v]',
    '-map',
    '0:a?',
    '-c:a',
    'copy',
    '-movflags',
    '+faststart',
    '/tmp/out.mp4'
  ]);
});
