/**
 * Username Layout System
 * 
 * Types, shape presets, animation presets, and snap/grid helpers
 * for the Canva-like username letter arrangement editor.
 */

export interface LetterPosition {
  char: string;
  x: number;       // percentage 0-100 of canvas width
  y: number;       // percentage 0-100 of canvas height
  rotation: number; // degrees
  scale: number;    // 1 = normal
  index: number;    // original index in username
}

export type ShapePreset = 'line' | 'circle' | 'arc' | 'square' | 'diamond' | 'cross' | 'wave' | 'spiral' | 'scatter' | 'stack';

export type HoverAnimation = 'none' | 'teleprompter' | 'zoom' | 'space-out' | 'space-in' | 'wave' | 'bounce' | 'spin' | 'float';

export interface UsernameLayoutConfig {
  letters: LetterPosition[];
  font: string;
  fontSize: number;
  color: string;
  effect: string;
  hoverAnimation: HoverAnimation;
  canvasWidth: number;
  canvasHeight: number;
}

export const SHAPE_PRESETS: { id: ShapePreset; label: string; icon: string }[] = [
  { id: 'line',    label: 'Line',    icon: '—' },
  { id: 'circle',  label: 'Circle',  icon: '○' },
  { id: 'arc',     label: 'Arc',     icon: '⌒' },
  { id: 'square',  label: 'Square',  icon: '□' },
  { id: 'diamond', label: 'Diamond', icon: '◇' },
  { id: 'cross',   label: 'Cross',   icon: '✚' },
  { id: 'wave',    label: 'Wave',    icon: '∿' },
  { id: 'spiral',  label: 'Spiral',  icon: '🌀' },
  { id: 'scatter', label: 'Scatter', icon: '✦' },
  { id: 'stack',   label: 'Stack',   icon: '☰' },
];

export const HOVER_ANIMATIONS: { id: HoverAnimation; label: string }[] = [
  { id: 'none',        label: 'None' },
  { id: 'teleprompter', label: 'Teleprompter' },
  { id: 'zoom',        label: 'Zoom In' },
  { id: 'space-out',   label: 'Space Out' },
  { id: 'space-in',    label: 'Space In' },
  { id: 'wave',        label: 'Wave' },
  { id: 'bounce',      label: 'Bounce' },
  { id: 'spin',        label: 'Spin' },
  { id: 'float',       label: 'Float Up' },
];

// Grid snap settings
const GRID_SIZE = 5; // percentage
const SNAP_THRESHOLD = 2.5; // percentage

