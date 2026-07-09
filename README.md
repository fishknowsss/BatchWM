# BatchWM

[![Check](https://github.com/fishknowsss/BatchWM/actions/workflows/check.yml/badge.svg)](https://github.com/fishknowsss/BatchWM/actions/workflows/check.yml)

BatchWM 是一个本地运行的 macOS 批量视频水印工具。它用 Electron 提供桌面界面，用内置 `ffmpeg-static` 完成视频处理，适合把一组视频统一输出为带文字或图片水印的 H.264/AAC MP4。

当前版本：`0.1.3`

## 下载

从 [GitHub Releases](https://github.com/fishknowsss/BatchWM/releases) 下载最新的 macOS 版本。

当前发布流程会在推送 `vX.Y.Z` 标签后自动构建并上传：

- `BatchWM-X.Y.Z-mac-arm64.zip`
- `BatchWM-X.Y.Z-mac-arm64.zip.sha256`

当前构建没有代码签名和 notarization。首次打开时，macOS 可能需要在 Finder 中右键选择“打开”。

## 功能

- 批量导入视频：支持选择文件，也支持拖入视频队列。
- 自动过滤重复路径和非视频文件。
- 支持格式：`mp4`、`mov`、`m4v`、`avi`、`mkv`、`webm`。
- 水印来源：自定义文字、内置透明 PNG、自选图片。
- 水印位置：左上、上中、右上、左中、中间、右中、左下、下中、右下。
- 水印参数：透明度、图片宽度比例、文字字号。
- 叠化模式：标准、柔和、提亮、深色、印记。
- 横屏和竖屏预览。
- 批量进度、单个视频状态和整批剩余时间估算。
- 输出目录记忆。
- 输出文件自动追加 `_watermarked`，遇到重名时自动增加序号。

## 技术栈

| 模块 | 说明 |
| --- | --- |
| Electron | 桌面应用壳、文件选择、IPC、macOS 打包 |
| React | 主界面 |
| Vite | 前端开发和生产构建 |
| ffmpeg-static | 内置 ffmpeg 二进制，不要求用户安装系统 ffmpeg |
| electron-builder | 生成 macOS 应用目录 |
| Node.js test runner | 单元测试 |
| sharp | 生成应用图标资源 |
| lucide-react | 界面图标 |

## 环境要求

- Node.js `^20.19.0 || >=22.12.0`。
- npm。
- macOS。当前打包脚本只配置了 macOS arm64 应用目录。

安装依赖：

```bash
npm ci
```

## 开发运行

```bash
npm start
```

该命令会同时启动 Vite 开发服务器和 Electron 应用。

也可以分别运行：

```bash
npm run dev
npm run electron
```

## 使用流程

1. 点“添加”或直接拖入视频。
2. 选择文字、内置图片或自定义图片水印。
3. 设置位置、透明度、大小或字号。
4. 选择输出目录。
5. 点“开始”处理。

处理完成后，输出文件会写入所选目录，文件名格式为：

```text
原文件名_watermarked.mp4
```

## 输出规则

- 视频编码：`libx264`。
- 编码预设：`veryfast`。
- 质量参数：`-crf 20`。
- 像素格式：`yuv420p`。
- 音频编码：`aac`，码率 `192k`。
- 启用 `+faststart`，便于网络播放场景快速起播。
- 如果源视频没有音轨，也会正常输出。
- 图片水印会按视频显示宽度计算尺寸。
- 文字水印会按视频显示高度归一化字号，横竖屏和旋转视频会使用显示尺寸计算。

## 打包

生成 macOS arm64 应用目录：

```bash
npm run pack:mac
```

产物位置：

```text
release/mac-arm64/BatchWM.app
```

本机覆盖安装：

```bash
ditto release/mac-arm64/BatchWM.app /Applications/BatchWM.app
```

当前配置生成的是应用目录，不是签名安装包，也没有配置 notarization。

## 发布

GitHub Actions 会在 `main` 分支推送和 pull request 时运行 `npm run check`。

发布 macOS 版本时，先确认 `package.json` 中的版本号，然后创建并推送同名标签：

```bash
git tag v0.1.3
git push origin v0.1.3
```

标签推送后，`.github/workflows/release.yml` 会在 GitHub runner 上执行测试、构建、打包，并把 macOS arm64 zip 与 sha256 上传到 GitHub Release。

## 验证

运行测试：

```bash
npm run test
```

运行生产构建：

```bash
npm run build
```

完整检查：

```bash
npm run check
```

`npm run check` 会先运行 Node 测试，再执行 Vite 生产构建。

## 项目结构

```text
BatchWM/
├── electron/
│   ├── main.js          # Electron 主进程和 IPC
│   ├── preload.js       # 安全暴露给前端的 bridge
│   ├── processor.js     # ffmpeg 参数和批量处理
│   └── assets.js        # 打包资源路径
├── src/
│   ├── App.jsx          # 应用界面
│   ├── main.jsx         # React 入口
│   ├── styles.css       # 界面样式
│   └── shared/          # 前端和 Electron 共用逻辑
├── test/                # Node 测试
├── scripts/
│   └── generate-icons.mjs
├── build/               # 图标源文件和生成资源
├── 由十力水印.png        # 内置水印图片
├── package.json
└── vite.config.js
```

## 关键实现

- 预览和导出共用 `src/shared/watermark.js`，避免界面预览和 ffmpeg 输出使用两套尺寸规则。
- `electron/processor.js` 负责读取视频信息、生成输出路径、拼接 ffmpeg 参数和解析处理进度。
- `electron/preload.js` 只暴露应用需要的文件选择、路径读取和批量处理接口。
- 内置水印图片会在开发环境从项目根目录读取，在打包后从 `resources/assets` 读取。

## 许可证

[MIT](LICENSE)
