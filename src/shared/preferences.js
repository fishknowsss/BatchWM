const LAST_OUTPUT_DIR_KEY = 'batchwm:last-output-dir';

export function readLastOutputDir(storage = globalThis?.localStorage) {
  try {
    return String(storage?.getItem(LAST_OUTPUT_DIR_KEY) || '').trim();
  } catch {
    return '';
  }
}

export function rememberLastOutputDir(outputDir, storage = globalThis?.localStorage) {
  const value = String(outputDir || '').trim();
  if (!value) return;

  try {
    storage?.setItem(LAST_OUTPUT_DIR_KEY, value);
  } catch {
    // Local storage can be disabled; the selected directory still works for this run.
  }
}
