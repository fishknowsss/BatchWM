import path from 'node:path';
import { spawn } from 'node:child_process';

import ffmpegStaticPath from 'ffmpeg-static';

import { resolvePackagedAssetPath } from './assets.js';
import { buildImageWatermarkFilter, buildTextWatermarkFilter } from '../src/shared/watermark.js';

const supportedExtensions = new Set(['.mp4', '.mov', '.m4v', '.avi', '.mkv', '.webm']);

export function createOutputPath(inputPath, outputDir) {
  const parsed = path.parse(inputPath);
  return path.join(outputDir, `${parsed.name}_watermarked.mp4`);
}

export function buildFfmpegArgs({ inputPath, outputPath, watermark }) {
  const commonArgs = ['-map', '[v]', '-map', '0:a?', '-c:a', 'copy', '-movflags', '+faststart', outputPath];

  if (watermark.mode === 'text') {
    return [
      '-y',
      '-i',
      inputPath,
      '-filter_complex',
      `[0:v]${buildTextWatermarkFilter(watermark)}[v]`,
      ...commonArgs
    ];
  }

  return [
    '-y',
    '-i',
    inputPath,
    '-i',
    watermark.imagePath,
    '-filter_complex',
    `${buildImageWatermarkFilter(watermark)}[v]`,
    ...commonArgs
  ];
}

export function isSupportedVideo(filePath) {
  return supportedExtensions.has(path.extname(filePath).toLowerCase());
}

export async function processBatch({ videos, outputDir, watermark }, onEvent = () => {}) {
  const ffmpegPath = resolvePackagedAssetPath(ffmpegStaticPath);
  if (!ffmpegPath) {
    throw new Error('ffmpeg 未找到，请重新安装应用依赖。');
  }

  const validVideos = videos.filter((video) => isSupportedVideo(video.path));
  const results = [];

  for (const video of validVideos) {
    const outputPath = createOutputPath(video.path, outputDir);
    onEvent({ type: 'item-start', id: video.id, outputPath });

    try {
      await runFfmpeg(buildFfmpegArgs({ inputPath: video.path, outputPath, watermark }), (line) => {
        onEvent({ type: 'item-log', id: video.id, line });
      });
      const result = { id: video.id, status: 'done', outputPath };
      results.push(result);
      onEvent({ type: 'item-done', ...result });
    } catch (error) {
      const result = { id: video.id, status: 'failed', error: error.message };
      results.push(result);
      onEvent({ type: 'item-failed', ...result });
    }
  }

  return results;
}

function runFfmpeg(args, onLog) {
  return new Promise((resolve, reject) => {
    const child = spawn(resolvePackagedAssetPath(ffmpegStaticPath), args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let lastError = '';

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      lastError = text.trim() || lastError;
      const progressLine = pickProgressLine(text);
      if (progressLine) onLog(progressLine);
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(lastError || `ffmpeg 退出码 ${code}`));
    });
  });
}

function pickProgressLine(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.findLast((line) => line.includes('time=') || line.includes('frame=')) || '';
}
