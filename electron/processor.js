import path from 'node:path';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

import ffmpegStaticPath from 'ffmpeg-static';

import { resolvePackagedAssetPath } from './assets.js';
import { buildImageWatermarkFilter, buildTextWatermarkFilter, normalizeWidthRatio } from '../src/shared/watermark.js';
import { isSupportedVideoPath } from '../src/shared/videos.js';

const textFontCandidates = [
  '/System/Library/Fonts/Hiragino Sans GB.ttc',
  '/System/Library/Fonts/STHeiti Medium.ttc',
  '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
  '/System/Library/Fonts/ArialHB.ttc',
  '/Library/Fonts/Arial Unicode.ttf'
];

export function createOutputPath(inputPath, outputDir) {
  const parsed = path.parse(inputPath);
  return path.join(outputDir, `${parsed.name}_watermarked.mp4`);
}

export function buildFfmpegArgs({ inputPath, outputPath, watermark, videoWidth, videoHeight }) {
  const commonArgs = [
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
    outputPath
  ];

  if (watermark.mode === 'text') {
    const textWatermark = withTextVideoSize(withTextFontFile(watermark), videoWidth, videoHeight);
    return [
      '-y',
      '-i',
      inputPath,
      '-filter_complex',
      `[0:v]${buildTextWatermarkFilter(textWatermark)}[v]`,
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
    `${buildImageWatermarkFilter(withImageTargetWidth(watermark, videoWidth))}[v]`,
    ...commonArgs
  ];
}

export function isSupportedVideo(filePath) {
  return isSupportedVideoPath(filePath);
}

export async function processBatch({ videos, outputDir, watermark }, onEvent = () => {}) {
  const ffmpegPath = resolvePackagedAssetPath(ffmpegStaticPath);
  if (!ffmpegPath) {
    throw new Error('ffmpeg 未找到，请重新安装应用依赖。');
  }

  const validVideos = videos.filter((video) => isSupportedVideo(video.path));
  const videoInfos = await Promise.all(validVideos.map((video) => getVideoInfo(video.path).catch(() => emptyVideoInfo())));
  const totalSeconds = videoInfos.reduce((sum, info) => sum + (info.duration || 0), 0);
  const startedAt = Date.now();
  let completedSeconds = 0;
  const results = [];
  const reservedOutputPaths = new Set();

  for (const [index, video] of validVideos.entries()) {
    const outputPath = createUniqueOutputPath(video.path, outputDir, reservedOutputPaths);
    onEvent({ type: 'item-start', id: video.id, outputPath });

    try {
      await runFfmpeg(buildFfmpegArgs({
        inputPath: video.path,
        outputPath,
        watermark,
        videoWidth: videoInfos[index]?.displayWidth,
        videoHeight: videoInfos[index]?.displayHeight
      }), (line) => {
        const itemDuration = videoInfos[index]?.duration || null;
        const progress = parseProgressMetrics(line);
        const currentSeconds = progress.seconds || 0;
        const boundedCurrentSeconds = itemDuration ? Math.min(currentSeconds, itemDuration) : currentSeconds;
        const processedSeconds = completedSeconds + boundedCurrentSeconds;
        const remainingSeconds = estimateRemainingSeconds({
          processedSeconds,
          totalSeconds,
          elapsedSeconds: (Date.now() - startedAt) / 1000,
          speed: progress.speed
        });
        onEvent({
          type: 'item-progress',
          id: video.id,
          line,
          itemProcessedSeconds: boundedCurrentSeconds,
          itemDurationSeconds: itemDuration,
          itemProgressPercent: itemDuration ? Math.min(99, Math.round((boundedCurrentSeconds / itemDuration) * 100)) : null,
          processedSeconds,
          totalSeconds,
          batchProgressPercent: totalSeconds ? Math.min(99, Math.round((processedSeconds / totalSeconds) * 100)) : 0,
          remainingSeconds
        });
      });
      completedSeconds += videoInfos[index]?.duration || 0;
      const batchProgressPercent = totalSeconds ? Math.min(100, Math.round((completedSeconds / totalSeconds) * 100)) : 0;
      const result = { id: video.id, status: 'done', outputPath, batchProgressPercent };
      results.push(result);
      onEvent({ type: 'item-done', ...result });
    } catch (error) {
      completedSeconds += videoInfos[index]?.duration || 0;
      const batchProgressPercent = totalSeconds ? Math.min(100, Math.round((completedSeconds / totalSeconds) * 100)) : 0;
      const result = { id: video.id, status: 'failed', error: error.message, batchProgressPercent };
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

export function parseProgressTime(text) {
  const match = /time=(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(text);
  if (!match) return null;
  const [, hours, minutes, seconds] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

export function parseProgressMetrics(text) {
  const seconds = parseProgressTime(text);
  const speedMatch = /speed=\s*([0-9.]+)x/.exec(text);
  const speed = speedMatch ? Number(speedMatch[1]) : null;

  return {
    seconds,
    speed: Number.isFinite(speed) && speed > 0 ? speed : null
  };
}

export function estimateRemainingSeconds({ processedSeconds, totalSeconds, elapsedSeconds, speed = null }) {
  if (!processedSeconds || !totalSeconds || processedSeconds <= 0 || totalSeconds <= 0) return null;
  const remainingMediaSeconds = Math.max(0, totalSeconds - processedSeconds);
  if (Number.isFinite(speed) && speed > 0.05) {
    return Math.round(remainingMediaSeconds / speed);
  }
  if (!elapsedSeconds || elapsedSeconds < 2 || processedSeconds < 3) return null;
  const secondsPerMediaSecond = elapsedSeconds / processedSeconds;
  return Math.round(remainingMediaSeconds * secondsPerMediaSecond);
}

function pickProgressLine(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.findLast((line) => line.includes('time=') || line.includes('frame=')) || '';
}

function withImageTargetWidth(watermark, videoWidth) {
  const width = Number(videoWidth);
  if (!Number.isFinite(width) || width <= 0) return watermark;
  return {
    ...watermark,
    imageTargetWidthPx: Math.max(1, Math.round(width * normalizeWidthRatio(watermark.imageWidthPercent)))
  };
}

function withTextFontFile(watermark) {
  if (watermark.fontFile) return watermark;
  const fontFile = resolveTextFontFile();
  return fontFile ? { ...watermark, fontFile } : watermark;
}

function withTextVideoSize(watermark, videoWidth, videoHeight) {
  const width = Number(videoWidth);
  const height = Number(videoHeight);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return watermark;
  return {
    ...watermark,
    videoWidth: width,
    videoHeight: height
  };
}

function resolveTextFontFile() {
  return textFontCandidates.find((fontPath) => existsSync(fontPath)) || '';
}

function createUniqueOutputPath(inputPath, outputDir, reservedOutputPaths) {
  const firstPath = createOutputPath(inputPath, outputDir);
  if (!reservedOutputPaths.has(firstPath) && !existsSync(firstPath)) {
    reservedOutputPaths.add(firstPath);
    return firstPath;
  }

  const parsed = path.parse(firstPath);
  for (let index = 2; index < 1000; index += 1) {
    const candidate = path.join(parsed.dir, `${parsed.name}_${index}${parsed.ext}`);
    if (!reservedOutputPaths.has(candidate) && !existsSync(candidate)) {
      reservedOutputPaths.add(candidate);
      return candidate;
    }
  }

  throw new Error('输出文件名冲突，请更换输出目录。');
}

function getVideoInfo(inputPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(resolvePackagedAssetPath(ffmpegStaticPath), [
      '-hide_banner',
      '-i',
      inputPath
    ], {
      stdio: ['ignore', 'ignore', 'pipe']
    });
    let error = '';
    child.stderr.on('data', (chunk) => {
      error += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', () => {
      resolve(parseVideoInfo(error));
    });
  });
}

export function parseVideoInfo(text) {
  const dimensions = parseVideoDimensions(text);
  const rotation = parseRotation(text);

  return {
    duration: parseDuration(text),
    width: dimensions.width,
    height: dimensions.height,
    rotation,
    displayWidth: getDisplayWidth(dimensions, rotation),
    displayHeight: getDisplayHeight(dimensions, rotation)
  };
}

function parseDuration(text) {
  const match = /Duration:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(text);
  if (!match) return null;
  const [, hours, minutes, seconds] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

function parseVideoDimensions(text) {
  const streamLine = text.split(/\r?\n/).find((line) => line.includes('Video:'));
  const match = /,\s*(\d{2,5})x(\d{2,5})(?:[\s,\[])/.exec(streamLine || '');
  if (!match) return { width: null, height: null };
  const width = Number(match[1]);
  const height = Number(match[2]);
  return {
    width: Number.isFinite(width) ? width : null,
    height: Number.isFinite(height) ? height : null
  };
}

function parseRotation(text) {
  const displayMatrixMatch = /rotation of\s*(-?\d+(?:\.\d+)?)\s*degrees/i.exec(text);
  const rotateTagMatch = /^\s*rotate\s*:\s*(-?\d+(?:\.\d+)?)/im.exec(text);
  const rotation = Number(displayMatrixMatch?.[1] ?? rotateTagMatch?.[1] ?? 0);
  return Number.isFinite(rotation) ? Math.round(rotation) : 0;
}

function getDisplayWidth({ width, height }, rotation) {
  if (!Number.isFinite(width)) return null;
  const normalizedRotation = Math.abs(rotation) % 180;
  if (normalizedRotation === 90 && Number.isFinite(height)) return height;
  return width;
}

function emptyVideoInfo() {
  return { duration: null, width: null, height: null, rotation: 0, displayWidth: null, displayHeight: null };
}

function getDisplayHeight({ width, height }, rotation) {
  if (!Number.isFinite(height)) return null;
  const normalizedRotation = Math.abs(rotation) % 180;
  if (normalizedRotation === 90 && Number.isFinite(width)) return width;
  return height;
}
