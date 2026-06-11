import test from 'node:test';
import assert from 'node:assert/strict';

import { createVideoItemsFromPaths, isSupportedVideoPath, mergeVideos } from '../src/shared/videos.js';

test('filters dropped paths to supported video items', () => {
  assert.deepEqual(
    createVideoItemsFromPaths(['/tmp/a.mp4', '/tmp/b.txt', '/tmp/c.MOV'], 100),
    [
      { id: '/tmp/a.mp4-100-0', path: '/tmp/a.mp4', name: 'a.mp4', status: 'ready' },
      { id: '/tmp/c.MOV-100-2', path: '/tmp/c.MOV', name: 'c.MOV', status: 'ready' }
    ]
  );
});

test('detects supported video paths case-insensitively', () => {
  assert.equal(isSupportedVideoPath('/tmp/demo.WEBM'), true);
  assert.equal(isSupportedVideoPath('/tmp/demo.png'), false);
});

test('merges video items without duplicating paths', () => {
  const current = [{ id: 'a', path: '/tmp/a.mp4', name: 'a.mp4', status: 'done' }];
  const selected = [
    { id: 'a-new', path: '/tmp/a.mp4', name: 'a.mp4', status: 'ready' },
    { id: 'b', path: '/tmp/b.mp4', name: 'b.mp4', status: 'ready' }
  ];

  assert.deepEqual(mergeVideos(current, selected), [
    { id: 'a', path: '/tmp/a.mp4', name: 'a.mp4', status: 'done' },
    { id: 'b', path: '/tmp/b.mp4', name: 'b.mp4', status: 'ready' }
  ]);
});