export function snapToGrid(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

export function getSnapGuides(
  dragging: LetterPosition,
  others: LetterPosition[]
): { horizontal: number[]; vertical: number[] } {
  const horizontal: number[] = [];
  const vertical: number[] = [];

  for (const other of others) {
    if (other.index === dragging.index) continue;
    if (Math.abs(other.x - dragging.x) < SNAP_THRESHOLD) {
      vertical.push(other.x);
    }
    if (Math.abs(other.y - dragging.y) < SNAP_THRESHOLD) {
      horizontal.push(other.y);
    }
  }
  // Center guides
  if (Math.abs(dragging.x - 50) < SNAP_THRESHOLD) vertical.push(50);
  if (Math.abs(dragging.y - 50) < SNAP_THRESHOLD) horizontal.push(50);

  return { horizontal, vertical };
}

export function snapToGuides(
  pos: { x: number; y: number },
  others: LetterPosition[],
  dragIndex: number
): { x: number; y: number; guidesH: number[]; guidesV: number[] } {
  let { x, y } = pos;
  const guidesH: number[] = [];
  const guidesV: number[] = [];

  // Snap to center
  if (Math.abs(x - 50) < SNAP_THRESHOLD) { x = 50; guidesV.push(50); }
  if (Math.abs(y - 50) < SNAP_THRESHOLD) { y = 50; guidesH.push(50); }

  // Snap to other letters
  for (const other of others) {
    if (other.index === dragIndex) continue;
    if (Math.abs(other.x - x) < SNAP_THRESHOLD) { x = other.x; guidesV.push(other.x); }
    if (Math.abs(other.y - y) < SNAP_THRESHOLD) { y = other.y; guidesH.push(other.y); }
  }

  return { x, y, guidesH, guidesV };
}

/**
 * Generate letter positions for a given shape preset.
 * All coordinates are in percentage (0-100) of canvas dimensions.
 */
export function generateShape(
  username: string,
  shape: ShapePreset,
  _canvasWidth: number,
  _canvasHeight: number
): LetterPosition[] {
  const chars = username.split('');
  const n = chars.length;
  if (n === 0) return [];

  const cx = 50;
  const cy = 50;
  const pos = (char: string, index: number, x: number, y: number, rotation = 0, scale = 1): LetterPosition =>
    ({ char, index, x, y, rotation, scale });

  switch (shape) {
    case 'line':
      return chars.map((c, i) =>
        pos(c, i, n === 1 ? cx : 15 + (i / (n - 1)) * 70, cy)
      );

    case 'circle': {
      // Even circle, radius fits inside canvas with margin
      const r = Math.min(30, 18 + n);
      return chars.map((c, i) => {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        return pos(c, i, cx + Math.cos(a) * r, cy + Math.sin(a) * r, (a * 180 / Math.PI) + 90);
      });
    }

    case 'arc': {
      const r = 32;
      const totalSpread = Math.min(Math.PI * 0.9, 0.25 + n * 0.18);
      return chars.map((c, i) => {
        const a = n === 1 ? -Math.PI / 2 : -Math.PI / 2 - totalSpread / 2 + (i / (n - 1)) * totalSpread;
        return pos(c, i, cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.7, (a * 180 / Math.PI) + 90);
      });
    }

    case 'square': {
      // Distribute letters evenly along a square perimeter
      const half = 28; // half side length in %
      const perim = half * 8; // total perimeter
      return chars.map((c, i) => {
        const d = (i / n) * perim;
        let x: number, y: number;
        if (d < half * 2) {
          // Top edge: left to right
          x = cx - half + d;
          y = cy - half;
        } else if (d < half * 4) {
          // Right edge: top to bottom
          x = cx + half;
          y = cy - half + (d - half * 2);
        } else if (d < half * 6) {
          // Bottom edge: right to left
          x = cx + half - (d - half * 4);
          y = cy + half;
        } else {
          // Left edge: bottom to top
          x = cx - half;
          y = cy + half - (d - half * 6);
        }
        return pos(c, i, x, y);
      });
    }

    case 'diamond': {
      // Diamond: top → right → bottom → left
      const half = 28;
      const perim = half * 4 * Math.SQRT2; // approximate
      return chars.map((c, i) => {
        const t = (i / n) * 4; // 0-4 around the diamond
        let x: number, y: number;
        if (t < 1) {
          // Top to right
          x = cx + t * half;
          y = cy - half + t * half;
        } else if (t < 2) {
          const s = t - 1;
          // Right to bottom
          x = cx + half - s * half;
          y = cy + s * half;
        } else if (t < 3) {
          const s = t - 2;
          // Bottom to left
          x = cx - s * half;
          y = cy + half - s * half;
        } else {
          const s = t - 3;
          // Left to top
          x = cx - half + s * half;
          y = cy - s * half;
        }
        return pos(c, i, x, y);
      });
    }

    case 'cross': {
      // Horizontal row through center, vertical column through center
      // Interleave: even indices go horizontal, odd go vertical
      const hCount = Math.ceil(n / 2);
      const vCount = n - hCount;
      return chars.map((c, i) => {
        if (i % 2 === 0) {
          // Horizontal
          const hi = Math.floor(i / 2);
          const x = hCount === 1 ? cx : 18 + (hi / (hCount - 1)) * 64;
          return pos(c, i, x, cy);
        } else {
          // Vertical
          const vi = Math.floor(i / 2);
          const y = vCount === 1 ? cy : 18 + (vi / Math.max(vCount - 1, 1)) * 64;
          return pos(c, i, cx, y);
        }
      });
    }

    case 'wave':
      return chars.map((c, i) => {
        const frac = n === 1 ? 0.5 : i / (n - 1);
        return pos(c, i, 10 + frac * 80, cy + Math.sin(frac * Math.PI * 2) * 18);
      });

    case 'spiral': {
      const maxR = 28;
      const turns = 1.2;
      return chars.map((c, i) => {
        const t = n === 1 ? 0.5 : i / (n - 1);
        const a = t * Math.PI * 2 * turns - Math.PI / 2;
        const r = 4 + t * maxR;
        return pos(c, i, cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.8, a * 180 / Math.PI, 0.7 + t * 0.5);
      });
    }

    case 'scatter': {
      // Seeded pseudo-random so it's consistent per character
      return chars.map((c, i) => {
        const seed = i * 7919 + c.charCodeAt(0) * 104729;
        const rx = ((Math.sin(seed) * 43758.5453) % 1 + 1) % 1;
        const ry = ((Math.sin(seed + 1) * 43758.5453) % 1 + 1) % 1;
        const rr = ((Math.sin(seed + 2) * 43758.5453) % 1 + 1) % 1;
        return pos(c, i, 15 + rx * 70, 15 + ry * 70, (rr - 0.5) * 40, 0.8 + rr * 0.4);
      });
    }

    case 'stack':
      return chars.map((c, i) =>
        pos(c, i, cx, n === 1 ? cy : 12 + (i / (n - 1)) * 76)
      );

    default:
      return generateShape(username, 'line', _canvasWidth, _canvasHeight);
  }
}

export function createDefaultLayout(username: string, font: string, color: string, effect: string): UsernameLayoutConfig {
  return {
    letters: generateShape(username, 'line', 400, 200),
    font,
    fontSize: 24,
    color,
    effect,
    hoverAnimation: 'none',
    canvasWidth: 400,
    canvasHeight: 200,
  };
}
