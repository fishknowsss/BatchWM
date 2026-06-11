export const supportedVideoExtensions = ['.mp4', '.mov', '.m4v', '.avi', '.mkv', '.webm'];

export function isSupportedVideoPath(filePath) {
  const extension = getExtension(filePath);
  return supportedVideoExtensions.includes(extension);
}

export function createVideoItemsFromPaths(filePaths, now = Date.now()) {
  const seen = new Set();

  return filePaths.flatMap((filePath, index) => {
    if (!filePath || seen.has(filePath) || !isSupportedVideoPath(filePath)) return [];
    seen.add(filePath);
    return {
      id: `${filePath}-${now}-${index}`,
      path: filePath,
      name: getFileNameFromPath(filePath),
      status: 'ready'
    };
  });
}

export function mergeVideos(current, selected) {
  const existingPaths = new Set(current.map((video) => video.path));
  return [...current, ...selected.filter((video) => !existingPaths.has(video.path))];
}

export function getFileNameFromPath(filePath) {
  const value = String(filePath || '');
  const parts = value.split(/[\\/]/);
  return parts.at(-1) || value;
}

function getExtension(filePath) {
  const name = getFileNameFromPath(filePath).toLowerCase();
  const dotIndex = name.lastIndexOf('.');
  return dotIndex >= 0 ? name.slice(dotIndex) : '';
}
