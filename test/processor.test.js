import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { buildFfmpegArgs, createOutputPath, estimateRemainingSeconds, parseProgressTime } from '../electron/processor.js';

test('creates a stable output path without overwriting the source', () => {
  const output = createOutputPath('/Users/me/Desktop/source/demo.mp4', '/Users/me/Desktop/out');
  assert.equal(output, path.join('/Users/me/Desktop/out', 'demo_watermarked.mp4'));
});

test('builds ffmpeg args for an image watermark', () => {
  const args = buildFfmpegArgs({
    inputPath: '/tmp/in.mp4',
    outputPath: '/tmp/out.mp4',
    videoWidth: 640,
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
    '[1:v]format=rgba,colorchannelmixer=aa=0.72,scale=115:-1[wm];[0:v][wm]overlay=(W-w)/2:24:format=auto[v]',
    '-map',
    '[v]',
    '-map',
    '0:a?',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '20',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-movflags',
    '+faststart',
    '/tmp/out.mp4'
  ]);
});

test('parses ffmpeg progress time into seconds', () => {
  assert.equal(parseProgressTime('frame=18 fps=0.0 q=28.0 time=00:01:02.50 bitrate=1000kbits/s'), 62.5);
  assert.equal(parseProgressTime('frame=1 fps=0.0'), null);
});

test('estimates remaining time from processed media time and elapsed wall time', () => {
  assert.equal(
    estimateRemainingSeconds({
      processedSeconds: 20,
      totalSeconds: 100,
      elapsedSeconds: 10
    }),
    40
  );
  assert.equal(estimateRemainingSeconds({ processedSeconds: 0, totalSeconds: 100, elapsedSeconds: 10 }), null);
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
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '20',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-movflags',
    '+faststart',
    '/tmp/out.mp4'
  ]);
});
