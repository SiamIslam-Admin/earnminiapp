// Telegram Haptic Feedback & Audio Utility

type HapticStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
type NotificationType = 'error' | 'success' | 'warning';

class HapticsService {
  private audioCtx: AudioContext | null = null;

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  // Telegram native haptics
  impact(style: HapticStyle = 'medium') {
    try {
      // @ts-ignore
      const tg = window.Telegram?.WebApp?.HapticFeedback;
      if (tg?.impactOccurred) {
        tg.impactOccurred(style);
      }
    } catch {
      // Fallback ignore
    }
  }

  notification(type: NotificationType = 'success') {
    try {
      // @ts-ignore
      const tg = window.Telegram?.WebApp?.HapticFeedback;
      if (tg?.notificationOccurred) {
        tg.notificationOccurred(type);
      }
    } catch {
      // Fallback ignore
    }
  }

  selection() {
    try {
      // @ts-ignore
      const tg = window.Telegram?.WebApp?.HapticFeedback;
      if (tg?.selectionChanged) {
        tg.selectionChanged();
      }
    } catch {
      // Fallback ignore
    }
  }

  // Synthesized Sound Effects (Zero network latency, instant crisp feedback)
  playClickSound() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    } catch {
      // Fallback ignore
    }
  }

  playWinSound() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.08);
        gain.gain.setValueAtTime(0.12, now + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.25);
      });
    } catch {
      // Fallback ignore
    }
  }
}

export const haptics = new HapticsService();
