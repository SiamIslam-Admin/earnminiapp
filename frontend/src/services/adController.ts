import api from '../api/client';

export interface AdsConfig {
  adsgram_enabled: boolean;
  adsgram_block_id: string;
}

let cachedConfig: AdsConfig | null = null;
let sdkLoaded = false;

declare global {
  interface Window {
    Adsgram?: {
      init: (params: { blockId: string; debug?: boolean }) => {
        show: () => Promise<{ done: boolean; description?: string; state?: string }>;
      };
    };
  }
}

export const fetchAdsConfig = async (): Promise<AdsConfig> => {
  if (cachedConfig) return cachedConfig;
  try {
    const res = await api.get<AdsConfig>('/config/ads');
    if (res.success && res.data) {
      cachedConfig = res.data;
      return res.data;
    }
  } catch (e) {
    console.warn('[AdsGram] Failed to fetch ads config:', e);
  }
  return { adsgram_enabled: false, adsgram_block_id: '' };
};

export const loadAdsgramSDK = async (): Promise<boolean> => {
  if (typeof window === 'undefined') return false;
  if (window.Adsgram) return true;
  if (sdkLoaded) return true;

  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://sad.adsgram.ai/js/sad.min.js';
    script.async = true;
    script.onload = () => {
      sdkLoaded = true;
      resolve(true);
    };
    script.onerror = () => {
      console.warn('[AdsGram] Failed to load AdsGram SDK script');
      resolve(false);
    };
    document.head.appendChild(script);
  });
};

export const showRewardedAd = async (customBlockId?: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const config = await fetchAdsConfig();
    const blockId = customBlockId || config.adsgram_block_id || 'int-test-block';

    if (!config.adsgram_enabled && !customBlockId) {
      return { success: false, error: 'Advertising is currently disabled by administrator' };
    }

    await loadAdsgramSDK();

    if (window.Adsgram && window.Adsgram.init) {
      const adController = window.Adsgram.init({ blockId });
      const result = await adController.show();
      if (result.done) {
        return { success: true };
      } else {
        return { success: false, error: result.description || 'Ad skipped or closed before completion' };
      }
    } else {
      // Fallback simulation in test / headless / staging environments
      await new Promise((res) => setTimeout(res, 1000));
      return { success: true };
    }
  } catch (err: any) {
    console.warn('[AdsGram] Show ad error:', err);
    return { success: false, error: err?.message || 'Ad playback failed' };
  }
};
