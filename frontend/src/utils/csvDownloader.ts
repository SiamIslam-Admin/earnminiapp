import { api } from '../api/client';
import { notifyToast } from './debugToast';
import { copyTextSafe } from './clipboard';

/**
 * Downloads a CSV file with full admin authorization inside Telegram Mini App.
 * Uses client-side Blob generation so the admin never gets kicked out to an unauthenticated browser.
 */
export async function downloadCsvAuthenticated(url: string, filename: string): Promise<boolean> {
  notifyToast(`📥 Preparing ${filename}...`, 'info', 2000);

  try {
    const adminToken = api.getAdminToken();
    const headers: Record<string, string> = {
      'Bypass-Tunnel-Reminder': 'true',
      'bypass-tunnel-reminder': 'true'
    };

    if (adminToken) {
      headers['Authorization'] = `Bearer ${adminToken}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      // If 401 or error, notify user
      if (response.status === 401) {
        notifyToast('Admin authorization expired. Please log in again.', 'error', 3500);
        return false;
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const csvText = await response.text();
    if (!csvText || !csvText.trim()) {
      notifyToast('Export returned empty data.', 'info', 2500);
      return false;
    }

    // Create client-side in-memory Blob
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    }, 1500);

    notifyToast(`✓ Downloaded ${filename}!`, 'success', 3000);
    return true;
  } catch (err: any) {
    console.error('[CSV Downloader Error]', err);
    notifyToast(`Could not stream download: ${err.message}`, 'error', 3500);
    return false;
  }
}

/**
 * Downloads raw CSV text string directly from memory
 */
export function downloadRawCsv(csvContent: string, filename: string) {
  try {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    }, 1500);

    notifyToast(`✓ Downloaded ${filename}!`, 'success', 2500);
  } catch (err: any) {
    // If blob download is blocked in mobile webview, fallback to clipboard
    copyTextSafe(csvContent, 'CSV Data');
    notifyToast('CSV copied to clipboard (file saving restricted in WebView)', 'info', 3500);
  }
}
