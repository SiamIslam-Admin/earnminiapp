import { useEffect, useRef, useState, useCallback } from 'react';
import type { FC } from 'react';
import { haptics } from '../utils/haptics';

export interface SpinSegment {
  label: string;
  value: string;
  image?: string;
}

export interface SpinWheelProps {
  segments: SpinSegment[];
  size?: number;
  theme?: 'emerald' | 'colorful' | 'gold';
  spins?: number;
  diamonds?: number;
  onSpinRequest?: () => Promise<number | { targetIndex: number; [key: string]: any }>;
  onOutOfSpins?: () => void;
  onSpinEnd?: (winner: SpinSegment, serverResult?: any) => void;
  spinDuration?: number;
}

interface GemstoneTheme {
  name: string;
  chromaticCore: string;
  vividMid: string;
  deepBody: string;
  darkEdge: string;
  rimBevel: string;
}

// 12 Ultra-Saturated Royal Gemstone Themes (Pure Color Vibrancy, No Pastel Washout)
const LUXURY_GEMSTONES: GemstoneTheme[] = [
  {
    name: 'Royal Amethyst',
    chromaticCore: '#e879f9',
    vividMid: '#a855f7',
    deepBody: '#7e22ce',
    darkEdge: '#2e1065',
    rimBevel: 'rgba(232, 121, 249, 0.75)'
  },
  {
    name: 'Molten Amber Gold',
    chromaticCore: '#fde047',
    vividMid: '#f59e0b',
    deepBody: '#b45309',
    darkEdge: '#451a03',
    rimBevel: 'rgba(254, 240, 138, 0.85)'
  },
  {
    name: 'Imperial Jade Emerald',
    chromaticCore: '#34d399',
    vividMid: '#10b981',
    deepBody: '#047857',
    darkEdge: '#022c22',
    rimBevel: 'rgba(52, 211, 153, 0.75)'
  },
  {
    name: 'Burning Crimson Ruby',
    chromaticCore: '#fb7185',
    vividMid: '#f43f5e',
    deepBody: '#be123c',
    darkEdge: '#4c0519',
    rimBevel: 'rgba(251, 113, 133, 0.75)'
  },
  {
    name: 'Electric Sapphire',
    chromaticCore: '#38bdf8',
    vividMid: '#0284c7',
    deepBody: '#0369a1',
    darkEdge: '#082f49',
    rimBevel: 'rgba(56, 189, 248, 0.75)'
  },
  {
    name: 'Vibrant Mint Peridot',
    chromaticCore: '#6ee7b7',
    vividMid: '#14b8a6',
    deepBody: '#0f766e',
    darkEdge: '#042f2e',
    rimBevel: 'rgba(110, 231, 183, 0.75)'
  },
  {
    name: 'Tangerine Carnelian',
    chromaticCore: '#fdba74',
    vividMid: '#f97316',
    deepBody: '#c2410c',
    darkEdge: '#431407',
    rimBevel: 'rgba(253, 186, 116, 0.75)'
  },
  {
    name: 'Royal Tanzanite',
    chromaticCore: '#a5b4fc',
    vividMid: '#6366f1',
    deepBody: '#4338ca',
    darkEdge: '#1e1b4b',
    rimBevel: 'rgba(165, 180, 252, 0.75)'
  }
];

