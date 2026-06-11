# 批量水印

本地视频批量加水印工具，支持内置透明 PNG、水印图片上传和文字水印。

## 使用

如果已经安装成 macOS 应用，直接打开“应用程序”里的 `BatchWM`。

源码运行：

```bash
npm install
npm start
```

打开后按顺序选择视频、设置水印、选择输出目录，再点击“开始处理”。

## 已支持

- 左侧视频栏可点击添加，也可批量拖入视频文件
- 水印位置：中间、四角、上下左右边中点
- 水印透明度调节
- 内置透明 PNG 水印：`由十力水印.png`
- 用户上传图片水印
- 自定义文字水印，已指定 macOS 中英文字体以避免文字显示为问号
- 批量视频顺序处理
- 顶部显示整批预计剩余时间，单个视频显示处理状态和进度
- 记录区按状态、文件名、路径分行显示，长路径会自动截断
- 输出到指定目录，文件名追加 `_watermarked`

应用内置 `ffmpeg-static`，不依赖系统安装 `ffmpeg`。

## 打包安装

```bash
npm run pack:mac
cp -R release/mac*/BatchWM.app /Applications/
```

打包后可直接打开 `release/mac-arm64/BatchWM.app` 试用；复制到 `/Applications/BatchWM.app` 后会覆盖本机应用程序里的旧版本。

## 开发验证

```bash
npm run check
```

该命令会先运行 Node 测试，再执行 Vite 生产构建。
