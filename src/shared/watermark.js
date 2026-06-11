import { DEFAULT_TEXT_FONT_SIZE, MAX_TEXT_FONT_SIZE, MIN_TEXT_FONT_SIZE } from './defaults.js';

const DEFAULT_MARGIN = 24;
const PREVIEW_MARGIN = 18;
const PREVIEW_REFERENCE_HEIGHTS = {
  landscape: 1080,
  portrait: 1920
};

export const watermarkBlendModes = [
  { id: 'normal', label: '标准', cssBlendMode: 'normal', cssFilter: 'none' },
  { id: 'soft', label: '柔和', cssBlendMode: 'soft-light', cssFilter: 'saturate(0.88) brightness(1.04)' },
  { id: 'bright', label: '提亮', cssBlendMode: 'screen', cssFilter: 'brightness(1.08) contrast(1.04)' },
  { id: 'dark', label: '深色', cssBlendMode: 'multiply', cssFilter: 'brightness(0.42) contrast(1.08)' },
  { id: 'stamp', label: '印记', cssBlendMode: 'overlay', cssFilter: 'contrast(1.16) saturate(0.72)' }
];

const imageBlendFilters = {
  normal: '',
  soft: 'eq=saturation=0.75:brightness=0.03,gblur=sigma=0.35,',
  bright: 'eq=contrast=1.08:brightness=0.08:saturation=0.82,',
  dark: 'lutrgb=r=val*0.18:g=val*0.18:b=val*0.18,',
  stamp: 'unsharp=5:5:0.8:3:3:0.4,'
};

const textBlendOptions = {
  normal: '',
  soft: ':shadowcolor=black@0.18:shadowx=1:shadowy=1',
  bright: ':borderw=1:bordercolor=white@0.18',
  dark: '',
  stamp: ':borderw=1:bordercolor=black@0.28'
};

const overlayExpressions = {
  center: '(W-w)/2:(H-h)/2',
  'top-left': `${DEFAULT_MARGIN}:${DEFAULT_MARGIN}`,
  top: `(W-w)/2:${DEFAULT_MARGIN}`,
  'top-right': `W-w-${DEFAULT_MARGIN}:${DEFAULT_MARGIN}`,
  right: `W-w-${DEFAULT_MARGIN}:(H-h)/2`,
  'bottom-right': `W-w-${DEFAULT_MARGIN}:H-h-${DEFAULT_MARGIN}`,
  bottom: `(W-w)/2:H-h-${DEFAULT_MARGIN}`,
  'bottom-left': `${DEFAULT_MARGIN}:H-h-${DEFAULT_MARGIN}`,
  left: `${DEFAULT_MARGIN}:(H-h)/2`
};

const drawTextExpressions = {
  center: '(w-text_w)/2:(h-text_h)/2',
  'top-left': `${DEFAULT_MARGIN}:${DEFAULT_MARGIN}`,
  top: `(w-text_w)/2:${DEFAULT_MARGIN}`,
  'top-right': `w-text_w-${DEFAULT_MARGIN}:${DEFAULT_MARGIN}`,
  right: `w-text_w-${DEFAULT_MARGIN}:(h-text_h)/2`,
  'bottom-right': `w-text_w-${DEFAULT_MARGIN}:h-text_h-${DEFAULT_MARGIN}`,
  bottom: `(w-text_w)/2:h-text_h-${DEFAULT_MARGIN}`,
  'bottom-left': `${DEFAULT_MARGIN}:h-text_h-${DEFAULT_MARGIN}`,
  left: `${DEFAULT_MARGIN}:(h-text_h)/2`
};

export const placements = [
  'top-left',
  'top',
  'top-right',
  'left',
  'center',
  'right',
  'bottom-left',
  'bottom',
  'bottom-right'
];

export function normalizeOpacity(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 1;
  return Math.min(1, Math.max(0, Number(numericValue.toFixed(2))));
}

export function normalizeBlendMode(value) {
  return watermarkBlendModes.some((mode) => mode.id === value) ? value : 'normal';
}

export function getOverlayExpression(placement) {
  return overlayExpressions[placement] || overlayExpressions.center;
}

export function getDrawTextExpression(placement) {
  return drawTextExpressions[placement] || drawTextExpressions.center;
}

export function buildImageWatermarkFilter({
  placement = 'center',
  opacity = 1,
  imageWidthPercent = 18,
  imageTargetWidthPx,
  blendMode = 'normal'
} = {}) {
  const alpha = normalizeOpacity(opacity);
  const widthRatio = normalizeWidthRatio(imageWidthPercent);
  const targetWidth = clampInteger(imageTargetWidthPx, 1, 20000, 0);
  const position = getOverlayExpression(placement);
  const imageFilter = buildImageBlendFilter(blendMode, alpha);

  if (targetWidth > 0) {
    return `[1:v]scale=${targetWidth}:-1,${imageFilter}[wm];[0:v][wm]overlay=${position}:format=auto`;
  }

  return `[1:v][0:v]scale2ref=w=main_w*${widthRatio}:h=ow/mdar[wmraw][base];[wmraw]${imageFilter}[wm];[base][wm]overlay=${position}:format=auto`;
}

