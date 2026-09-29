import { copyTextSafe } from './clipboard';
import { notifyToast } from './debugToast';
import { haptics } from './haptics';

/**
 * Universal browser launcher for Telegram WebApp and standard browsers.
 * Opens the external browser to download files or open links directly.
 */
export const openDownloadInBrowser = async (url: string, label: string = 'CSV Export') => {
  if (!url) {
    notifyToast('Invalid download URL', 'error', 3000);
    return;
  }

  haptics.impact('light');
  const tg = (window as any)?.Telegram?.WebApp;

  try {
    if (tg && typeof tg.openLink === 'function') {
      tg.openLink(url);
    } else {
      const newTab = window.open(url, '_blank', 'noopener,noreferrer');
      if (!newTab || newTab.closed || typeof newTab.closed === 'undefined') {
        // Fallback to location assignment if popup is blocked
        window.location.href = url;
      }
    }
    notifyToast(`🚀 Opening ${label} in browser...`, 'info', 3500);
  } catch (err) {
    console.warn('Direct browser launch failed, copying link as fallback:', err);
    await copyTextSafe(url, `${label} Download Link`);
    notifyToast(`📋 Link copied! Open in browser to download.`, 'info', 4000);
  }
};