export const SpinWheel: FC<SpinWheelProps> = ({
  segments,
  size = 260,
  spins = 1,
  diamonds = 0,
  onSpinRequest,
  onOutOfSpins,
  onSpinEnd,
  spinDuration = 3200
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const coreWrapperRef = useRef<HTMLDivElement>(null);

  const [isSpinning, setIsSpinning] = useState(false);
  const [loadedCount, setLoadedCount] = useState(0);
  const [isButtonPressed, setIsButtonPressed] = useState(false);
  const loadedImagesRef = useRef<Record<string, HTMLImageElement>>({});

  // Sizing metrics
  const frameThickness = 22;
  const coreSize = Math.max(120, size - frameThickness * 2 + 4);
  const hubSize = coreSize * 0.30;

  // Preload segment images & trigger redraw when each image finishes loading
  useEffect(() => {
    const urls = segments.map((s) => s.image).filter(Boolean) as string[];
    if (urls.length === 0) return;

    urls.forEach((url) => {
      if (loadedImagesRef.current[url]) return;
      const img = new Image();
      img.src = url;
      img.onload = () => {
        loadedImagesRef.current[url] = img;
        setLoadedCount((c) => c + 1);
      };
    });
  }, [segments]);

  // ═══════════════════════════════════════════════════════════════════
  // HIGH-DPI CANVAS RENDER: 3D CONVEX GEMSTONE CUSHION ROTATING CORE
  // ═══════════════════════════════════════════════════════════════════
  const drawWheel = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = typeof window !== 'undefined' ? Math.max(window.devicePixelRatio || 1, 2) : 2;
    const renderSize = coreSize * dpr;

    canvas.width = renderSize;
    canvas.height = renderSize;

    ctx.save();
    ctx.scale(dpr, dpr);

    const numSegments = segments.length;
    if (numSegments === 0) {
      ctx.restore();
      return;
    }

    const arc = (2 * Math.PI) / numSegments;
    const cx = coreSize / 2;
    const cy = coreSize / 2;
    const innerRadius = coreSize / 2 - 1;
    const hubRadius = hubSize / 2;

    ctx.clearRect(0, 0, coreSize, coreSize);

    // ─────────────────────────────────────────────────────────────────
    // 1. BASE ROTATING BACKPLATE
    // ─────────────────────────────────────────────────────────────────
    ctx.beginPath();
    ctx.arc(cx, cy, innerRadius, 0, 2 * Math.PI);
    ctx.fillStyle = '#060a12';
    ctx.fill();

    // ─────────────────────────────────────────────────────────────────
    // 2. 3D CONVEX GEMSTONE SLICES (Segment-Local Pillow Geometry)
    // ─────────────────────────────────────────────────────────────────
    for (let i = 0; i < numSegments; i++) {
      const angle = i * arc;
      const gemTheme = LUXURY_GEMSTONES[i % LUXURY_GEMSTONES.length];
      const midAngle = angle + arc / 2;

      ctx.save();

      // Base Sector Path Clip
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, innerRadius, angle, angle + arc);
      ctx.closePath();
      ctx.clip();

      // Calculate the centroid of THIS specific segment slice
      const sliceCenterDist = (hubRadius + innerRadius) * 0.58;
      const sliceCenterX = cx + Math.cos(midAngle) * sliceCenterDist;
      const sliceCenterY = cy + Math.sin(midAngle) * sliceCenterDist;

      // Layer 2A: Segment-Local 3D Convex Radial Gradient (Pillow Cushion Shading)
      const localGrad = ctx.createRadialGradient(
        sliceCenterX,
        sliceCenterY,
        2,
        sliceCenterX,
        sliceCenterY,
        innerRadius * 0.68
      );
      localGrad.addColorStop(0, gemTheme.chromaticCore);
      localGrad.addColorStop(0.32, gemTheme.vividMid);
      localGrad.addColorStop(0.72, gemTheme.deepBody);
      localGrad.addColorStop(1, gemTheme.darkEdge);

      ctx.fillStyle = localGrad;
      ctx.fill();

      // Layer 2B: Angular Depth Shading (Wheel center falloff for unified depth)
      const depthShadow = ctx.createRadialGradient(
        cx,
        cy,
        innerRadius * 0.75,
        cx,
        cy,
        innerRadius
      );
      depthShadow.addColorStop(0, 'rgba(0, 0, 0, 0)');
      depthShadow.addColorStop(1, 'rgba(0, 0, 0, 0.45)');

      ctx.fillStyle = depthShadow;
      ctx.fill();

      // Layer 2C: Inset Pillow Bevel Edge Contour Highlights
      ctx.beginPath();
      ctx.arc(cx, cy, innerRadius - 2.5, angle + 0.025, angle + arc - 0.025);
      ctx.strokeStyle = gemTheme.rimBevel;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.restore();
    }

    // ─────────────────────────────────────────────────────────────────
    // 3. DIRECT FLOATING 3D REWARD ASSET ICONS (High-Contrast Float)
    // ─────────────────────────────────────────────────────────────────
    for (let i = 0; i < numSegments; i++) {
      const angle = i * arc;
      const midAngle = angle + arc / 2;
      const segment = segments[i];

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(midAngle);

      const itemDistance = innerRadius * 0.68;
      const iconRenderSize = coreSize > 200 ? 52 : 42;

      // 3A: Soft Saturated Ambient Flare behind asset
      const ambientGlow = ctx.createRadialGradient(
        itemDistance,
        0,
        1,
        itemDistance,
        0,
        iconRenderSize * 0.75
      );
      ambientGlow.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
      ambientGlow.addColorStop(0.5, 'rgba(254, 240, 138, 0.15)');
      ambientGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.beginPath();
      ctx.arc(itemDistance, 0, iconRenderSize * 0.75, 0, 2 * Math.PI);
      ctx.fillStyle = ambientGlow;
      ctx.fill();

      // 3B: Draw Image Directly on Canvas (Baked for 60/120 FPS GPU Rotation)
      if (segment.image && loadedImagesRef.current[segment.image]) {
        const img = loadedImagesRef.current[segment.image];
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 4;

        ctx.translate(itemDistance, 0);
        ctx.rotate(Math.PI / 2);

        let scale = 1;
        if (segment.image.includes('coinSack')) scale = 0.84;
        else if (segment.image.includes('SingleCoin')) scale = 0.70;

        const drawW = iconRenderSize * scale;
        const drawH = iconRenderSize * scale;
        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();
      } else if (!segment.image) {
        ctx.font = `900 ${coreSize > 200 ? 12 : 10}px Georgia, serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
        ctx.shadowBlur = 5;
        ctx.shadowOffsetY = 1;
        ctx.fillText(segment.label, itemDistance, 4);
      }

      ctx.restore();
    }

    // ─────────────────────────────────────────────────────────────────
    // 4. HIGH-GLOSS CURVED WATCH-GLASS LACQUER SHEEN
    // ─────────────────────────────────────────────────────────────────
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, innerRadius, 0, 2 * Math.PI);
    ctx.clip();

    const glassSheen = ctx.createLinearGradient(0, 0, coreSize * 0.8, coreSize * 0.8);
    glassSheen.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
    glassSheen.addColorStop(0.35, 'rgba(255, 255, 255, 0.05)');
    glassSheen.addColorStop(0.65, 'rgba(255, 255, 255, 0)');
    glassSheen.addColorStop(0.85, 'rgba(255, 255, 255, 0.04)');
    glassSheen.addColorStop(1, 'rgba(255, 255, 255, 0.12)');

    ctx.fillStyle = glassSheen;
    ctx.fill();
    ctx.restore();

    // ─────────────────────────────────────────────────────────────────
    // 5. PHOTOREALISTIC 3D ORNATE GOLDEN DIVIDER PILLARS & SOCKET JOINTS
    // ─────────────────────────────────────────────────────────────────
    for (let i = 0; i < numSegments; i++) {
      const angle = i * arc;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);

      const x0 = hubRadius + 1;
      const x1 = innerRadius - 1;
      const w0 = 2.2; // Hub end half-width
      const w1 = 3.0; // Outer rim socket half-width

      // 5A: Deep Directional Cast Shadow (Elevation above gemstone slices)
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 2.5;

      ctx.beginPath();
      ctx.moveTo(x0, -w0 - 1);
      ctx.lineTo(x1, -w1 - 1);
      ctx.lineTo(x1, w1 + 1);
      ctx.lineTo(x0, w0 + 1);
      ctx.closePath();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fill();
      ctx.restore();

      // 5B: Sculpted Tapered 3D Pillar Body (Perpendicular Metallic Gold Gradient)
      const pillarGrad = ctx.createLinearGradient(0, -w1, 0, w1);
      pillarGrad.addColorStop(0.00, '#78350f'); // Deep bronze bottom shadow
      pillarGrad.addColorStop(0.18, '#b45309'); // Burnished bronze
      pillarGrad.addColorStop(0.38, '#fbbf24'); // Radiant 24k gold body
      pillarGrad.addColorStop(0.50, '#fef9c3'); // Specular center crest ridge
      pillarGrad.addColorStop(0.68, '#f59e0b'); // Warm honey gold
      pillarGrad.addColorStop(0.85, '#d97706'); // Deep gold bevel
      pillarGrad.addColorStop(1.00, '#451a03'); // Dark edge shadow

      ctx.beginPath();
      ctx.moveTo(x0, -w0);
      ctx.lineTo(x1 - 3, -w1);
      ctx.arc(x1 - 3, 0, w1, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(x0, w0);
      ctx.arc(x0, 0, w0, Math.PI / 2, -Math.PI / 2);
      ctx.closePath();
      ctx.fillStyle = pillarGrad;
      ctx.fill();

      // 5C: Center Ridge Specular Highlight Line
      const crestGrad = ctx.createLinearGradient(x0, 0, x1, 0);
      crestGrad.addColorStop(0.0, 'rgba(254, 240, 138, 0.3)');
      crestGrad.addColorStop(0.25, '#ffffff');
      crestGrad.addColorStop(0.75, '#fef08a');
      crestGrad.addColorStop(1.0, 'rgba(254, 240, 138, 0.3)');

      ctx.beginPath();
      ctx.moveTo(x0 + 3, -0.4);
      ctx.lineTo(x1 - 5, -0.4);
      ctx.strokeStyle = crestGrad;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // 5D: Inner Hub Socket Clasp Bracket
      const hubSocketGrad = ctx.createRadialGradient(
        x0 + 1, -1, 0,
        x0 + 1, 0, w0 * 1.5
      );
      hubSocketGrad.addColorStop(0.0, '#ffffff');
      hubSocketGrad.addColorStop(0.3, '#fef08a');
      hubSocketGrad.addColorStop(0.7, '#d97706');
      hubSocketGrad.addColorStop(1.0, '#582803');

      ctx.beginPath();
      ctx.arc(x0 + 1, 0, w0 * 1.3, 0, 2 * Math.PI);
      ctx.fillStyle = hubSocketGrad;
      ctx.fill();

      // 5E: Outer 3D Spherical Ball Socket Rivet
      const rivetX = x1 - 3.5;
      const rivetR = 4.2;

      const rivetGrad = ctx.createRadialGradient(
        rivetX - 1.2, -1.2, 0,
        rivetX, 0, rivetR
      );
      rivetGrad.addColorStop(0.0, '#ffffff');
      rivetGrad.addColorStop(0.25, '#fef08a');
      rivetGrad.addColorStop(0.60, '#fbbf24');
      rivetGrad.addColorStop(0.85, '#ca8a04');
      rivetGrad.addColorStop(1.00, '#451a03');

      ctx.beginPath();
      ctx.arc(rivetX, 0, rivetR, 0, 2 * Math.PI);
      ctx.fillStyle = rivetGrad;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 2;
      ctx.fill();
      ctx.shadowColor = 'transparent';

      ctx.restore();
    }

    // ─────────────────────────────────────────────────────────────────
    // 6. INNER ROTATING HUB COLLAR BINDING RING
    // ─────────────────────────────────────────────────────────────────
    ctx.beginPath();
    ctx.arc(cx, cy, hubRadius + 3, 0, 2 * Math.PI);
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }, [segments, coreSize, hubSize, loadedCount]);

  useEffect(() => {
    drawWheel();
  }, [drawWheel]);

  // ═══════════════════════════════════════════════════════════════════
  // INSTANT-START CASINO SPIN ENGINE (0ms UI Latency + Exact Alignment)
  // ═══════════════════════════════════════════════════════════════════
  const cumulativeRotationRef = useRef(0);

  const spin = async () => {
    if (isSpinning || segments.length === 0) return;

    // Check balance if 0 spins & < 1,000 diamonds
    if (spins <= 0 && diamonds < 1000) {
      if (onOutOfSpins) onOutOfSpins();
      return;
    }

    setIsSpinning(true);
    haptics.impact('heavy');
    haptics.playClickSound();

    try {
      // 1. Resolve target segment (starts instantly upon user tap)
      let targetIndex = 0;
      let serverResultData: any = null;

      if (onSpinRequest) {
        const response = await onSpinRequest();
        if (typeof response === 'number') {
          targetIndex = response;
        } else if (response && typeof response.targetIndex === 'number') {
          targetIndex = response.targetIndex;
          serverResultData = response;
        }
      } else {
        targetIndex = Math.floor(Math.random() * segments.length);
      }

      targetIndex = ((targetIndex % segments.length) + segments.length) % segments.length;

      // 2. EXACT SEGMENT LANDING CALCULATION
      const numSegments = segments.length;
      const degreesPerSegment = 360 / numSegments;

      // Center of this segment in canvas coordinate system (0° = 3 o'clock)
      const segmentCenterAngle = targetIndex * degreesPerSegment + degreesPerSegment / 2;
      // Controlled safe jitter inside segment (±10° in 60° slice - never touches borders)
      const jitter = (Math.random() - 0.5) * (degreesPerSegment * 0.35);

      // Top flapper pointer is at 12 o'clock (270°)
      const targetStopMod = (270 - (segmentCenterAngle + jitter) + 3600) % 360;
      const currentMod = cumulativeRotationRef.current % 360;
      const forwardDelta = (targetStopMod - currentMod + 360) % 360;

      // 7 full dramatic rotations (2520°) for rich authentic wheel spin
      const extraFullSpins = 7;
      const finalTargetRotation = cumulativeRotationRef.current + extraFullSpins * 360 + forwardDelta;
      cumulativeRotationRef.current = finalTargetRotation;

      // 3. CONTINUOUS SMOOTH DECELERATION CURVE (Single uninterrupted physics transition, zero speed hitch/jerk)
      const decelDuration = spinDuration || 3400;
      if (coreWrapperRef.current) {
        coreWrapperRef.current.style.transition = `transform ${decelDuration}ms cubic-bezier(0.12, 0.8, 0.15, 1.0)`;
        coreWrapperRef.current.style.transform = `rotate(${finalTargetRotation}deg)`;
      }

      // 4. LANDING RESOLUTION
      setTimeout(() => {
        setIsSpinning(false);
        const winner = segments[targetIndex];
        if (onSpinEnd) {
          onSpinEnd(winner, serverResultData);
        }
      }, decelDuration);
    } catch (err) {
      console.error('Spin request error:', err);
      setIsSpinning(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // 20 CASINO MARQUEE LIGHT BULBS ON STATIC FRAME
  // ═══════════════════════════════════════════════════════════════════
  const BULB_COUNT = 20;
  const bulbRadius = size / 2 - 5.5;

  const bulbs = Array.from({ length: BULB_COUNT }).map((_, i) => {
    const angle = (i * 2 * Math.PI) / BULB_COUNT;
    const x = size / 2 + Math.cos(angle) * bulbRadius;
    const y = size / 2 + Math.sin(angle) * bulbRadius;
    const isEven = i % 2 === 0;

    return { x, y, isEven };
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
        userSelect: 'none',
        width: `${size}px`,
        height: `${size}px`
      }}
    >
      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. ATMOSPHERIC ROTATING SUNBURST LIGHT RAYS                   */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div
        className="sunburst-rays"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: `${size * 1.5}px`,
          height: `${size * 1.5}px`,
          borderRadius: '50%',
          opacity: isSpinning ? 0.7 : 0.35,
          transition: 'opacity 0.6s ease',
          pointerEvents: 'none',
          zIndex: 0
        }}
      />

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. AMBIENT EMERALD-GOLD HALO GLOW                             */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: `${size * 1.25}px`,
          height: `${size * 1.25}px`,
          borderRadius: '50%',
          background: isSpinning
            ? 'radial-gradient(circle, rgba(250, 204, 21, 0.35) 0%, rgba(16, 185, 129, 0.22) 45%, rgba(0,0,0,0) 75%)'
            : 'radial-gradient(circle, rgba(16, 185, 129, 0.25) 0%, rgba(0,0,0,0) 70%)',
          pointerEvents: 'none',
          zIndex: 1,
          transition: 'all 0.6s ease',
          filter: 'blur(10px)'
        }}
      />

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. ROTATING INNER WHEEL CORE (Sitting under hollow frame)     */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          top: `${(size - coreSize) / 2}px`,
          left: `${(size - coreSize) / 2}px`,
          width: `${coreSize}px`,
          height: `${coreSize}px`,
          borderRadius: '50%',
          overflow: 'hidden',
          zIndex: 4,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.7)'
        }}
      >
        <div
          ref={coreWrapperRef}
          style={{
            width: '100%',
            height: '100%',
            position: 'relative',
            transform: 'rotate(0deg)'
          }}
        >
          <canvas
            ref={canvasRef}
            style={{
              width: '100%',
              height: '100%',
              display: 'block'
            }}
          />
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 4. STATIC HOLLOW CASINO FRAME OVERLAY (100% Hollow Center)    */}
      {/* ───────────────────────────────────────────────────────────── */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 300 300"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: `${size}px`,
          height: `${size}px`,
          pointerEvents: 'none',
          zIndex: 10
        }}
      >
        <defs>
          {/* Metallic Gold Beveled Frame Gradient */}
          <linearGradient id="frameGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="18%" stopColor="#ca8a04" />
            <stop offset="38%" stopColor="#fef08a" />
            <stop offset="60%" stopColor="#854d0e" />
            <stop offset="82%" stopColor="#eab308" />
            <stop offset="100%" stopColor="#ca8a04" />
          </linearGradient>

          {/* Mask ensuring center is completely hollow */}
          <mask id="hollowFrameMask">
            <rect x="0" y="0" width="300" height="300" fill="white" />
            <circle cx="150" cy="150" r="126" fill="black" />
          </mask>
        </defs>

        {/* Outer Heavy Gold Beveled Ring */}
        <g mask="url(#hollowFrameMask)">
          <circle cx="150" cy="150" r="149" fill="url(#frameGoldGrad)" />
          {/* Recessed Dark Channel */}
          <circle cx="150" cy="150" r="139" fill="#060913" stroke="rgba(234, 179, 8, 0.5)" strokeWidth="1" />
        </g>

        {/* Outer Gold Rim Highlight & Shadow Strokes */}
        <circle cx="150" cy="150" r="148.5" fill="none" stroke="rgba(254, 240, 138, 0.7)" strokeWidth="1.2" />
        <circle cx="150" cy="150" r="144" fill="none" stroke="#582803" strokeWidth="0.8" />
        <circle cx="150" cy="150" r="126.5" fill="none" stroke="rgba(254, 240, 138, 0.6)" strokeWidth="1.5" />

        {/* Golden Micro-Bead Pearl Track */}
        <circle
          cx="150"
          cy="150"
          r="133"
          fill="none"
          stroke="#fbbf24"
          strokeWidth="2.4"
          strokeDasharray="2.2 4.2"
          strokeLinecap="round"
        />

        {/* 4 Corner Metallic Fastener Studs */}
        {[45, 135, 225, 315].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          const sx = 150 + Math.cos(rad) * 144;
          const sy = 150 + Math.sin(rad) * 144;
          return (
            <circle
              key={deg}
              cx={sx}
              cy={sy}
              r="2.5"
              fill="#ffffff"
              stroke="#ca8a04"
              strokeWidth="0.8"
            />
          );
        })}
      </svg>

      {/* 20 Marquee Bulbs Mounted on Gold Rim Ring (Pure CSS GPU Animation) */}
      {bulbs.map((bulb, idx) => (
        <div
          key={idx}
          className={`bulb-chaser ${bulb.isEven ? 'bulb-even' : 'bulb-odd'} ${isSpinning ? 'spinning' : ''}`}
          style={{
            left: `${bulb.x}px`,
            top: `${bulb.y}px`
          }}
        />
      ))}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 5. TOP 3D ORNATE POINTER FLAPPER WITH RUBY GEMSTONE            */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          top: '-10px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '34px',
          height: '42px',
          zIndex: 30,
          filter: 'drop-shadow(0 6px 12px rgba(0, 0, 0, 0.8))',
          pointerEvents: 'none'
        }}
      >
        <svg width="100%" height="100%" viewBox="0 0 38 46" fill="none">
          <defs>
            <linearGradient id="flapperGold" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="30%" stopColor="#eab308" />
              <stop offset="65%" stopColor="#854d0e" />
              <stop offset="100%" stopColor="#ca8a04" />
            </linearGradient>
            <radialGradient id="rubyGlow" cx="40%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#fca5a5" />
              <stop offset="35%" stopColor="#f43f5e" />
              <stop offset="75%" stopColor="#be123c" />
              <stop offset="100%" stopColor="#4c0519" />
            </radialGradient>
          </defs>

          {/* Gold Pointer Body */}
          <path
            d="M19 44 L3 14 Q3 4 19 4 Q35 4 35 14 Z"
            fill="url(#flapperGold)"
            stroke="#582803"
            strokeWidth="1.5"
          />

          {/* Inner Highlight Ridge */}
          <path
            d="M19 40 L6 14 Q6 7 19 7 Q32 7 32 14 Z"
            fill="none"
            stroke="rgba(254, 240, 138, 0.6)"
            strokeWidth="1"
          />

          {/* Faceted Ruby Jewel Cabochon */}
          <circle cx="19" cy="15" r="5.5" fill="url(#rubyGlow)" stroke="#ffffff" strokeWidth="0.8" />
          <circle cx="19" cy="15" r="7" fill="none" stroke="rgba(244, 63, 94, 0.5)" strokeWidth="1.5" />
          <circle cx="17.5" cy="13.5" r="1.2" fill="#ffffff" />
        </svg>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 6. CENTER 3D TACTILE SPIN BUTTON WITH HEAVY GOLD COLLAR       */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: `${hubSize}px`,
          height: `${hubSize}px`,
          zIndex: 25
        }}
      >
        {/* Outer Heavy Gold Beveled Collar Frame */}
        <div
          style={{
            position: 'absolute',
            inset: '-4px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #fef08a 0%, #ca8a04 35%, #854d0e 70%, #fef08a 100%)',
            boxShadow: '0 6px 16px rgba(0,0,0,0.8), inset 0 2px 3px rgba(255,255,255,0.7)',
            border: '1px solid rgba(254, 240, 138, 0.8)'
          }}
        />

        {/* 3D Tactile Dynamic SPIN Button */}
        {(() => {
          const hasFreeSpins = (spins ?? 0) > 0;
          const hasDiamonds = !hasFreeSpins && (diamonds ?? 0) >= 1000;
          const isOutOfSpins = !hasFreeSpins && !hasDiamonds;

          const handleButtonClick = () => {
            if (isSpinning) return;
            if (isOutOfSpins) {
              haptics.notification('warning');
              onOutOfSpins?.();
              return;
            }
            spin();
          };

          return (
            <button
              onClick={handleButtonClick}
              disabled={isSpinning}
              onMouseDown={() => !isSpinning && setIsButtonPressed(true)}
              onMouseUp={() => setIsButtonPressed(false)}
              onMouseLeave={() => setIsButtonPressed(false)}
              onTouchStart={() => !isSpinning && setIsButtonPressed(true)}
              onTouchEnd={() => setIsButtonPressed(false)}
              style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                background: isSpinning
                  ? 'linear-gradient(180deg, #475569 0%, #1e293b 100%)'
                  : hasFreeSpins
                  ? `
                    radial-gradient(circle at 35% 30%, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 45%),
                    linear-gradient(180deg, #22c55e 0%, #059669 55%, #047857 100%)
                  `
                  : hasDiamonds
                  ? `
                    radial-gradient(circle at 35% 30%, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 45%),
                    linear-gradient(180deg, #a855f7 0%, #7e22ce 55%, #581c87 100%)
                  `
                  : 'linear-gradient(180deg, #334155 0%, #1e293b 100%)',
                color: '#ffffff',
                border: isSpinning
                  ? '2px solid #64748b'
                  : hasFreeSpins
                  ? '2.5px solid #fbbf24'
                  : hasDiamonds
                  ? '2.5px solid #fde047'
                  : '2px solid rgba(248, 113, 113, 0.7)',
                boxShadow: isButtonPressed
                  ? '0 1px 0 #022c22, inset 0 5px 12px rgba(0,0,0,0.8)'
                  : isSpinning
                  ? '0 2px 0 #0f172a, inset 0 2px 4px rgba(0,0,0,0.4)'
                  : hasFreeSpins
                  ? '0 6px 0 #064e3b, 0 12px 18px rgba(0,0,0,0.75), inset 0 2px 4px rgba(255,255,255,0.6)'
                  : hasDiamonds
                  ? '0 6px 0 #3b0764, 0 12px 18px rgba(126, 34, 206, 0.45), inset 0 2px 4px rgba(255,255,255,0.6)'
                  : '0 4px 0 #0f172a, 0 8px 12px rgba(0,0,0,0.6)',
                fontSize: coreSize > 200 ? '0.92rem' : '0.78rem',
                fontWeight: 900,
                fontFamily: 'Georgia, serif',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                cursor: isSpinning ? 'not-allowed' : 'pointer',
                transition: 'all 0.08s ease',
                transform: isButtonPressed ? 'translateY(4px)' : 'translateY(0)',
                textShadow: '0 2px 4px rgba(0,0,0,0.7), 0 0 8px rgba(251, 191, 36, 0.4)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                overflow: 'hidden',
                lineHeight: 1.1
              }}
            >
              {isSpinning ? (
                <span>...</span>
              ) : (
                <>
                  <span style={{ fontSize: coreSize > 200 ? '0.86rem' : '0.74rem', fontWeight: 900 }}>SPIN</span>
                  <span
                    style={{
                      fontSize: coreSize > 200 ? '0.55rem' : '0.48rem',
                      fontWeight: 800,
                      marginTop: '1px',
                      color: hasFreeSpins
                        ? '#fef08a'
                        : hasDiamonds
                        ? '#fde68a'
                        : '#fca5a5',
                      textShadow: '0 1px 2px rgba(0,0,0,0.8)'
                    }}
                  >
                    {hasFreeSpins ? `${spins} 🎟️` : hasDiamonds ? '1,000 💎' : '1,000 💎'}
                  </span>
                </>
              )}
            </button>
          );
        })()}
      </div>
    </div>
  );
};
