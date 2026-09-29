/**
 * Formats large asset counts compactly for mobile badges (e.g., 850 -> '850', 12500 -> '12.5k', 1200000 -> '1.2M')
 */
export function formatAssetNumber(num: number | undefined | null): string {
  if (num === undefined || num === null || isNaN(num)) return '0';
  if (num < 10000) return num.toLocaleString();
  if (num < 1000000) {
    const k = (num / 1000).toFixed(1).replace(/\.0$/, '');
    return `${k}k`;
  }
  const m = (num / 1000000).toFixed(1).replace(/\.0$/, '');
  return `${m}M`;
}
