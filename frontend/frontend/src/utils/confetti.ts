/**
 * Lightweight 60/120 FPS Canvas Confetti Engine
 * Zero DOM tree pollution, GPU-accelerated particle rendering
 */

interface Particle {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  color: string;
  rotation: number;
  vRot: number;
  isCircle: boolean;
  opacity: number;
}

export function throwConfetti() {
  if (typeof window === 'undefined') return;

  const canvas = document.createElement('canvas');
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const width = window.innerWidth;
  const height = window.innerHeight;

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '99999';
  canvas.style.transform = 'translate3d(0,0,0)';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.remove();
    return;
  }
  ctx.scale(dpr, dpr);

  const colors = ['#fbbf24', '#ec4899', '#8b5cf6', '#06b6d4', '#5fff7a', '#fde047', '#f43f5e'];
  const particles: Particle[] = [];
  const PARTICLE_COUNT = 65;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const isLeft = Math.random() > 0.5;
    const startX = isLeft
      ? Math.random() * (width * 0.35)
      : width - Math.random() * (width * 0.35);

    const dir = isLeft ? 1 : -1;
    particles.push({
      x: startX,
      y: -20 - Math.random() * 40,
      w: Math.random() * 8 + 5,
      h: Math.random() * 12 + 6,
      vx: dir * (Math.random() * 3.5 + 1.2) + (Math.random() - 0.5) * 1.5,
      vy: Math.random() * 3 + 2.5,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.2,
      isCircle: Math.random() > 0.6,
      opacity: 1
    });
  }

  let startTime = performance.now();
  const DURATION_MS = 2600;

  function animate(now: number) {
    const elapsed = now - startTime;
    if (elapsed > DURATION_MS || !ctx) {
      canvas.remove();
      return;
    }

    ctx.clearRect(0, 0, width, height);

    const progress = elapsed / DURATION_MS;
    const globalFade = progress > 0.7 ? 1 - (progress - 0.7) / 0.3 : 1;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx;
      p.vy += 0.08; // gravity
      p.y += p.vy;
      p.rotation += p.vRot;
      p.vx *= 0.99; // drag

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = Math.max(0, p.opacity * globalFade);
      ctx.fillStyle = p.color;

      if (p.isCircle) {
        ctx.beginPath();
        ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      }
      ctx.restore();
    }

    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
}
