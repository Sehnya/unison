/**
 * Username Effect Renderer
 * 
 * Renders animated text effects using Canvas 2D.
 * Each effect is a function that draws styled text onto a canvas per frame.
 * 
 * Effects: chrome, neon, holographic, fire, ice, gold, glitch, none
 */

export type UsernameEffect = 'none' | 'chrome' | 'neon' | 'holographic' | 'fire' | 'ice' | 'gold' | 'glitch';

export const EFFECT_LABELS: Record<UsernameEffect, string> = {
  none: 'None',
  chrome: 'Chrome',
  neon: 'Neon Glow',
  holographic: 'Holographic',
  fire: 'Fire',
  ice: 'Ice',
  gold: 'Gold',
  glitch: 'Glitch',
};

interface ActiveTarget {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  text: string;
  effect: UsernameEffect;
  color: string;
  font: string;
  width: number;
  height: number;
  dpr: number;
}

type EffectDrawFn = (ctx: CanvasRenderingContext2D, t: ActiveTarget, time: number) => void;

function drawBase(ctx: CanvasRenderingContext2D, t: ActiveTarget) {
  const fontSize = Math.floor(t.height * t.dpr * 0.65);
  ctx.font = `600 ${fontSize}px '${t.font}', sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
}

const effects: Record<UsernameEffect, EffectDrawFn> = {
  none(ctx, t) {
    drawBase(ctx, t);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, 4, t.canvas.height / 2);
  },

  chrome(ctx, t, time) {
    drawBase(ctx, t);
    const w = t.canvas.width;
    const y = t.canvas.height / 2;
    // Animated gradient sweep
    const offset = ((Math.sin(time * 1.5) + 1) / 2) * w;
    const grad = ctx.createLinearGradient(offset - w * 0.3, 0, offset + w * 0.3, 0);
    grad.addColorStop(0, '#888');
    grad.addColorStop(0.3, '#fff');
    grad.addColorStop(0.5, '#ccc');
    grad.addColorStop(0.7, '#fff');
    grad.addColorStop(1, '#888');
    ctx.fillStyle = grad;
    ctx.fillText(t.text, 4, y);
  },

  neon(ctx, t, time) {
    drawBase(ctx, t);
    const y = t.canvas.height / 2;
    const pulse = 0.7 + 0.3 * Math.sin(time * 3);
    // Outer glow layers
    ctx.save();
    ctx.shadowColor = t.color;
    ctx.shadowBlur = 20 * pulse * t.dpr;
    ctx.fillStyle = t.color;
    ctx.globalAlpha = 0.4;
    ctx.fillText(t.text, 4, y);
    ctx.globalAlpha = 0.6;
    ctx.shadowBlur = 10 * pulse * t.dpr;
    ctx.fillText(t.text, 4, y);
    ctx.restore();
    // Core text
    ctx.save();
    ctx.shadowColor = t.color;
    ctx.shadowBlur = 4 * t.dpr;
    ctx.fillStyle = '#fff';
    ctx.fillText(t.text, 4, y);
    ctx.restore();
  },

  holographic(ctx, t, time) {
    drawBase(ctx, t);
    const w = t.canvas.width;
    const y = t.canvas.height / 2;
    const shift = time * 80;
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    const steps = 6;
    for (let i = 0; i <= steps; i++) {
      const pos = i / steps;
      const hue = ((pos * 360) + shift) % 360;
      grad.addColorStop(pos, `hsl(${hue}, 100%, 70%)`);
    }
    ctx.fillStyle = grad;
    ctx.fillText(t.text, 4, y);
    // Scanline overlay
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#000';
    const lineH = 2 * t.dpr;
    for (let sy = 0; sy < t.canvas.height; sy += lineH * 2) {
      ctx.fillRect(0, sy, w, lineH);
    }
    ctx.restore();
  },

  fire(ctx, t, time) {
    drawBase(ctx, t);
    const w = t.canvas.width;
    const h = t.canvas.height;
    const y = h / 2;
    // Base fire gradient
    const grad = ctx.createLinearGradient(0, h, 0, 0);
    grad.addColorStop(0, '#ff4500');
    grad.addColorStop(0.4, '#ff8c00');
    grad.addColorStop(0.8, '#ffd700');
    grad.addColorStop(1, '#fff8dc');
    ctx.fillStyle = grad;
    ctx.fillText(t.text, 4, y);
    // Flicker overlay
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    const flicker = 0.85 + 0.15 * Math.sin(time * 15 + Math.sin(time * 7) * 3);
    ctx.globalAlpha = 1 - flicker;
    ctx.fillStyle = '#ff4500';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  },

  ice(ctx, t, time) {
    drawBase(ctx, t);
    const w = t.canvas.width;
    const y = t.canvas.height / 2;
    const shimmer = ((Math.sin(time * 2) + 1) / 2) * w;
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#a0d2db');
    grad.addColorStop(0.3, '#d4f1f9');
    grad.addColorStop(0.5, '#ffffff');
    grad.addColorStop(0.7, '#d4f1f9');
    grad.addColorStop(1, '#a0d2db');
    ctx.fillStyle = grad;
    ctx.fillText(t.text, 4, y);
    // Sparkle highlight
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    const sparkGrad = ctx.createRadialGradient(shimmer, y, 0, shimmer, y, 40 * t.dpr);
    sparkGrad.addColorStop(0, 'rgba(255,255,255,0.6)');
    sparkGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sparkGrad;
    ctx.fillRect(0, 0, w, t.canvas.height);
    ctx.restore();
  },

  gold(ctx, t, time) {
    drawBase(ctx, t);
    const w = t.canvas.width;
    const y = t.canvas.height / 2;
    const shineX = ((Math.sin(time * 1.5) + 1) / 2) * w;
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#b8860b');
    grad.addColorStop(0.3, '#daa520');
    grad.addColorStop(0.5, '#ffd700');
    grad.addColorStop(0.7, '#daa520');
    grad.addColorStop(1, '#b8860b');
    ctx.fillStyle = grad;
    ctx.fillText(t.text, 4, y);
    // Shine sweep
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    const shineGrad = ctx.createRadialGradient(shineX, y, 0, shineX, y, 50 * t.dpr);
    shineGrad.addColorStop(0, 'rgba(255,250,220,0.7)');
    shineGrad.addColorStop(1, 'rgba(255,250,220,0)');
    ctx.fillStyle = shineGrad;
    ctx.fillRect(0, 0, w, t.canvas.height);
    ctx.restore();
  },

  glitch(ctx, t, time) {
    drawBase(ctx, t);
    const y = t.canvas.height / 2;
    const glitchActive = Math.sin(time * 10) > 0.92;
    if (glitchActive) {
      // Red channel offset
      ctx.save();
      ctx.fillStyle = 'rgba(255,0,0,0.7)';
      ctx.fillText(t.text, 4 + 3 * t.dpr, y);
      ctx.fillStyle = 'rgba(0,255,255,0.7)';
      ctx.fillText(t.text, 4 - 3 * t.dpr, y);
      ctx.restore();
    }
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, 4, y);
    // Random slice displacement
    if (glitchActive) {
      const sliceY = Math.random() * t.canvas.height;
      const sliceH = 4 * t.dpr;
      const sliceShift = (Math.random() - 0.5) * 10 * t.dpr;
      const imgData = ctx.getImageData(0, sliceY, t.canvas.width, sliceH);
      ctx.putImageData(imgData, sliceShift, sliceY);
    }
  },
};

class UsernameRendererSingleton {
  private activeTargets: Map<string, ActiveTarget> = new Map();
  private animationId: number | null = null;
  private startTime: number = Date.now();

  register(
    id: string,
    text: string,
    effect: UsernameEffect,
    color: string,
    font: string,
    width: number,
    height: number
  ): HTMLCanvasElement {
    // Clean up existing
    this.unregister(id);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(width * dpr);
    canvas.height = Math.ceil(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d')!;

    const target: ActiveTarget = { canvas, ctx, text, effect, color, font, width, height, dpr };
    this.activeTargets.set(id, target);

    // Draw first frame immediately
    this.drawTarget(target, 0);

    // Start animation loop if this is an animated effect
    if (effect !== 'none') {
      this.startAnimationLoop();
    }

    return canvas;
  }

  update(
    id: string,
    text: string,
    effect: UsernameEffect,
    color: string,
    font: string,
    width: number,
    height: number
  ): HTMLCanvasElement {
    return this.register(id, text, effect, color, font, width, height);
  }

  unregister(id: string) {
    this.activeTargets.delete(id);
    if (this.activeTargets.size === 0) {
      this.stopAnimationLoop();
    }
  }

  private drawTarget(target: ActiveTarget, time: number) {
    const { ctx, canvas } = target;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const drawFn = effects[target.effect];
    if (drawFn) {
      drawFn(ctx, target, time);
    }
  }

  private startAnimationLoop() {
    if (this.animationId !== null) return;
    const loop = () => {
      this.animationId = requestAnimationFrame(loop);
      const time = (Date.now() - this.startTime) / 1000;
      for (const [, target] of this.activeTargets) {
        if (target.effect !== 'none') {
          this.drawTarget(target, time);
        }
      }
    };
    this.animationId = requestAnimationFrame(loop);
  }

  private stopAnimationLoop() {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  dispose() {
    this.stopAnimationLoop();
    this.activeTargets.clear();
  }
}

export const usernameRenderer = new UsernameRendererSingleton();
