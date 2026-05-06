import path from 'node:path';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

import ffmpegStaticPath from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';

import { resolvePackagedAssetPath } from './assets.js';
import { buildImageWatermarkFilter, buildTextWatermarkFilter, normalizeWidthRatio } from '../src/shared/watermark.js';

const supportedExtensions = new Set(['.mp4', '.mov', '.m4v', '.avi', '.mkv', '.webm']);

export function createOutputPath(inputPath, outputDir) {
  const parsed = path.parse(inputPath);
  return path.join(outputDir, `${parsed.name}_watermarked.mp4`);
}

export function buildFfmpegArgs({ inputPath, outputPath, watermark, videoWidth }) {
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
    `${buildImageWatermarkFilter(withImageTargetWidth(watermark, videoWidth))}[v]`,
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
  const videoInfos = await Promise.all(validVideos.map((video) => getVideoInfo(video.path).catch(() => ({ duration: null, width: null }))));
  const totalSeconds = videoInfos.reduce((sum, info) => sum + (info.duration || 0), 0);
  const startedAt = Date.now();
  let completedSeconds = 0;
  const results = [];
  const reservedOutputPaths = new Set();

  for (const [index, video] of validVideos.entries()) {
    const outputPath = createUniqueOutputPath(video.path, outputDir, reservedOutputPaths);
    onEvent({ type: 'item-start', id: video.id, outputPath });

    try {
      await runFfmpeg(buildFfmpegArgs({ inputPath: video.path, outputPath, watermark, videoWidth: videoInfos[index]?.width }), (line) => {
        const currentSeconds = parseProgressTime(line);
        const processedSeconds = completedSeconds + (currentSeconds || 0);
        const remainingSeconds = estimateRemainingSeconds({
          processedSeconds,
          totalSeconds,
          elapsedSeconds: (Date.now() - startedAt) / 1000
        });
        onEvent({
          type: 'item-progress',
          id: video.id,
          line,
          processedSeconds,
          totalSeconds,
          remainingSeconds
        });
      });
      completedSeconds += videoInfos[index]?.duration || 0;
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

export function parseProgressTime(text) {
  const match = /time=(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(text);
  if (!match) return null;
  const [, hours, minutes, seconds] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

export function estimateRemainingSeconds({ processedSeconds, totalSeconds, elapsedSeconds }) {
  if (!processedSeconds || !totalSeconds || !elapsedSeconds || processedSeconds <= 0 || totalSeconds <= 0) return null;
  const remainingMediaSeconds = Math.max(0, totalSeconds - processedSeconds);
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
    const ffprobePath = resolvePackagedAssetPath(ffprobeStatic.path);
    const child = spawn(ffprobePath, [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width',
      '-show_entries',
      'format=duration',
      '-of',
      'json',
      inputPath
    ], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let output = '';
    let error = '';
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      error += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(error || `ffprobe 退出码 ${code}`));
        return;
      }
      try {
        const info = JSON.parse(output);
        const duration = Number(info?.format?.duration);
        const width = Number(info?.streams?.[0]?.width);
        resolve({
          duration: Number.isFinite(duration) ? duration : null,
          width: Number.isFinite(width) ? width : null
        });
      } catch (error) {
        reject(error);
      }
    });
  });
}
