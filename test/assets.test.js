import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { getDefaultWatermarkPath, resolvePackagedAssetPath } from '../electron/assets.js';

test('uses project root asset path during development', () => {
  const result = getDefaultWatermarkPath({
    isPackaged: false,
    projectRoot: '/project',
    resourcesPath: '/Applications/BatchWM.app/Contents/Resources'
  });

  assert.equal(result, path.join('/project', '由十力水印.png'));
});

test('uses extraResources asset path when packaged', () => {
  const result = getDefaultWatermarkPath({
    isPackaged: true,
    projectRoot: '/Applications/BatchWM.app/Contents/Resources/app.asar',
    resourcesPath: '/Applications/BatchWM.app/Contents/Resources'
  });

  assert.equal(result, path.join('/Applications/BatchWM.app/Contents/Resources', 'assets', '由十力水印.png'));
});

test('rewrites executable paths from app.asar to app.asar.unpacked', () => {
  assert.equal(
    resolvePackagedAssetPath('/Applications/BatchWM.app/Contents/Resources/app.asar/node_modules/ffmpeg-static/ffmpeg'),
    '/Applications/BatchWM.app/Contents/Resources/app.asar.unpacked/node_modules/ffmpeg-static/ffmpeg'
  );
});
