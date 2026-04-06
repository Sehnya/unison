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
 * Generate letter positions for a given shape preset
 */
export function generateShape(
  username: string,
  shape: ShapePreset,
  canvasWidth: number,
  canvasHeight: number
): LetterPosition[] {
  const chars = username.split('');
  const n = chars.length;
  if (n === 0) return [];

  const cx = 50; // center x %
  const cy = 50; // center y %

  switch (shape) {
    case 'line':
      return chars.map((char, i) => ({
        char, index: i,
        x: n === 1 ? cx : 15 + (i / (n - 1)) * 70,
        y: cy,
        rotation: 0, scale: 1,
      }));

    case 'circle': {
      const radius = Math.min(35, 20 + n * 1.5);
      return chars.map((char, i) => {
        const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
        return {
          char, index: i,
          x: cx + Math.cos(angle) * radius,
          y: cy + Math.sin(angle) * radius * (canvasWidth / canvasHeight),
          rotation: (angle * 180 / Math.PI) + 90,
          scale: 1,
        };
      });
    }

    case 'arc': {
      const radius = 35;
      const spread = Math.min(Math.PI, n * 0.35);
      const startAngle = -Math.PI / 2 - spread / 2;
      return chars.map((char, i) => {
        const angle = n === 1 ? -Math.PI / 2 : startAngle + (i / (n - 1)) * spread;
        return {
          char, index: i,
          x: cx + Math.cos(angle) * radius,
          y: cy + Math.sin(angle) * radius * 0.8,
          rotation: (angle * 180 / Math.PI) + 90,
          scale: 1,
        };
      });
    }

    case 'square': {
      const size = 30;
      const perimeter = 4 * size * 2;
      return chars.map((char, i) => {
        const t = (i / n) * perimeter;
        let x = cx, y = cy;
        if (t < size * 2) {
          x = cx - size + t; y = cy - size;
        } else if (t < size * 4) {
          x = cx + size; y = cy - size + (t - size * 2);
        } else if (t < size * 6) {
          x = cx + size - (t - size * 4); y = cy + size;
        } else {
          x = cx - size; y = cy + size - (t - size * 6);
        }
        return { char, index: i, x, y, rotation: 0, scale: 1 };
      });
    }

    case 'diamond': {
      const size = 30;
      return chars.map((char, i) => {
        const t = (i / n) * 4;
        let x = cx, y = cy;
        if (t < 1) {
          x = cx + t * size; y = cy - t * size;
        } else if (t < 2) {
          const s = t - 1;
          x = cx + size - s * size; y = cy - size + s * size;
        } else if (t < 3) {
          const s = t - 2;
          x = cx - s * size; y = cy + s * size;
        } else {
          const s = t - 3;
          x = cx - size + s * size; y = cy + size - s * size;
        }
        return { char, index: i, x, y, rotation: 0, scale: 1 };
      });
    }

    case 'cross': {
      const half = Math.floor(n / 2);
      return chars.map((char, i) => {
        if (i < half) {
          return {
            char, index: i,
            x: n === 1 ? cx : 20 + (i / Math.max(half - 1, 1)) * 60,
            y: cy,
            rotation: 0, scale: 1,
          };
        } else {
          const j = i - half;
          const vCount = n - half;
          return {
            char, index: i,
            x: cx,
            y: vCount === 1 ? cy : 20 + (j / Math.max(vCount - 1, 1)) * 60,
            rotation: 0, scale: 1,
          };
        }
      });
    }

    case 'wave':
      return chars.map((char, i) => ({
        char, index: i,
        x: n === 1 ? cx : 10 + (i / (n - 1)) * 80,
        y: cy + Math.sin((i / n) * Math.PI * 2) * 20,
        rotation: 0, scale: 1,
      }));

    case 'spiral': {
      const maxRadius = 30;
      const turns = 1.5;
      return chars.map((char, i) => {
        const t = i / n;
        const angle = t * Math.PI * 2 * turns;
        const r = t * maxRadius;
        return {
          char, index: i,
          x: cx + Math.cos(angle) * r,
          y: cy + Math.sin(angle) * r * 0.8,
          rotation: angle * 180 / Math.PI,
          scale: 0.7 + t * 0.5,
        };
      });
    }

    case 'scatter':
      return chars.map((char, i) => ({
        char, index: i,
        x: 15 + Math.random() * 70,
        y: 15 + Math.random() * 70,
        rotation: (Math.random() - 0.5) * 40,
        scale: 0.8 + Math.random() * 0.4,
      }));

    case 'stack':
      return chars.map((char, i) => ({
        char, index: i,
        x: cx,
        y: n === 1 ? cy : 10 + (i / (n - 1)) * 80,
        rotation: 0, scale: 1,
      }));

    default:
      return generateShape(username, 'line', canvasWidth, canvasHeight);
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
