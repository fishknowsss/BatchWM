import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  FileVideo,
  FolderOpen,
  ImagePlus,
  Loader2,
  Play,
  RotateCcw,
  Type,
  Upload
} from 'lucide-react';

import { placements } from './shared/watermark.js';

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
  { id: 'default', label: '内置' },
  { id: 'upload', label: '图片' },
  { id: 'text', label: '文字' }
];

const bridge = window.batchWM;

export function App() {
  const [videos, setVideos] = useState([]);
  const [defaultWatermark, setDefaultWatermark] = useState(null);
  const [uploadedWatermark, setUploadedWatermark] = useState(null);
  const [outputDir, setOutputDir] = useState('');
  const [sourceMode, setSourceMode] = useState('default');
  const [placement, setPlacement] = useState('center');
  const [opacity, setOpacity] = useState(0.55);
  const [imageWidthPercent, setImageWidthPercent] = useState(18);
  const [text, setText] = useState('由十力');
  const [fontSize, setFontSize] = useState(42);
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState([]);
  const [estimate, setEstimate] = useState({ remainingSeconds: null, progressPercent: 0 });

  useEffect(() => {
    if (!bridge) return;
    bridge.getDefaultWatermark().then(setDefaultWatermark);
    return bridge.onBatchEvent((event) => {
      setLogs((current) => [formatEvent(event), ...current].slice(0, 10));
      if (event.type === 'item-progress') {
        setEstimate({
          remainingSeconds: event.remainingSeconds,
          progressPercent: event.totalSeconds ? Math.min(100, Math.round((event.processedSeconds / event.totalSeconds) * 100)) : 0
        });
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
    const position = placementToCss(placement);
    return {
      ...position,
      opacity,
      width: sourceMode === 'text' ? 'auto' : `${imageWidthPercent}%`,
      fontSize: `${Math.max(16, Math.min(48, fontSize * 0.68))}px`
    };
  }, [fontSize, imageWidthPercent, opacity, placement, sourceMode]);

  async function handleSelectVideos() {
    const selected = await bridge?.selectVideos();
    if (!selected?.length) return;
    setVideos((current) => mergeVideos(current, selected));
  }

  async function handleSelectImage() {
    const selected = await bridge?.selectImage();
    if (!selected) return;
    setUploadedWatermark(selected);
    setSourceMode('upload');
  }

  async function handleSelectOutputDir() {
    const selected = await bridge?.selectOutputDir();
    if (selected) setOutputDir(selected);
  }

  async function handleStart() {
    if (!canStart) return;
    setIsProcessing(true);
    setLogs([]);
    setEstimate({ remainingSeconds: null, progressPercent: 0 });
    setVideos((current) => current.map((video) => ({ ...video, status: 'queued', error: '' })));

    const watermark =
      sourceMode === 'text'
        ? { mode: 'text', text, placement, opacity, fontSize }
        : {
            mode: 'image',
            imagePath: activeImage.path,
            placement,
            opacity,
            imageWidthPercent
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
          <h1>批量水印</h1>
          <p>{videos.length ? `${videos.length} 个视频，完成 ${doneCount}` : '选择视频、设置水印、开始输出'}</p>
        </div>
        <div className="header-stats" aria-label="处理状态">
          <span>待处理 {pendingCount}</span>
          <span>失败 {failedCount}</span>
          <span>预计 {isProcessing ? formatDuration(estimate.remainingSeconds) : '--'}</span>
        </div>
        <button className="primary-action" type="button" disabled={!canStart} onClick={handleStart}>
          {isProcessing ? <Loader2 className="spin" size={17} /> : <Play size={17} />}
          开始
        </button>
      </header>

      <section className="workspace">
        <Panel title="视频" className="queue-panel" action={<IconButton icon={<Upload size={17} />} label="添加" onClick={handleSelectVideos} />}>
          <div className="queue-list">
            {videos.length === 0 ? (
              <EmptyState icon={<FileVideo size={26} />} text="先添加视频" />
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
                <input min="12" max="160" type="number" value={fontSize} onChange={(event) => setFontSize(Number(event.target.value))} />
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
              <RangeControl label="字号" min={12} max={160} step={1} value={fontSize} onChange={setFontSize} />
            ) : (
              <RangeControl label="大小" min={5} max={60} step={1} value={imageWidthPercent} onChange={setImageWidthPercent} suffix="%" />
            )}
          </div>

          <button className="path-button" type="button" onClick={handleSelectOutputDir}>
            <FolderOpen size={17} />
            <span>{outputDir || '选择输出目录'}</span>
          </button>
        </Panel>

        <Panel title="预览" className="preview-panel">
          <div className="preview-stage">
            <div className="video-frame">
              {sourceMode === 'text' ? (
                <div className="text-watermark" style={previewStyle}>
                  <Type size={17} />
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
                logs.map((log) => <div key={log}>{log}</div>)
              )}
            </div>
          </div>
        </Panel>
      </section>
    </main>
  );
}

function Panel({ title, action, className = '', children }) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-header">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function IconButton({ icon, label, onClick }) {
  return (
    <button className="icon-button" type="button" onClick={onClick}>
      {icon}
      {label}
    </button>
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

function mergeVideos(current, selected) {
  const existingPaths = new Set(current.map((video) => video.path));
  return [...current, ...selected.filter((video) => !existingPaths.has(video.path))];
}

function updateVideoStatus(videos, event) {
  if (!event.id) return videos;
  return videos.map((video) => {
    if (video.id !== event.id) return video;
    if (event.type === 'item-start') return { ...video, status: 'processing', outputPath: event.outputPath };
    if (event.type === 'item-progress') return { ...video, status: 'processing', remainingSeconds: event.remainingSeconds };
    if (event.type === 'item-done') return { ...video, status: 'done', outputPath: event.outputPath };
    if (event.type === 'item-failed') return { ...video, status: 'failed', error: event.error };
    return video;
  });
}

function videoStatusText(video) {
  if (video.status === 'processing') return video.remainingSeconds ? `处理中，约 ${formatDuration(video.remainingSeconds)}` : '处理中';
  if (video.status === 'done') return '已完成';
  if (video.status === 'failed') return video.error || '失败';
  if (video.status === 'queued') return '等待中';
  return '待处理';
}

function formatEvent(event) {
  if (event.type === 'item-start') return `开始：${event.outputPath}`;
  if (event.type === 'item-done') return `完成：${event.outputPath}`;
  if (event.type === 'item-failed') return `失败：${event.error}`;
  if (event.type === 'item-progress') return event.remainingSeconds ? `预计剩余 ${formatDuration(event.remainingSeconds)}` : '正在估算';
  return event.line || '处理中';
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds === null) return '--';
  if (seconds <= 0) return '少于 1 秒';
  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const rest = rounded % 60;
  if (minutes <= 0) return `${rest} 秒`;
  return `${minutes} 分 ${String(rest).padStart(2, '0')} 秒`;
}

function placementToCss(placement) {
  const edge = '18px';
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
