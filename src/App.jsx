import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  FileVideo,
  FolderOpen,
  ImagePlus,
  Loader2,
  Play,
  RotateCcw,
  Upload
} from 'lucide-react';

import { buildPreviewWatermarkStyle, placements, watermarkBlendModes } from './shared/watermark.js';
import { formatAppVersion } from './shared/version.js';
import {
  DEFAULT_SOURCE_MODE,
  DEFAULT_TEXT_FONT_SIZE,
  DEFAULT_TEXT_WATERMARK,
  MAX_TEXT_FONT_SIZE,
  MIN_TEXT_FONT_SIZE
} from './shared/defaults.js';
import { readLastOutputDir, rememberLastOutputDir } from './shared/preferences.js';
import { createVideoItemsFromPaths, getFileNameFromPath, mergeVideos } from './shared/videos.js';
import packageInfo from '../package.json';

const placementLabels = {
  'top-left': '左上',
  top: '上中',
  'top-right': '右上',
  left: '左中',
  center: '中间',
  right: '右中',
  'bottom-left': '左下',
  bottom: '下中',
  'bottom-right': '右下'
};

const sourceTabs = [
  { id: 'text', label: '文字' },
  { id: 'default', label: '内置' },
  { id: 'upload', label: '图片' }
];

const bridge = window.batchWM;
const appVersionLabel = formatAppVersion(packageInfo.version);

