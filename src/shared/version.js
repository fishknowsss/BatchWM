export function formatAppVersion(version) {
  const value = String(version || '').trim();
  return `v${value || '0.0.0'}`;
}
