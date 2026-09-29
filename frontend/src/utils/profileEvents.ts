import type { UserProfile } from '../types/api';

type ProfileUpdatePayload = Partial<UserProfile> & {
  reward_diamonds?: number;
  reward_spins?: number;
  reward_usd?: number;
  rewardGems?: number;
};

type ProfileListener = (profile: UserProfile) => void;
type PartialListener = (partial: ProfileUpdatePayload) => void;

class ProfileEventBus {
  private listeners: Set<ProfileListener> = new Set();
  private partialListeners: Set<PartialListener> = new Set();

  public subscribe(fn: ProfileListener) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  public subscribePartial(fn: PartialListener) {
    this.partialListeners.add(fn);
    return () => {
      this.partialListeners.delete(fn);
    };
  }

  public emitFull(profile: UserProfile) {
    this.listeners.forEach((fn) => {
      try {
        fn(profile);
      } catch (err) {
        console.error('Error in profile listener:', err);
      }
    });
  }

  public emitUpdate(partial: ProfileUpdatePayload) {
    this.partialListeners.forEach((fn) => {
      try {
        fn(partial);
      } catch (err) {
        console.error('Error in partial profile listener:', err);
      }
    });
  }
}

export const profileEventBus = new ProfileEventBus();

export const emitProfileUpdate = (partial: ProfileUpdatePayload) => {
  profileEventBus.emitUpdate(partial);
};

export const emitFullProfile = (profile: UserProfile) => {
  profileEventBus.emitFull(profile);
};
