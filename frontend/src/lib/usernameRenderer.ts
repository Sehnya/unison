/**
 * Shared WebGL Username Renderer
 * 
 * Single offscreen Three.js renderer that draws 3D text effects for all
 * visible usernames. Each username gets rendered to an offscreen target,
 * then the pixels are copied to individual <canvas> elements.
 * 
 * Effects: chrome, neon, holographic, fire, ice, gold, glitch, none
 */

import * as THREE from 'three';

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

interface RenderRequest {
  id: string;
  text: string;
  effect: UsernameEffect;
  color: string;
  font: string;
  width: number;
  height: number;
  resolve: (canvas: HTMLCanvasElement) => void;
}

// Shader chunks for different effects
const EFFECT_SHADERS: Record<UsernameEffect, { vertex: string; fragment: string }> = {
  none: {
    vertex: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragment: `
      uniform sampler2D tText;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        vec4 texel = texture2D(tText, vUv);
        gl_FragColor = vec4(uColor * texel.rgb, texel.a);
      }
    `,
  },
  chrome: {
    vertex: `
      varying vec2 vUv;
      varying vec3 vNormal;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragment: `
      uniform sampler2D tText;
      uniform float uTime;
      uniform vec3 uColor;
      varying vec2 vUv;
      varying vec3 vNormal;
      void main() {
        vec4 texel = texture2D(tText, vUv);
        if (texel.a < 0.1) discard;
        float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);
        vec3 reflection = vec3(
          0.7 + 0.3 * sin(uTime + vUv.x * 6.0),
          0.7 + 0.3 * sin(uTime * 1.3 + vUv.x * 6.0 + 2.0),
          0.8 + 0.2 * sin(uTime * 0.7 + vUv.x * 6.0 + 4.0)
        );
        vec3 color = mix(uColor * 0.6, reflection, fresnel * 0.7 + 0.3);
        float specular = pow(max(0.0, dot(reflect(vec3(-0.5, 0.5, -1.0), vNormal), vec3(0.0, 0.0, 1.0))), 32.0);
        color += vec3(specular * 0.5);
        gl_FragColor = vec4(color, texel.a);
      }
    `,
  },
  neon: {
    vertex: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragment: `
      uniform sampler2D tText;
      uniform float uTime;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        vec4 texel = texture2D(tText, vUv);
        if (texel.a < 0.05) discard;
        float pulse = 0.85 + 0.15 * sin(uTime * 3.0);
        float glow = smoothstep(0.0, 0.5, texel.a) * pulse;
        vec3 neonColor = uColor * 1.5;
        vec3 outerGlow = uColor * 0.4 * (1.0 - smoothstep(0.1, 0.6, texel.a));
        vec3 color = mix(outerGlow, neonColor, glow);
        float alpha = smoothstep(0.0, 0.15, texel.a) * pulse;
        gl_FragColor = vec4(color, alpha);
      }
    `,
  },
  holographic: {
    vertex: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragment: `
      uniform sampler2D tText;
      uniform float uTime;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        vec4 texel = texture2D(tText, vUv);
        if (texel.a < 0.1) discard;
        float shift = vUv.x * 10.0 + uTime * 2.0;
        vec3 rainbow = vec3(
          0.5 + 0.5 * sin(shift),
          0.5 + 0.5 * sin(shift + 2.094),
          0.5 + 0.5 * sin(shift + 4.189)
        );
        float scanline = 0.95 + 0.05 * sin(vUv.y * 80.0 + uTime * 5.0);
        vec3 color = mix(uColor, rainbow, 0.6) * scanline;
        gl_FragColor = vec4(color * 1.2, texel.a);
      }
    `,
  },
  fire: {
    vertex: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragment: `
      uniform sampler2D tText;
      uniform float uTime;
      uniform vec3 uColor;
      varying vec2 vUv;
      
      float noise(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
      }
      
      void main() {
        vec4 texel = texture2D(tText, vUv);
        if (texel.a < 0.1) discard;
        float flicker = noise(vec2(vUv.x * 4.0, uTime * 3.0)) * 0.3;
        float gradient = 1.0 - vUv.y;
        vec3 fireColor = mix(
          vec3(1.0, 0.2, 0.0),
          vec3(1.0, 0.8, 0.0),
          gradient + flicker
        );
        vec3 color = mix(uColor * 0.3, fireColor, 0.8);
        float alpha = texel.a * (0.85 + flicker * 0.5);
        gl_FragColor = vec4(color, alpha);
      }
    `,
  },
  ice: {
    vertex: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragment: `
      uniform sampler2D tText;
      uniform float uTime;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        vec4 texel = texture2D(tText, vUv);
        if (texel.a < 0.1) discard;
        float shimmer = 0.9 + 0.1 * sin(vUv.x * 20.0 + uTime * 2.0) * sin(vUv.y * 20.0 - uTime);
        vec3 iceColor = mix(
          vec3(0.6, 0.85, 1.0),
          vec3(0.9, 0.95, 1.0),
          sin(vUv.x * 8.0 + uTime) * 0.5 + 0.5
        );
        vec3 color = mix(uColor * 0.4, iceColor, 0.7) * shimmer;
        gl_FragColor = vec4(color, texel.a);
      }
    `,
  },
  gold: {
    vertex: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragment: `
      uniform sampler2D tText;
      uniform float uTime;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        vec4 texel = texture2D(tText, vUv);
        if (texel.a < 0.1) discard;
        float shine = pow(sin(vUv.x * 3.14159 + uTime * 1.5) * 0.5 + 0.5, 3.0);
        vec3 goldBase = vec3(0.85, 0.65, 0.13);
        vec3 goldHighlight = vec3(1.0, 0.95, 0.6);
        vec3 color = mix(goldBase, goldHighlight, shine * 0.6);
        gl_FragColor = vec4(color, texel.a);
      }
    `,
  },
  glitch: {
    vertex: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragment: `
      uniform sampler2D tText;
      uniform float uTime;
      uniform vec3 uColor;
      varying vec2 vUv;
      
      float random(float s) {
        return fract(sin(s * 12.9898) * 43758.5453);
      }
      
      void main() {
        float glitchStrength = step(0.95, random(floor(uTime * 10.0)));
        vec2 uv = vUv;
        if (glitchStrength > 0.0) {
          float offset = (random(floor(vUv.y * 20.0) + floor(uTime * 15.0)) - 0.5) * 0.08;
          uv.x += offset;
        }
        vec4 texel = texture2D(tText, uv);
        if (texel.a < 0.1) discard;
        
        float rOffset = glitchStrength * 0.02;
        float r = texture2D(tText, uv + vec2(rOffset, 0.0)).a;
        float b = texture2D(tText, uv - vec2(rOffset, 0.0)).a;
        
        vec3 color = vec3(
          uColor.r * max(texel.a, r),
          uColor.g * texel.a,
          uColor.b * max(texel.a, b)
        );
        gl_FragColor = vec4(color, texel.a);
      }
    `,
  },
};

class UsernameRendererSingleton {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.OrthographicCamera | null = null;
  private textCanvas: HTMLCanvasElement;
  private textCtx: CanvasRenderingContext2D;
  private animationId: number | null = null;
  private activeTargets: Map<string, {
    canvas: HTMLCanvasElement;
    material: THREE.ShaderMaterial;
    mesh: THREE.Mesh;
    renderTarget: THREE.WebGLRenderTarget;
    text: string;
    effect: UsernameEffect;
    color: string;
    font: string;
    width: number;
    height: number;
  }> = new Map();
  private startTime: number = Date.now();
  private initialized = false;

  constructor() {
    // Offscreen canvas for text rasterization
    this.textCanvas = document.createElement('canvas');
    this.textCtx = this.textCanvas.getContext('2d')!;
  }

  private init() {
    if (this.initialized) return;

    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'low-power',
    });
    // Small default size — we render to offscreen targets
    this.renderer.setSize(1, 1);
    this.renderer.autoClear = false;

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.1, 10);
    this.camera.position.z = 1;

    this.initialized = true;
    this.startAnimationLoop();
  }

  /**
   * Rasterize text to a texture using Canvas 2D
   */
  private createTextTexture(text: string, font: string, width: number, height: number): THREE.CanvasTexture {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = width * dpr;
    const h = height * dpr;

    this.textCanvas.width = w;
    this.textCanvas.height = h;

    const ctx = this.textCtx;
    ctx.clearRect(0, 0, w, h);

    const fontSize = Math.floor(h * 0.65);
    ctx.font = `600 ${fontSize}px '${font}', sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, fontSize * 0.1, h / 2);

    const texture = new THREE.CanvasTexture(this.textCanvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * Register a username for rendering. Returns a canvas element
   * that will be continuously updated with the rendered effect.
   */
  register(
    id: string,
    text: string,
    effect: UsernameEffect,
    color: string,
    font: string,
    width: number,
    height: number
  ): HTMLCanvasElement {
    if (effect === 'none') {
      // Return a simple 2D canvas for 'none' effect — no WebGL needed
      return this.createSimpleCanvas(text, color, font, width, height);
    }

    this.init();

    // Clean up existing registration
    if (this.activeTargets.has(id)) {
      this.unregister(id);
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rtWidth = Math.ceil(width * dpr);
    const rtHeight = Math.ceil(height * dpr);

    const renderTarget = new THREE.WebGLRenderTarget(rtWidth, rtHeight, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    });

    const textTexture = this.createTextTexture(text, font, width, height);
    const shaders = EFFECT_SHADERS[effect];
    const colorVec = new THREE.Color(color);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        tText: { value: textTexture },
        uTime: { value: 0 },
        uColor: { value: colorVec },
      },
      vertexShader: shaders.vertex,
      fragmentShader: shaders.fragment,
      transparent: true,
      depthTest: false,
    });

    const geometry = new THREE.PlaneGeometry(1, 1);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false; // Only visible during its render pass

    this.scene!.add(mesh);

    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = rtWidth;
    outputCanvas.height = rtHeight;
    outputCanvas.style.width = `${width}px`;
    outputCanvas.style.height = `${height}px`;

    this.activeTargets.set(id, {
      canvas: outputCanvas,
      material,
      mesh,
      renderTarget,
      text,
      effect,
      color,
      font,
      width,
      height,
    });

    return outputCanvas;
  }

  /**
   * Simple 2D canvas for 'none' effect — no WebGL overhead
   */
  private createSimpleCanvas(text: string, color: string, font: string, width: number, height: number): HTMLCanvasElement {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(width * dpr);
    canvas.height = Math.ceil(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d')!;
    const fontSize = Math.floor(height * dpr * 0.65);
    ctx.font = `600 ${fontSize}px '${font}', sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(text, fontSize * 0.1, canvas.height / 2);

    return canvas;
  }

  /**
   * Update text/effect for an existing registration
   */
  update(id: string, text: string, effect: UsernameEffect, color: string, font: string, width: number, height: number): HTMLCanvasElement {
    this.unregister(id);
    return this.register(id, text, effect, color, font, width, height);
  }

  /**
   * Remove a username from the render loop
   */
  unregister(id: string) {
    const target = this.activeTargets.get(id);
    if (!target) return;

    this.scene?.remove(target.mesh);
    target.mesh.geometry.dispose();
    target.material.dispose();
    target.renderTarget.dispose();
    const textTex = target.material.uniforms['tText']?.value;
    if (textTex) textTex.dispose();

    this.activeTargets.delete(id);

    // If no more targets, stop the loop and clean up
    if (this.activeTargets.size === 0) {
      this.stopAnimationLoop();
    }
  }

  /**
   * Main animation loop — renders all active targets
   */
  private startAnimationLoop() {
    if (this.animationId !== null) return;

    const loop = () => {
      this.animationId = requestAnimationFrame(loop);
      this.renderAll();
    };
    this.animationId = requestAnimationFrame(loop);
  }

  private stopAnimationLoop() {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  private renderAll() {
    if (!this.renderer || !this.scene || !this.camera) return;

    const elapsed = (Date.now() - this.startTime) / 1000;

    for (const [, target] of this.activeTargets) {
      // Update time uniform
      target.material.uniforms['uTime']!.value = elapsed;

      // Render to offscreen target
      target.mesh.visible = true;
      this.renderer.setRenderTarget(target.renderTarget);
      this.renderer.clear();
      this.renderer.render(this.scene, this.camera);
      target.mesh.visible = false;

      // Copy pixels to the output canvas
      const ctx = target.canvas.getContext('2d');
      if (ctx) {
        const w = target.renderTarget.width;
        const h = target.renderTarget.height;
        const pixels = new Uint8Array(w * h * 4);
        this.renderer.readRenderTargetPixels(target.renderTarget, 0, 0, w, h, pixels);

        // WebGL reads bottom-up, flip vertically
        const imageData = ctx.createImageData(w, h);
        for (let y = 0; y < h; y++) {
          const srcRow = (h - 1 - y) * w * 4;
          const dstRow = y * w * 4;
          imageData.data.set(pixels.subarray(srcRow, srcRow + w * 4), dstRow);
        }
        ctx.putImageData(imageData, 0, 0);
      }
    }

    this.renderer.setRenderTarget(null);
  }

  /**
   * Clean up everything
   */
  dispose() {
    this.stopAnimationLoop();
    for (const id of this.activeTargets.keys()) {
      this.unregister(id);
    }
    this.renderer?.dispose();
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.initialized = false;
  }
}

// Singleton instance
export const usernameRenderer = new UsernameRendererSingleton();
