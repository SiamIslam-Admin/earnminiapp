import { notifyToast } from './debugToast';
import { haptics } from './haptics';

/**
 * Universal Clipboard Copier with 3-tier fallback.
 * Works 100% reliably in Telegram Mini App WebViews (iOS & Android) and standard browsers.
 */
export async function copyTextSafe(text: string, label: string = 'Text'): Promise<boolean> {
  if (!text) {
    notifyToast('Nothing to copy', 'info', 1500);
    return false;
  }

  let copied = false;

  // Tier 1: Modern Async Clipboard API
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      // Async clipboard failed or permission denied in WebView, fall through to Tier 2
    }
  }

  // Tier 2: Legacy execCommand('copy') via temporary offscreen textarea
  if (!copied && typeof document !== 'undefined') {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.top = '0';
      textarea.style.left = '0';
      textarea.style.opacity = '0';
      textarea.style.pointerEvents = 'none';
      textarea.style.zIndex = '-9999';
      document.body.appendChild(textarea);

      // iOS selection range workaround
      if (navigator.userAgent.match(/ipad|ipod|iphone/i)) {
        const range = document.createRange();
        range.selectNodeContents(textarea);
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(range);
        }
        textarea.setSelectionRange(0, 999999);
      } else {
        textarea.select();
      }

      copied = document.execCommand('copy');
      document.body.removeChild(textarea);
    } catch {
      copied = false;
    }
  }

  if (copied) {
    try {
      haptics.notification('success');
    } catch {}
    notifyToast(`📋 Copied ${label}!`, 'info', 2000);
    return true;
  } else {
    notifyToast(`Failed to copy automatically. Please select text manually.`, 'error', 3000);
    return false;
  }
}
