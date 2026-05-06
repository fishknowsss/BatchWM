const DEFAULT_MARGIN = 24;

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
  if (!Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0, Number(value.toFixed(2))));
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
  imageTargetWidthPx
} = {}) {
  const alpha = normalizeOpacity(opacity);
  const widthRatio = normalizeWidthRatio(imageWidthPercent);
  const targetWidth = clampInteger(imageTargetWidthPx, 1, 20000, 0);
  const position = getOverlayExpression(placement);

  if (targetWidth > 0) {
    return `[1:v]format=rgba,colorchannelmixer=aa=${alpha},scale=${targetWidth}:-1[wm];[0:v][wm]overlay=${position}:format=auto`;
  }

  return `[1:v]format=rgba,colorchannelmixer=aa=${alpha},scale=iw*${widthRatio}:-1[wm];[0:v][wm]overlay=${position}:format=auto`;
}

export function buildTextWatermarkFilter({
  text,
  placement = 'center',
  opacity = 1,
  fontSize = 42
} = {}) {
  const safeText = escapeDrawText(text || '水印');
  const alpha = normalizeOpacity(opacity);
  const size = clampInteger(fontSize, 12, 160, 42);
  const [x, y] = getDrawTextExpression(placement).split(':');

  return `drawtext=text='${safeText}':fontsize=${size}:fontcolor=white@${alpha}:box=0:x=${x}:y=${y}`;
}

export function normalizeWidthRatio(percent) {
  const value = clampInteger(percent, 5, 80, 18);
  return Number((value / 100).toFixed(2));
}

export function escapeDrawText(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/:/g, '\\:')
    .replace(/\n/g, ' ');
}

function clampInteger(value, min, max, fallback) {
  if (!Number.isFinite(Number(value))) return fallback;
  return Math.min(max, Math.max(min, Math.round(Number(value))));
}