export function App() {
  const [videos, setVideos] = useState([]);
  const [defaultWatermark, setDefaultWatermark] = useState(null);
  const [uploadedWatermark, setUploadedWatermark] = useState(null);
  const [outputDir, setOutputDir] = useState(() => readLastOutputDir());
  const [sourceMode, setSourceMode] = useState(DEFAULT_SOURCE_MODE);
  const [placement, setPlacement] = useState('center');
  const [previewMode, setPreviewMode] = useState('landscape');
  const [opacity, setOpacity] = useState(0.55);
  const [imageWidthPercent, setImageWidthPercent] = useState(18);
  const [blendMode, setBlendMode] = useState('normal');
  const [text, setText] = useState(DEFAULT_TEXT_WATERMARK);
  const [fontSize, setFontSize] = useState(DEFAULT_TEXT_FONT_SIZE);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDraggingVideos, setIsDraggingVideos] = useState(false);
  const [logs, setLogs] = useState([]);
  const [estimate, setEstimate] = useState({ remainingSeconds: null, progressPercent: 0 });

  useEffect(() => {
    if (!bridge) return;
    bridge.getDefaultWatermark().then(setDefaultWatermark);
    return bridge.onBatchEvent((event) => {
      setLogs((current) => updateLogs(current, event));
      if (event.type === 'item-progress') {
        setEstimate({
          remainingSeconds: event.remainingSeconds,
          progressPercent: Number.isFinite(event.batchProgressPercent) ? event.batchProgressPercent : 0
        });
      }
      if (event.type === 'item-done' || event.type === 'item-failed') {
        setEstimate((current) => ({ ...current, progressPercent: Math.max(current.progressPercent, event.batchProgressPercent || 0) }));
      }
      setVideos((current) => updateVideoStatus(current, event));
    });
  }, []);

  const activeImage = sourceMode === 'upload' ? uploadedWatermark : defaultWatermark;
  const doneCount = videos.filter((video) => video.status === 'done').length;
  const failedCount = videos.filter((video) => video.status === 'failed').length;
  const pendingCount = Math.max(0, videos.length - doneCount - failedCount);
  const canStart = Boolean(
    bridge &&
      videos.length &&
      outputDir &&
      !isProcessing &&
      (sourceMode === 'text' ? text.trim() : activeImage?.path)
  );

  const previewStyle = useMemo(() => {
    return buildPreviewWatermarkStyle({
      sourceMode,
      placement,
      opacity,
      imageWidthPercent,
      fontSize,
      previewMode,
      blendMode
    });
  }, [blendMode, fontSize, imageWidthPercent, opacity, placement, previewMode, sourceMode]);

  async function handleSelectVideos() {
    const selected = await bridge?.selectVideos();
    if (!selected?.length) return;
    setVideos((current) => mergeVideos(current, selected));
  }

  function handleQueueDragEnter(event) {
    if (isProcessing || !hasFileDrag(event)) return;
    event.preventDefault();
    setIsDraggingVideos(true);
  }

  function handleQueueDragOver(event) {
    if (isProcessing || !hasFileDrag(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setIsDraggingVideos(true);
  }

  function handleQueueDragLeave(event) {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    setIsDraggingVideos(false);
  }

  function handleQueueDrop(event) {
    event.preventDefault();
    setIsDraggingVideos(false);
    if (isProcessing) return;

    const droppedVideos = createVideoItemsFromPaths(getDroppedFilePaths(event.dataTransfer?.files));
    if (!droppedVideos.length) return;
    setVideos((current) => mergeVideos(current, droppedVideos));
  }

  async function handleSelectImage() {
    const selected = await bridge?.selectImage();
    if (!selected) return;
    setUploadedWatermark(selected);
    setSourceMode('upload');
  }

  async function handleSelectOutputDir() {
    const selected = await bridge?.selectOutputDir();
    if (!selected) return;
    setOutputDir(selected);
    rememberLastOutputDir(selected);
  }

  async function handleStart() {
    if (!canStart) return;
    setIsProcessing(true);
    setLogs([]);
    setEstimate({ remainingSeconds: null, progressPercent: 0 });
    setVideos((current) => current.map((video) => ({ ...video, status: 'queued', error: '', progressPercent: 0 })));

    const watermark =
      sourceMode === 'text'
        ? { mode: 'text', text, placement, opacity, fontSize, blendMode }
        : {
            mode: 'image',
            imagePath: activeImage.path,
            placement,
            opacity,
            imageWidthPercent,
            blendMode
          };

    try {
      await bridge.startBatch({ videos, outputDir, watermark });
    } finally {
      setIsProcessing(false);
      setEstimate((current) => ({ ...current, remainingSeconds: null, progressPercent: current.progressPercent ? 100 : 0 }));
    }
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="title-block">
          <div className="title-heading">
            <h1>BatchWM批量增添水印</h1>
            <span className="app-version">{appVersionLabel}</span>
          </div>
          <p>{videos.length ? `${videos.length} 个视频，完成 ${doneCount}` : '选择视频、设置水印、开始输出'}</p>
        </div>
        <div className="header-stats" aria-label="处理状态">
          <span>待处理 {pendingCount}</span>
          <span>失败 {failedCount}</span>
          <span>预计 {formatEstimate(isProcessing, estimate.remainingSeconds)}</span>
        </div>
        <button className="primary-action" type="button" disabled={!canStart} onClick={handleStart}>
          {isProcessing ? <Loader2 className="spin" size={17} /> : <Play size={17} />}
          开始
        </button>
      </header>

      <section className="workspace">
        <Panel
          title="视频"
          className={`queue-panel ${isDraggingVideos ? 'drag-active' : ''}`}
          action={<IconButton icon={<Upload size={17} />} label="添加" onClick={handleSelectVideos} disabled={isProcessing} />}
          onDragEnter={handleQueueDragEnter}
          onDragOver={handleQueueDragOver}
          onDragLeave={handleQueueDragLeave}
          onDrop={handleQueueDrop}
        >
          <div className="queue-list">
            {videos.length === 0 ? (
              <EmptyState icon={<FileVideo size={26} />} text="拖入视频或点添加" />
            ) : (
              videos.map((video) => (
                <div className={`queue-item ${video.status}`} key={video.id}>
                  <FileVideo size={17} />
                  <div>
                    <strong>{video.name}</strong>
                    <span>{videoStatusText(video)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="panel-footer">
            <button className="ghost-button" type="button" onClick={() => setVideos([])} disabled={!videos.length || isProcessing}>
              <RotateCcw size={15} />
              清空
            </button>
          </div>
        </Panel>

        <Panel title="水印" className="settings-panel">
          <div className="tabs" role="tablist" aria-label="水印来源">
            {sourceTabs.map((tab) => (
              <button
                key={tab.id}
                className={sourceMode === tab.id ? 'active' : ''}
                type="button"
                onClick={() => setSourceMode(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {sourceMode === 'text' ? (
            <div className="field-grid">
              <label>
                文字
                <input value={text} onChange={(event) => setText(event.target.value)} />
              </label>
              <label>
                字号
                <input
                  min={MIN_TEXT_FONT_SIZE}
                  max={MAX_TEXT_FONT_SIZE}
                  type="number"
                  value={fontSize}
                  onChange={(event) => setFontSize(Number(event.target.value))}
                />
              </label>
            </div>
          ) : (
            <div className="watermark-source">
              <div>
                <ImagePlus size={18} />
                <span>{activeImage?.name || '未选择图片'}</span>
              </div>
              <button type="button" onClick={handleSelectImage}>
                上传
              </button>
            </div>
          )}

          <div className="control-block">
            <div className="section-title">位置</div>
            <div className="placement-grid">
              {placements.map((item) => (
                <button key={item} className={placement === item ? 'selected' : ''} type="button" onClick={() => setPlacement(item)}>
                  {placementLabels[item]}
                </button>
              ))}
            </div>
          </div>

          <div className="range-row">
            <RangeControl label="透明度" min={0} max={1} step={0.05} value={opacity} onChange={setOpacity} suffix="%" />
            {sourceMode === 'text' ? (
              <RangeControl label="字号" min={MIN_TEXT_FONT_SIZE} max={MAX_TEXT_FONT_SIZE} step={1} value={fontSize} onChange={setFontSize} />
            ) : (
              <RangeControl label="大小" min={5} max={80} step={1} value={imageWidthPercent} onChange={setImageWidthPercent} suffix="%" />
            )}
          </div>

          <div className="control-block blend-block">
            <div className="section-title">叠化</div>
            <div className="blend-grid">
              {watermarkBlendModes.map((mode) => (
                <button key={mode.id} className={blendMode === mode.id ? 'selected' : ''} type="button" onClick={() => setBlendMode(mode.id)}>
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          <button className="path-button" type="button" onClick={handleSelectOutputDir}>
            <FolderOpen size={17} />
            <span>{outputDir || '输出目录'}</span>
          </button>
        </Panel>

        <Panel
          title="预览"
          className="preview-panel"
          action={
            <div className="preview-toggle" aria-label="预览比例">
              <button
                className={previewMode === 'landscape' ? 'active' : ''}
                type="button"
                onClick={() => setPreviewMode('landscape')}
              >
                横屏
              </button>
              <button
                className={previewMode === 'portrait' ? 'active' : ''}
                type="button"
                onClick={() => setPreviewMode('portrait')}
              >
                竖屏
              </button>
            </div>
          }
        >
          <div className="preview-stage">
            <div className={`video-frame ${previewMode}`}>
              {sourceMode === 'text' ? (
                <div className="text-watermark" style={previewStyle}>
                  {text || '水印'}
                </div>
              ) : activeImage?.url ? (
                <img className="image-watermark" src={activeImage.url} alt="水印预览" style={previewStyle} />
              ) : null}
            </div>
          </div>
          <div className="log-shell">
            <div className="log-title">
              <span>记录</span>
              <strong>{isProcessing ? `${estimate.progressPercent}%` : '待开始'}</strong>
            </div>
            <div className="log-list">
              {logs.length === 0 ? (
                <EmptyState icon={<CheckCircle2 size={24} />} text="开始后查看进度" />
              ) : (
                logs.map((log) => (
                  <LogItem log={log} key={log.id} />
                ))
              )}
            </div>
          </div>
        </Panel>
      </section>
    </main>
  );
}

function Panel({ title, action, className = '', children, ...props }) {
  return (
    <section className={`panel ${className}`} {...props}>
      <div className="panel-header">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function IconButton({ icon, label, onClick, disabled = false }) {
  return (
    <button className="icon-button" type="button" onClick={onClick} disabled={disabled}>
      {icon}
      {label}
    </button>
  );
}

function LogItem({ log }) {
  return (
    <div className={`log-item ${log.tone}`}>
      <span className="log-label">{log.label}</span>
      <div className="log-content">
        <strong title={log.title}>{log.title}</strong>
        {log.detail ? <span title={log.detail}>{log.detail}</span> : null}
      </div>
    </div>
  );
}

function EmptyState({ icon, text }) {
  return (
    <div className="empty-state">
      {icon}
      <span>{text}</span>
    </div>
  );
}

function RangeControl({ label, min, max, step, value, onChange, suffix = '' }) {
  const displayValue = suffix === '%' && max === 1 ? Math.round(value * 100) : Math.round(value);

  return (
    <label className="range-control">
      <span>
        {label}
        <strong>
          {displayValue}
          {suffix}
        </strong>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function updateVideoStatus(videos, event) {
  if (!event.id) return videos;
  return videos.map((video) => {
    if (video.id !== event.id) return video;
    if (event.type === 'item-start') return { ...video, status: 'processing', progressPercent: 0, outputPath: event.outputPath };
    if (event.type === 'item-progress') return { ...video, status: 'processing', progressPercent: event.itemProgressPercent };
    if (event.type === 'item-done') return { ...video, status: 'done', progressPercent: 100, outputPath: event.outputPath };
    if (event.type === 'item-failed') return { ...video, status: 'failed', error: event.error };
    return video;
  });
}

function videoStatusText(video) {
  if (video.status === 'processing') {
    return Number.isFinite(video.progressPercent) && video.progressPercent > 0 ? `处理中 ${video.progressPercent}%` : '处理中';
  }
  if (video.status === 'done') return '已完成';
  if (video.status === 'failed') return video.error || '失败';
  if (video.status === 'queued') return '等待中';
  return '待处理';
}

function formatEvent(event) {
  if (event.type === 'item-start') {
    return {
      label: '开始',
      title: getFileNameFromPath(event.outputPath),
      detail: event.outputPath
    };
  }
  if (event.type === 'item-done') {
    return {
      label: '完成',
      title: getFileNameFromPath(event.outputPath),
      detail: event.outputPath
    };
  }
  if (event.type === 'item-failed') {
    return {
      label: '失败',
      title: '处理失败',
      detail: event.error
    };
  }
  if (event.type === 'item-progress') {
    return {
      label: '预计',
      title: Number.isFinite(event.remainingSeconds) ? `剩余 ${formatDuration(event.remainingSeconds)}` : '正在估算',
      detail: Number.isFinite(event.batchProgressPercent) ? `整批 ${event.batchProgressPercent}%` : ''
    };
  }
  return {
    label: '信息',
    title: event.line || '处理中',
    detail: ''
  };
}

function updateLogs(current, event) {
  const message = formatEvent(event);
  const entry = {
    id: event.type === 'item-progress' ? 'progress-batch' : `${event.type}-${event.id || 'batch'}-${Date.now()}`,
    ...message,
    tone: event.type.replace('item-', '')
  };
  const next = [entry, ...current.filter((item) => item.id !== entry.id)];
  return next.slice(0, 8);
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds === null) return '--';
  if (seconds <= 0) return '<1秒';
  const rounded = Math.round(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const rest = rounded % 60;
  if (hours > 0) return `${hours}时${String(minutes).padStart(2, '0')}分`;
  if (minutes > 0) return `${minutes}分${String(rest).padStart(2, '0')}秒`;
  return `${rest}秒`;
}

function formatEstimate(isProcessing, remainingSeconds) {
  if (!isProcessing) return '--';
  if (!Number.isFinite(remainingSeconds)) return '估算中';
  return formatDuration(remainingSeconds);
}

function hasFileDrag(event) {
  return Array.from(event.dataTransfer?.types || []).includes('Files');
}

function getDroppedFilePaths(files) {
  return Array.from(files || [])
    .map((file) => bridge?.getPathForFile?.(file) || file.path || '')
    .filter(Boolean);
}
