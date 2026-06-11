import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import {
  buildFfmpegArgs,
  createOutputPath,
  estimateRemainingSeconds,
  parseProgressMetrics,
  parseProgressTime,
  parseVideoInfo
} from '../electron/processor.js';

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
    '[1:v]scale=115:-1,format=rgba,colorchannelmixer=aa=0.72[wm];[0:v][wm]overlay=(W-w)/2:24:format=auto[v]',
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

test('parses ffmpeg progress speed for batch estimates', () => {
  assert.deepEqual(
    parseProgressMetrics('frame=18 fps=0.0 q=28.0 time=00:01:02.50 bitrate=1000kbits/s speed=1.25x'),
    { seconds: 62.5, speed: 1.25 }
  );
  assert.deepEqual(parseProgressMetrics('frame=1 fps=0.0 speed=N/A'), { seconds: null, speed: null });
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

test('uses ffmpeg speed for whole batch remaining time when available', () => {
  assert.equal(
    estimateRemainingSeconds({
      processedSeconds: 10,
      totalSeconds: 70,
      elapsedSeconds: 1000,
      speed: 2
    }),
    30
  );
});

test('parses video duration and width from ffmpeg input output', () => {
  const info = parseVideoInfo(`
Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'demo.mp4':
  Duration: 00:02:03.45, start: 0.000000, bitrate: 1800 kb/s
  Stream #0:0[0x1]: Video: h264 (High), yuv420p(progressive), 1280x720, 24 fps, 24 tbr
  `);

  assert.deepEqual(info, { duration: 123.45, width: 1280, height: 720, rotation: 0, displayWidth: 1280, displayHeight: 720 });
});

test('uses display width for rotated portrait videos', () => {
  const info = parseVideoInfo(`
Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'iphone.mp4':
  Duration: 00:00:10.00, start: 0.000000, bitrate: 2500 kb/s
  Stream #0:0[0x1](und): Video: h264 (High), yuv420p(progressive), 1920x1080, 30 fps, 30 tbr (default)
    Side data:
      displaymatrix: rotation of -90.00 degrees
  `);

  assert.deepEqual(info, { duration: 10, width: 1920, height: 1080, rotation: -90, displayWidth: 1080, displayHeight: 1920 });
});

test('builds image watermark args from rotated display width', () => {
  const args = buildFfmpegArgs({
    inputPath: '/tmp/in.mp4',
    outputPath: '/tmp/out.mp4',
    videoWidth: 1080,
    watermark: {
      mode: 'image',
      imagePath: '/tmp/logo.png',
      placement: 'center',
      opacity: 0.5,
      imageWidthPercent: 18,
      blendMode: 'soft'
    }
  });

  assert.equal(
    args[6],
    '[1:v]scale=194:-1,format=rgba,eq=saturation=0.75:brightness=0.03,gblur=sigma=0.35,colorchannelmixer=aa=0.5[wm];[0:v][wm]overlay=(W-w)/2:(H-h)/2:format=auto[v]'
  );
});

test('builds ffmpeg args for a text watermark', () => {
  const args = buildFfmpegArgs({
    inputPath: '/tmp/in.mov',
    outputPath: '/tmp/out.mp4',
    videoWidth: 720,
    videoHeight: 1280,
    watermark: {
      mode: 'text',
      text: '测试水印',
      placement: 'left',
      opacity: 0.6,
      fontSize: 160
    }
  });

  assert.deepEqual(args, [
    '-y',
    '-i',
    '/tmp/in.mov',
    '-filter_complex',
    "[0:v]drawtext=fontfile='/System/Library/Fonts/Hiragino Sans GB.ttc':text='测试水印':fontsize=107:fontcolor=white@0.6:box=0:x=24:y=(h-text_h)/2[v]",
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