export function buildTextWatermarkFilter({
  text,
  placement = 'center',
  opacity = 1,
  fontSize = DEFAULT_TEXT_FONT_SIZE,
  fontFile = '',
  blendMode = 'normal',
  videoWidth,
  videoHeight
} = {}) {
  const safeText = escapeDrawText(text || '水印');
  const alpha = normalizeOpacity(opacity);
  const size = normalizeTextOutputFontSize({ fontSize, videoWidth, videoHeight });
  const [x, y] = getDrawTextExpression(placement).split(':');
  const fontOption = fontFile ? `fontfile='${escapeQuotedOption(fontFile)}':` : '';
  const normalizedBlendMode = normalizeBlendMode(blendMode);
  const fontColor = normalizedBlendMode === 'dark' ? `black@${alpha}` : `white@${alpha}`;
  const blendOptions = textBlendOptions[normalizedBlendMode] || '';

  return `drawtext=${fontOption}text='${safeText}':fontsize=${size}:fontcolor=${fontColor}${blendOptions}:box=0:x=${x}:y=${y}`;
}

export function normalizeWidthRatio(percent) {
  const value = normalizeWidthPercent(percent);
  return Number((value / 100).toFixed(2));
}

export function normalizeWidthPercent(percent) {
  return clampInteger(percent, 5, 80, 18);
}

export function normalizeTextFontSize(fontSize) {
  return clampInteger(fontSize, MIN_TEXT_FONT_SIZE, MAX_TEXT_FONT_SIZE, DEFAULT_TEXT_FONT_SIZE);
}

export function normalizeTextOutputFontSize({ fontSize, videoWidth, videoHeight } = {}) {
  const size = normalizeTextFontSize(fontSize);
  const width = Number(videoWidth);
  const height = Number(videoHeight);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return size;
  }

  const referenceHeight = height >= width ? PREVIEW_REFERENCE_HEIGHTS.portrait : PREVIEW_REFERENCE_HEIGHTS.landscape;
  return Math.max(1, Math.round(size * (height / referenceHeight)));
}

export function buildPreviewWatermarkStyle({
  sourceMode = 'image',
  placement = 'center',
  opacity = 1,
  imageWidthPercent = 18,
  fontSize = DEFAULT_TEXT_FONT_SIZE,
  previewMode = 'landscape',
  blendMode = 'normal'
} = {}) {
  const normalizedBlendMode = normalizeBlendMode(blendMode);
  const blend = watermarkBlendModes.find((mode) => mode.id === normalizedBlendMode) || watermarkBlendModes[0];
  const previewFontSize = buildPreviewFontSize({ sourceMode, fontSize, previewMode });

  return {
    ...placementToPreviewCss(placement),
    opacity: normalizeOpacity(opacity),
    width: sourceMode === 'text' ? 'auto' : `${normalizeWidthPercent(imageWidthPercent)}%`,
    fontSize: previewFontSize,
    color: normalizedBlendMode === 'dark' ? '#211b16' : '#fffaf4',
    mixBlendMode: blend.cssBlendMode,
    filter: blend.cssFilter
  };
}

export function escapeDrawText(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/:/g, '\\:')
    .replace(/\n/g, ' ');
}

function escapeQuotedOption(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");
}

function clampInteger(value, min, max, fallback) {
  if (!Number.isFinite(Number(value))) return fallback;
  return Math.min(max, Math.max(min, Math.round(Number(value))));
}

function buildImageBlendFilter(blendMode, alpha) {
  const normalizedBlendMode = normalizeBlendMode(blendMode);
  const effect = imageBlendFilters[normalizedBlendMode] || '';
  return `format=rgba,${effect}colorchannelmixer=aa=${alpha}`;
}

function buildPreviewFontSize({ sourceMode, fontSize, previewMode }) {
  const size = sourceMode === 'text' ? normalizeTextFontSize(fontSize) : clampInteger(fontSize, 12, 160, 42);
  if (sourceMode !== 'text') {
    return `${Number(Math.max(16, Math.min(48, size * 0.68)).toFixed(2))}px`;
  }

  const referenceHeight = PREVIEW_REFERENCE_HEIGHTS[previewMode] || PREVIEW_REFERENCE_HEIGHTS.landscape;
  return `${Number(((size / referenceHeight) * 100).toFixed(2))}cqh`;
}

function placementToPreviewCss(placement) {
  const edge = `${PREVIEW_MARGIN}px`;
  const centerX = { left: '50%', transform: 'translateX(-50%)' };
  const centerY = { top: '50%', transform: 'translateY(-50%)' };

  const map = {
    center: { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' },
    'top-left': { left: edge, top: edge },
    top: { ...centerX, top: edge },
    'top-right': { right: edge, top: edge },
    right: { ...centerY, right: edge },
    'bottom-right': { right: edge, bottom: edge },
    bottom: { ...centerX, bottom: edge },
    'bottom-left': { left: edge, bottom: edge },
    left: { ...centerY, left: edge }
  };

  return map[placement] || map.center;
}
