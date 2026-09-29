export interface DebugToast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  timestamp: number;
}

type Listener = (toasts: DebugToast[]) => void;

let toasts: DebugToast[] = [];
const listeners: Set<Listener> = new Set();

export const notifyToast = (message: string, type: 'success' | 'error' | 'info' = 'success', durationMs = 3000) => {
  const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const newToast: DebugToast = { id, message, type, timestamp: Date.now() };
  
  toasts = [newToast, ...toasts].slice(0, 4); // keep max 4 toasts
  listeners.forEach((fn) => fn([...toasts]));

  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    listeners.forEach((fn) => fn([...toasts]));
  }, durationMs);
};

export const subscribeToToasts = (listener: Listener) => {
  listeners.add(listener);
  listener([...toasts]);
  return () => {
    listeners.delete(listener);
  };
};
