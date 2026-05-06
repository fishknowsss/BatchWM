import path from 'node:path';

const defaultWatermarkName = '由十力水印.png';

export function getDefaultWatermarkPath({ isPackaged, projectRoot, resourcesPath }) {
  if (isPackaged) {
    return path.join(resourcesPath, 'assets', defaultWatermarkName);
  }
  return path.join(projectRoot, defaultWatermarkName);
}

export function resolvePackagedAssetPath(assetPath) {
  return assetPath?.replace('app.asar', 'app.asar.unpacked');
}
