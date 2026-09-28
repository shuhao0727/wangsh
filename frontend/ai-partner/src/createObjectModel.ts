import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type ProceduralModelOptions = {
  wireframe?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  textureSize?: number;
  textureAnisotropy?: number;
  qualityPriority?: 'reference-fidelity' | 'balanced';
  /** Browser preview can disable extracted full-frame reference maps and use procedural materials. */
  useReferenceMaps?: boolean;
};

export type ProceduralModelRuntime = {
  nodes: Record<string, THREE.Object3D>;
  meshes: Record<string, THREE.Mesh>;
  sockets: Record<string, THREE.Object3D>;
  colliders: Record<string, unknown>;
  destructionGroups: Record<string, THREE.Object3D[]>;
};

type SculptMaterialSpec = Record<string, any>;

// THREE.CapsuleGeometry duplicates every UV-seam vertex (measured: 194 boundary
// edges on the default radius/segments below) -- same benign pattern as box/
// cylinder/sphere/torus, all of which weld cleanly to 0 given a CORRECT weld.
// (A naive vertex-only mergeVertices() reports 64 'non-manifold' edges here, but
// that is a counting artifact, not a real defect: it double-counts a handful of
// near-pole triangles that become degenerate once two of their three corners
// coincide -- confirmed by replicating subdivideCatmullClark's own degenerate-
// triangle-aware vertex identity, which finds a perfectly ordinary 2-manifold.)
// A capsule is the primary shape for skinned limbs/torso (PLAN_1.5), and skinning
// weight computation is O(vertices x bones), so fewer, guaranteed-simple vertices
// is worth having regardless -- authored as a deterministic, closed-by-
// construction mesh instead: shared pole vertices, and
// the radial index taken `% radialSegments` so the seam is never a duplicate
// vertex in the first place, rather than something to weld away afterward.
// Adapted from forge/stage5_rig/emit_rig.py's buildWatertightCapsule (verified
// there: 0 boundary edges, 0 non-manifold edges, deterministic across repeated
// runs) -- ported here rather than imported because this factory and the rig
// emitter are separate generated-output surfaces with no shared runtime module;
// see forge/tests/test_primitive_watertightness.py for the measured proof, and
// coordinate with the rig owner before changing either copy independently.
function buildWatertightCapsule(
  radius: number,
  cylLength: number,
  capSegments: number,
  radialSegments: number,
  heightSegments: number,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const uvs: number[] = [];
  const halfCyl = cylLength / 2;
  const totalSpan = 2 * (Math.PI / 2 * radius) + Math.max(0, cylLength);
  const vOf = (fromBottom: number) => (totalSpan > 0 ? fromBottom / totalSpan : 0);

  const bottomPoleIndex = positions.length / 3;
  positions.push(0, -halfCyl - radius, 0);
  uvs.push(0.5, vOf(0));

  const ringStarts: number[] = [];
  const ringV: number[] = [];
  for (let ring = 1; ring <= capSegments; ring += 1) {
    const phi = (Math.PI / 2) * (ring / capSegments);
    const y = -halfCyl - radius * Math.cos(phi);
    const r = radius * Math.sin(phi);
    const start = positions.length / 3;
    ringStarts.push(start);
    ringV.push(vOf(radius * phi));
    for (let radial = 0; radial < radialSegments; radial += 1) {
      const theta = (radial / radialSegments) * Math.PI * 2;
      positions.push(r * Math.cos(theta), y, r * Math.sin(theta));
      uvs.push(radial / radialSegments, vOf(radius * phi));
    }
  }

  const cylinderRingStarts: number[] = [];
  if (cylLength > 0) {
    for (let step = 1; step <= heightSegments; step += 1) {
      const y = -halfCyl + (cylLength * step) / heightSegments;
      const start = positions.length / 3;
      cylinderRingStarts.push(start);
      const v = vOf(radius * (Math.PI / 2) + halfCyl + y);
      for (let radial = 0; radial < radialSegments; radial += 1) {
        const theta = (radial / radialSegments) * Math.PI * 2;
        positions.push(radius * Math.cos(theta), y, radius * Math.sin(theta));
        uvs.push(radial / radialSegments, v);
      }
    }
  }

  const topRingStarts: number[] = [];
  for (let ring = capSegments - 1; ring >= 1; ring -= 1) {
    const phi = (Math.PI / 2) * (ring / capSegments);
    const y = halfCyl + radius * Math.cos(phi);
    const r = radius * Math.sin(phi);
    const start = positions.length / 3;
    topRingStarts.push(start);
    const v = vOf(radius * (Math.PI / 2) + Math.max(0, cylLength) + radius * (Math.PI / 2 - phi));
    for (let radial = 0; radial < radialSegments; radial += 1) {
      const theta = (radial / radialSegments) * Math.PI * 2;
      positions.push(r * Math.cos(theta), y, r * Math.sin(theta));
      uvs.push(radial / radialSegments, v);
    }
  }

  const topPoleIndex = positions.length / 3;
  positions.push(0, halfCyl + radius, 0);
  uvs.push(0.5, vOf(totalSpan));

  const firstBottomRing = ringStarts[0];
  for (let radial = 0; radial < radialSegments; radial += 1) {
    const next = (radial + 1) % radialSegments;
    indices.push(bottomPoleIndex, firstBottomRing + radial, firstBottomRing + next);
  }

  const allRings = [...ringStarts, ...cylinderRingStarts, ...topRingStarts];
  for (let i = 0; i < allRings.length - 1; i += 1) {
    const a = allRings[i];
    const b = allRings[i + 1];
    for (let radial = 0; radial < radialSegments; radial += 1) {
      const next = (radial + 1) % radialSegments;
      indices.push(a + radial, a + next, b + next);
      indices.push(a + radial, b + next, b + radial);
    }
  }

  const lastRing = allRings[allRings.length - 1];
  for (let radial = 0; radial < radialSegments; radial += 1) {
    const next = (radial + 1) % radialSegments;
    indices.push(topPoleIndex, lastRing + next, lastRing + radial);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function readLayerNumber(value: unknown, keys: string[], fallback: number): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of keys) {
      if (typeof record[key] === 'number') return record[key] as number;
    }
  }
  return fallback;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = /^#[0-9a-f]{3}$/i.test(hex)
    ? '#' + hex.slice(1).split('').map((part) => part + part).join('')
    : hex;
  const value = /^#[0-9a-f]{6}$/i.test(normalized) ? Number.parseInt(normalized.slice(1), 16) : 0x8a7a5f;
  return [clampAlbedoChannel((value >> 16) & 255), clampAlbedoChannel((value >> 8) & 255), clampAlbedoChannel(value & 255)];
}

function materialPalette(spec: SculptMaterialSpec): string[] {
  const palette = spec.colorVariation?.palette;
  if (Array.isArray(palette) && palette.length > 0) return palette.filter((value) => typeof value === 'string');
  const secondary = spec.albedo?.secondary;
  const colors = [spec.baseColor ?? spec.color ?? spec.albedo?.dominant, ...(Array.isArray(secondary) ? secondary : [])];
  return colors.filter((value): value is string => typeof value === 'string' && value.startsWith('#'));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampAlbedoChannel(value: number): number {
  return Math.max(30, Math.min(240, Math.round(value)));
}

function clampPbrF0(value: number): number {
  return Math.max(0.02, Math.min(1, value));
}

function clampPbrIor(value: number): number {
  return Math.max(1, Math.min(2.5, value));
}

function clampPbrMetalness(value: number): number {
  return value >= 0.5 ? 1 : 0;
}

function clampedAlbedoColor(spec: SculptMaterialSpec): THREE.Color {
  const source = typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F';
  // setStyle with an explicit SRGBColorSpace, NOT the numeric constructor.
  //
  // `new THREE.Color(r, g, b)` treats its arguments as LINEAR working-space components,
  // while an authored `baseColor` hex is sRGB. Feeding one to the other skipped the
  // transfer function and lifted every dark albedo: #2e2a28, authored as a near-black
  // vinyl, rendered at roughly sRGB 0.46 — a mid grey. The error is largest exactly where
  // it matters most, because the transfer curve is steepest near black.
  return new THREE.Color().setStyle(source, THREE.SRGBColorSpace);
}

function smoothCurve(value: number): number {
  return value * value * (3 - 2 * value);
}

function periodicHash(x: number, y: number, seed: number, periodX: number, periodY: number): number {
  const wrappedX = ((x % periodX) + periodX) % periodX;
  const wrappedY = ((y % periodY) + periodY) % periodY;
  let value = Math.imul(wrappedX + seed * 17, 374761393) ^ Math.imul(wrappedY + seed * 31, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function periodicValueNoise(u: number, v: number, seed: number, periodX: number, periodY: number): number {
  const x = u * periodX;
  const y = v * periodY;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smoothCurve(x - x0);
  const ty = smoothCurve(y - y0);
  const a = periodicHash(x0, y0, seed, periodX, periodY);
  const b = periodicHash(x0 + 1, y0, seed, periodX, periodY);
  const c = periodicHash(x0, y0 + 1, seed, periodX, periodY);
  const d = periodicHash(x0 + 1, y0 + 1, seed, periodX, periodY);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, tx), THREE.MathUtils.lerp(c, d, tx), ty);
}

type SurfaceBand = {
  frequency: number;
  amplitude: number;
  stretchX: number;
  stretchY: number;
  ridge: boolean;
};

function surfaceBands(spec: SculptMaterialSpec): SurfaceBand[] {
  const source = Array.isArray(spec.surfaceFrequencyBands) ? spec.surfaceFrequencyBands : [];
  const parsed = source.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return [];
    const band = item as Record<string, unknown>;
    const frequency = typeof band.frequency === 'number' ? band.frequency : 0;
    const amplitude = typeof band.amplitude === 'number' ? band.amplitude : 0;
    if (frequency <= 0 || amplitude <= 0) return [];
    const stretch = Array.isArray(band.stretch) ? band.stretch : [1, 1];
    const description = `${String(band.pattern ?? '')} ${String(band.role ?? '')}`.toLowerCase();
    return [{
      frequency,
      amplitude,
      stretchX: typeof stretch[0] === 'number' ? Math.max(0.1, stretch[0]) : 1,
      stretchY: typeof stretch[1] === 'number' ? Math.max(0.1, stretch[1]) : 1,
      ridge: /(ridge|groove|grain|fiber|striated|crack)/.test(description),
    }];
  });
  return parsed.length > 0 ? parsed : [
    { frequency: 2, amplitude: 0.42, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 12, amplitude: 0.22, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 56, amplitude: 0.08, stretchX: 1, stretchY: 1, ridge: false },
  ];
}

function sampleSurface(u: number, v: number, bands: SurfaceBand[], seed: number): number {
  let value = 0;
  let weight = 0;
  for (let index = 0; index < bands.length; index += 1) {
    const band = bands[index];
    const periodX = Math.max(1, Math.round(band.frequency * band.stretchX));
    const periodY = Math.max(1, Math.round(band.frequency * band.stretchY));
    let sample = periodicValueNoise(u, v, seed + index * 1013, periodX, periodY);
    if (band.ridge) sample = 1 - Math.abs(sample * 2 - 1);
    value += sample * band.amplitude;
    weight += band.amplitude;
  }
  return weight > 0 ? clamp01(value / weight) : 0.5;
}

function mixPalette(colors: [number, number, number][], value: number): [number, number, number] {
  if (colors.length === 1) return colors[0];
  const scaled = clamp01(value) * (colors.length - 1);
  const index = Math.min(colors.length - 2, Math.floor(scaled));
  const mix = scaled - index;
  const a = colors[index];
  const b = colors[index + 1];
  return [
    Math.round(THREE.MathUtils.lerp(a[0], b[0], mix)),
    Math.round(THREE.MathUtils.lerp(a[1], b[1], mix)),
    Math.round(THREE.MathUtils.lerp(a[2], b[2], mix)),
  ];
}

type ColorGradientStop = { offset: number; color: string };
type ColorGradientSpec = {
  type: 'linear' | 'radial';
  axis: [number, number];
  stops: ColorGradientStop[];
};

function parseRgba(value: string): [number, number, number] {
  const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(value);
  if (!match) return [138, 122, 95];
  return [clampAlbedoChannel(Number(match[1])), clampAlbedoChannel(Number(match[2])), clampAlbedoChannel(Number(match[3]))];
}

// Analytical per-pixel gradient sample. The extraction schema's colorGradient carries
// exact rgba(...) stop colors (see extract_part_color_recipe.py), so this samples the
// same trend directly in JS math rather than round-tripping through a Canvas 2D
// createLinearGradient/createRadialGradient object — same visual result, and it composes
// directly with the existing noise/height-correlated colorVariation blend below.
function sampleColorGradient(gradient: ColorGradientSpec, u: number, v: number): [number, number, number] {
  const stops = gradient.stops.length >= 2 ? gradient.stops : [{ offset: 0, color: 'rgba(138,122,95,1)' }, { offset: 1, color: 'rgba(138,122,95,1)' }];
  let t: number;
  if (gradient.type === 'radial') {
    const [cx, cy] = gradient.axis;
    const dx = u - cx;
    const dy = v - cy;
    const maxRadius = Math.max(0.001, Math.hypot(Math.max(cx, 1 - cx), Math.max(cy, 1 - cy)));
    t = clamp01(Math.hypot(dx, dy) / maxRadius);
  } else {
    const [ax, ay] = gradient.axis;
    const projection = (u - 0.5) * ax + (v - 0.5) * ay;
    const maxProjection = 0.5 * (Math.abs(ax) + Math.abs(ay)) || 0.5;
    t = clamp01(projection / maxProjection + 0.5);
  }
  const scaled = t * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.max(0, Math.floor(scaled)));
  const mix = scaled - index;
  const a = parseRgba(stops[index].color);
  const b = parseRgba(stops[index + 1].color);
  return [
    THREE.MathUtils.lerp(a[0], b[0], mix),
    THREE.MathUtils.lerp(a[1], b[1], mix),
    THREE.MathUtils.lerp(a[2], b[2], mix),
  ];
}

function writePixel(data: Uint8ClampedArray, offset: number, red: number, green: number, blue: number): void {
  data[offset] = Math.max(0, Math.min(255, Math.round(red)));
  data[offset + 1] = Math.max(0, Math.min(255, Math.round(green)));
  data[offset + 2] = Math.max(0, Math.min(255, Math.round(blue)));
  data[offset + 3] = 255;
}

function makeCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function createMapTexture(
  canvas: HTMLCanvasElement,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [2, 2];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 2,
    typeof repeat[1] === 'number' ? repeat[1] : 2,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

type ProceduralTextureSet = {
  albedo: THREE.Texture;
  roughness: THREE.Texture;
  height: THREE.Texture;
  normal: THREE.Texture;
  ao: THREE.Texture;
  source: 'reference-pixel-extraction' | 'procedural';
};

function referenceMapUrl(spec: SculptMaterialSpec, channel: string): string | null {
  const reference = spec.referencePbr;
  if (!reference || typeof reference !== 'object') return null;
  if (reference.usable === false) return null;
  const confidence = typeof reference.confidence === 'number'
    ? reference.confidence
    : (typeof reference.estimatedFidelity === 'number' ? reference.estimatedFidelity : 0);
  const threshold = typeof reference.targetThreshold === 'number' ? reference.targetThreshold : 0.7;
  if (confidence < threshold) return null;
  const maps = reference.maps;
  if (!maps || typeof maps !== 'object') return null;
  const map = (maps as Record<string, unknown>)[channel];
  if (!map || typeof map !== 'object') return null;
  const record = map as Record<string, unknown>;
  const url = typeof record.url === 'string' && record.url.trim() ? record.url : record.path;
  return typeof url === 'string' && url.trim() ? url : null;
}

function createLoadedMapTexture(
  url: string,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.Texture {
  const texture = new THREE.TextureLoader().load(url);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [1, 1];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 1,
    typeof repeat[1] === 'number' ? repeat[1] : 1,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

function makeReferenceTextureSet(spec: SculptMaterialSpec, options: ProceduralModelOptions): ProceduralTextureSet | null {
  const albedo = referenceMapUrl(spec, 'albedo');
  const roughness = referenceMapUrl(spec, 'roughness');
  const height = referenceMapUrl(spec, 'height');
  const normal = referenceMapUrl(spec, 'normal');
  const ao = referenceMapUrl(spec, 'ao');
  if (!albedo || !roughness || !height || !normal || !ao) return null;
  return {
    albedo: createLoadedMapTexture(albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createLoadedMapTexture(roughness, THREE.NoColorSpace, spec, options),
    height: createLoadedMapTexture(height, THREE.NoColorSpace, spec, options),
    normal: createLoadedMapTexture(normal, THREE.NoColorSpace, spec, options),
    ao: createLoadedMapTexture(ao, THREE.NoColorSpace, spec, options),
    source: 'reference-pixel-extraction',
  };
}

function makeProceduralTextureSet(
  id: string,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): ProceduralTextureSet | null {
  if (typeof document === 'undefined') return null;
  const qualityFirst = (options.qualityPriority ?? 'reference-fidelity') === 'reference-fidelity';
  const requested = options.textureSize ?? spec.textureResolution;
  const requestedSize = typeof requested === 'number' && Number.isFinite(requested)
    ? requested
    : (qualityFirst ? 1024 : 512);
  const size = Math.max(256, Math.min(2048, 2 ** Math.round(Math.log2(requestedSize))));
  const canvases = {
    albedo: makeCanvas(size),
    roughness: makeCanvas(size),
    height: makeCanvas(size),
    normal: makeCanvas(size),
    ao: makeCanvas(size),
  };
  const contexts = {
    albedo: canvases.albedo.getContext('2d'),
    roughness: canvases.roughness.getContext('2d'),
    height: canvases.height.getContext('2d'),
    normal: canvases.normal.getContext('2d'),
    ao: canvases.ao.getContext('2d'),
  };
  if (!contexts.albedo || !contexts.roughness || !contexts.height || !contexts.normal || !contexts.ao) return null;
  const images = {
    albedo: contexts.albedo.createImageData(size, size),
    roughness: contexts.roughness.createImageData(size, size),
    height: contexts.height.createImageData(size, size),
    normal: contexts.normal.createImageData(size, size),
    ao: contexts.ao.createImageData(size, size),
  };
  const seed = hashString(id);
  const bands = surfaceBands(spec);
  const heightField = new Float32Array(size * size);
  const roughnessField = new Float32Array(size * size);
  const palette = materialPalette(spec);
  const fallback = typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F';
  const colors = (palette.length >= 2 ? palette : [fallback, '#6E614B', '#A08F70']).map(hexToRgb);
  const baseRoughness = clamp01(readLayerNumber(spec.roughness, ['base'], 0.76));
  const roughnessVariation = clamp01(readLayerNumber(spec.roughness, ['variation'], 0.18));
  const colorAmplitude = clamp01(readLayerNumber(spec.colorVariation, ['amplitude', 'variation'], 0.18));
  const heightCorrelation = clamp01(readLayerNumber(spec.colorVariation, ['heightCorrelation'], 0.3));
  const colorGradient: ColorGradientSpec | undefined = spec.colorGradient;
  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const index = y * size + x;
      const height = sampleSurface(u, v, bands, seed + 101);
      const roughNoise = sampleSurface(u, v, bands, seed + 7001);
      const colorNoise = sampleSurface(u, v, bands, seed + 15013);
      heightField[index] = height;
      roughnessField[index] = clamp01(baseRoughness + (roughNoise - 0.5) * roughnessVariation * 2);
      let color: [number, number, number];
      if (colorGradient) {
        // Evidence-derived spatial gradient (Plan 1.3 Workstream C) takes priority
        // over the noise-based palette blend below — it is a measured trend, not a guess.
        color = sampleColorGradient(colorGradient, u, v);
      } else {
        const paletteValue = clamp01(
          0.5 + (colorNoise - 0.5) * colorAmplitude * 2 + (height - 0.5) * heightCorrelation
        );
        color = mixPalette(colors, paletteValue);
      }
      writePixel(images.albedo.data, index * 4, color[0], color[1], color[2]);
    }
  }
  const normalStrength = Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35));
  const aoStrength = clamp01(readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35));
  for (let y = 0; y < size; y += 1) {
    const up = ((y - 1 + size) % size) * size;
    const down = ((y + 1) % size) * size;
    for (let x = 0; x < size; x += 1) {
      const left = (x - 1 + size) % size;
      const right = (x + 1) % size;
      const index = y * size + x;
      const center = heightField[index];
      const dx = (heightField[y * size + right] - heightField[y * size + left]) * normalStrength * 6;
      const dy = (heightField[down + x] - heightField[up + x]) * normalStrength * 6;
      const inverseLength = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const normalX = -dx * inverseLength;
      const normalY = -dy * inverseLength;
      const normalZ = inverseLength;
      const neighborAverage = (
        heightField[y * size + left] + heightField[y * size + right]
        + heightField[up + x] + heightField[down + x]
      ) * 0.25;
      const cavity = Math.max(0, neighborAverage - center);
      const ao = clamp01(1 - aoStrength * (cavity * 12 + (1 - center) * 0.16));
      const offset = index * 4;
      const heightByte = center * 255;
      const roughnessByte = roughnessField[index] * 255;
      writePixel(images.height.data, offset, heightByte, heightByte, heightByte);
      writePixel(images.roughness.data, offset, roughnessByte, roughnessByte, roughnessByte);
      writePixel(
        images.normal.data, offset,
        (normalX * 0.5 + 0.5) * 255,
        (normalY * 0.5 + 0.5) * 255,
        (normalZ * 0.5 + 0.5) * 255,
      );
      writePixel(images.ao.data, offset, ao * 255, ao * 255, ao * 255);
    }
  }
  contexts.albedo.putImageData(images.albedo, 0, 0);
  contexts.roughness.putImageData(images.roughness, 0, 0);
  contexts.height.putImageData(images.height, 0, 0);
  contexts.normal.putImageData(images.normal, 0, 0);
  contexts.ao.putImageData(images.ao, 0, 0);
  return {
    albedo: createMapTexture(canvases.albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createMapTexture(canvases.roughness, THREE.NoColorSpace, spec, options),
    height: createMapTexture(canvases.height, THREE.NoColorSpace, spec, options),
    normal: createMapTexture(canvases.normal, THREE.NoColorSpace, spec, options),
    ao: createMapTexture(canvases.ao, THREE.NoColorSpace, spec, options),
    source: 'procedural',
  };
}

function createSculptMaterial(id: string, spec: SculptMaterialSpec, options: ProceduralModelOptions, denseComponent = false): THREE.MeshPhysicalMaterial {
  // A material that declares -- with evidence -- that its subject carries no texture
  // detail gets NO texture set. Synthesising one anyway is not a harmless default: the
  // branch below then forces color to white and roughness to 1 and reads both from the
  // generated maps, so the authored albedo and the reference-derived roughness are both
  // discarded, and the model gains mottling the reference does not have. Measured on the
  // tuxedo cat, whose black fur rendered as speckled grey-and-white from a palette that
  // only ever described two flat regions.
  const textureless = (spec.textureless as { declared?: boolean } | undefined)?.declared === true;
  const textures = textureless
    ? null
    : (options.useReferenceMaps === false ? null : makeReferenceTextureSet(spec, options))
      ?? makeProceduralTextureSet(id, spec, options);
  const material = new THREE.MeshPhysicalMaterial({
    color: textures ? 0xffffff : clampedAlbedoColor(spec),
    roughness: textures ? 1 : clamp01(readLayerNumber(spec.roughness, ['base'], 0.76)),
    metalness: clampPbrMetalness(readLayerNumber(spec.metalness, ['base'], 0.0)),
    clearcoat: clamp01(readLayerNumber(spec.clearcoat, ['base', 'amount'], 0)),
    clearcoatRoughness: clamp01(readLayerNumber(spec.clearcoatRoughness, ['base'], 0.25)),
    transmission: clamp01(readLayerNumber(spec.transmission, ['base', 'amount'], 0)),
    ior: clampPbrIor(readLayerNumber(spec.ior, ['base', 'value'], 1.5)),
    thickness: Math.max(0, readLayerNumber(spec.thickness, ['base', 'amount'], 0)),
    attenuationDistance: Math.max(0.001, readLayerNumber(spec.attenuationDistance, ['base', 'value'], Infinity)),
    attenuationColor: new THREE.Color(typeof spec.attenuationColor === 'string' ? spec.attenuationColor : '#ffffff'),
    sheen: clamp01(readLayerNumber(spec.sheen, ['base', 'amount'], 0)),
    sheenColor: new THREE.Color(typeof spec.sheenColor === 'string' ? spec.sheenColor : '#ffffff'),
    sheenRoughness: clamp01(readLayerNumber(spec.sheenRoughness, ['base'], 1.0)),
    iridescence: clamp01(readLayerNumber(spec.iridescence, ['base', 'amount'], 0)),
    iridescenceIOR: clampPbrIor(readLayerNumber(spec.iridescenceIOR, ['base', 'value'], 1.3)),
    anisotropy: clamp01(readLayerNumber(spec.anisotropy, ['base', 'amount'], 0)),
    anisotropyRotation: readLayerNumber(spec.anisotropy, ['rotation'], 0),
    specularIntensity: clampPbrF0(readLayerNumber(spec.specularF0 ?? spec.f0 ?? spec.specularIntensity, ['base', 'value'], 1.0)),
    specularColor: new THREE.Color(typeof spec.specularColor === 'string' ? spec.specularColor : '#ffffff'),
    emissive: new THREE.Color(typeof spec.emissive === 'string' ? spec.emissive : '#000000'),
    emissiveIntensity: Math.max(0, readLayerNumber(spec.emissiveIntensity, ['base'], 1.0)),
    opacity: clamp01(readLayerNumber(spec.opacity, ['base'], 1)),
    transparent: readLayerNumber(spec.transmission, ['base', 'amount'], 0) > 0 || readLayerNumber(spec.opacity, ['base'], 1) < 1,
    alphaTest: Math.max(0, readLayerNumber(spec.alpha, ['cutoff', 'alphaTest'], 0)),
    wireframe: options.wireframe ?? false,
    side: spec.doubleSided === true ? THREE.DoubleSide : THREE.FrontSide,
    flatShading: spec.flatShading === true,
  });
  if (textures) {
    material.map = textures.albedo;
    material.roughnessMap = textures.roughness;
    material.normalMap = textures.normal;
    material.normalScale.setScalar(Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35)));
    material.aoMap = textures.ao;
    material.aoMap.channel = 0;
    material.aoMapIntensity = readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35);
    const denseMesh = denseComponent || spec.denseMesh === true || spec.geometryDensity === 'dense' || spec.topologyClass === 'dense';
    const bumpScale = Math.max(0, readLayerNumber(spec.bump, ['amplitude', 'strength'], 0));
    const effectiveBumpScale = denseMesh ? Math.max(0.05, bumpScale) : bumpScale;
    if (effectiveBumpScale > 0) {
      material.bumpMap = textures.height;
      material.bumpScale = effectiveBumpScale;
    }
    const displacementScale = Math.max(0, readLayerNumber(spec.displacement, ['amplitude', 'strength'], 0));
    const effectiveDisplacementScale = denseMesh ? Math.max(0.005, displacementScale) : displacementScale;
    if (effectiveDisplacementScale > 0) {
      material.displacementMap = textures.height;
      material.displacementScale = effectiveDisplacementScale;
      material.displacementBias = -effectiveDisplacementScale * 0.5;
    }
  }
  material.envMapIntensity = readLayerNumber(spec, ['envMapIntensity'], 0.8);
  material.userData.sculptMaterial = spec;
  material.userData.proceduralMapsIndependent = true;
  material.userData.pbrConstraints = { albedoRange: [30, 240], binaryMetalness: true, f0Range: [0.02, 1], iorRange: [1, 2.5] };
  material.userData.pbrTextureSource = textures?.source ?? 'flat-fallback';
  material.userData.referencePbr = spec.referencePbr ?? null;
  material.userData.referenceMaterialId = spec.referenceMaterialId ?? spec.materialReference?.profileId ?? null;
  material.userData.materialEvidence = spec.materialEvidence ?? null;
  material.userData.validationViews = spec.materialReference?.validationViews ?? [];
  material.needsUpdate = true;
  return material;
}

type AttachmentEndpoint = {
  start: THREE.Vector3;
  midpoint: THREE.Vector3;
  quaternion: THREE.Quaternion;
  length: number;
  baseRadius: number;
  endRadius: number;
};

function readVector3(value: unknown, fallback: [number, number, number]): THREE.Vector3 {
  if (Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === 'number')) {
    return new THREE.Vector3(value[0], value[1], value[2]);
  }
  return new THREE.Vector3(fallback[0], fallback[1], fallback[2]);
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function makeAttachmentEndpoint(attachment: unknown): AttachmentEndpoint | null {
  if (!attachment || typeof attachment !== 'object') return null;
  const record = attachment as Record<string, unknown>;
  const start = readVector3(record.localStart, [0, 0, 0]);
  const end = readVector3(record.localEnd, [0, 1, 0]);
  const delta = end.clone().sub(start);
  const length = delta.length();
  if (length <= 0.0001) return null;
  const direction = delta.clone().normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  const baseRadius = Math.max(0.005, readNumber(record.baseRadius, 0.06));
  const endRadius = Math.max(0.003, readNumber(record.endRadius, baseRadius * 0.55));
  return {
    start,
    midpoint: delta.multiplyScalar(0.5),
    quaternion,
    length,
    baseRadius,
    endRadius,
  };
}

// Generated from ObjectSculptSpec target: AI Classmate Educational Robot
// Sculpt build pass: blockout
// This factory is intentionally pass-gated. Finish browser screenshot review before unlocking deeper passes.
export function createAIClassmateEducationalRobotModel(options: ProceduralModelOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = "AI Classmate Educational Robot";
  root.userData.reconstructionEvidence = {"itemFamily": null, "subtype": null, "componentAdapter": null, "route": null, "exactnessTier": null, "referenceCamera": {"solved": false, "fovDegrees": 40.0, "aspect": 1.0, "orientation": {"yaw": 0.0, "pitch": 0.0, "roll": 0.0}, "positionHint": [0.0, 0.0, 3.0], "note": "For likeness work, solve the reference camera (forge/stage1_intake/solve_camera_pose.py) so the review render aligns with the photo and the reference can be projected. Confirm by overlay review."}, "approximationNotes": []};
  root.userData.materialPipeline = {"schemaVersion": 1, "status": "proceed", "registry": "material-reference.json", "regions": [{"regionId": "shell", "componentId": "head", "specMaterialId": "warm-shell", "profileId": "reference-pbr-shell"}, {"regionId": "body", "componentId": "torso", "specMaterialId": "navy-polymer", "profileId": "reference-pbr-body"}, {"regionId": "joint", "componentId": "left-elbow", "specMaterialId": "rubber-trim", "profileId": "reference-pbr-joint"}, {"regionId": "visor", "componentId": "visor", "specMaterialId": "cyan-emissive", "profileId": "reference-pbr-visor"}]};
  root.userData.materialReferenceRegistry = "material-reference.json";

  const materialMap: Record<string, THREE.Material> = {};
  materialMap["warm-shell"] = createSculptMaterial(
    "warm-shell",
    {"id": "warm-shell", "name": "浅暖白外壳", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#F1EEE7", "color": "#F1EEE7", "albedo": {"dominant": "#F1EEE7", "secondary": ["#D5D6D3"], "samplingNotes": "参考图局部采样后的主色与次色区间。"}, "colorVariation": {"palette": ["#F1EEE7", "#D5D6D3"], "pattern": "subtle-zone-variation", "amplitude": 0.08, "heightCorrelation": 0.18}, "textureResolution": 1024, "textureProjection": {"mode": "generated-uv", "repeat": [1.0, 1.0], "anisotropy": 8, "texelDensityIntent": "保持对象尺度稳定，局部不因部件缩放而拉伸。"}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.8, "amplitude": 0.18, "role": "broad color zones and silhouette-scale response"}, {"id": "meso", "frequency": 8.0, "amplitude": 0.08, "role": "bevel and seam response"}, {"id": "micro", "frequency": 42.0, "amplitude": 0.035, "role": "soft highlight breakup"}], "roughness": {"base": 0.62, "variation": 0.12, "map": "shell_roughness.png", "localResponse": "局部接缝与凹陷处粗糙度提高，边缘高光略降低。"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "shell_normal.png", "strength": 0.22, "scale": 18.0, "space": "tangent"}, "bump": {"pattern": "shell_height.png", "amplitude": 0.035, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.32, "contactShadowBias": 0.34, "notes": "接缝、关节和嵌入式发光件周围独立AO响应。"}, "wear": {"edgeWear": 0.06, "scratches": [], "chips": []}, "dirt": {"amount": 0.02, "cavityBias": 0.18, "color": "#172131"}, "localOverrides": [{"id": "shell-highlight", "region": "outer bevels", "roughness": 0.38, "color": "#F8F6F1"}], "referencePbr": {"version": "1.0", "sourceImage": "/Users/wsh/Documents/Codex/项目/img2threejs-试用/robot-v1/generated/reference.png", "extractor": "extract_pbr_evidence.py", "method": "reference-pixel-extraction", "verdict": "pass", "hardLimit": "single-image PBR is an estimate", "usable": true, "confidence": 0.86, "estimatedFidelity": 0.86, "targetThreshold": 0.7, "maps": {"albedo": {"path": "/Users/wsh/Documents/Codex/项目/img2threejs-试用/robot-v1/material-evidence/shell/shell_albedo.png", "url": "material-evidence/shell/shell_albedo.png", "channel": "albedo"}, "roughness": {"path": "/Users/wsh/Documents/Codex/项目/img2threejs-试用/robot-v1/material-evidence/shell/shell_roughness.png", "url": "material-evidence/shell/shell_roughness.png", "channel": "roughness"}, "height": {"path": "/Users/wsh/Documents/Codex/项目/img2threejs-试用/robot-v1/material-evidence/shell/shell_height.png", "url": "material-evidence/shell/shell_height.png", "channel": "height"}, "normal": {"path": "/Users/wsh/Documents/Codex/项目/img2threejs-试用/robot-v1/material-evidence/shell/shell_normal.png", "url": "material-evidence/shell/shell_normal.png", "channel": "normal"}, "ao": {"path": "/Users/wsh/Documents/Codex/项目/img2threejs-试用/robot-v1/material-evidence/shell/shell_ao.png", "url": "material-evidence/shell/shell_ao.png", "channel": "ambient-occlusion"}}}, "shaderNotes": ["使用独立albedo、roughness、height、normal和AO通道；不将albedo复用为其他通道。"], "notes": "课堂教学用材质近似，不宣称真实硬件材质。"},
    options
  );
  materialMap["navy-polymer"] = createSculptMaterial(
    "navy-polymer",
    {"id": "navy-polymer", "name": "深蓝色聚合物", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#20344F", "color": "#20344F", "albedo": {"dominant": "#20344F", "secondary": ["#141E2B"], "samplingNotes": "参考图局部采样后的主色与次色区间。"}, "colorVariation": {"palette": ["#20344F", "#141E2B"], "pattern": "subtle-zone-variation", "amplitude": 0.08, "heightCorrelation": 0.18}, "textureResolution": 1024, "textureProjection": {"mode": "generated-uv", "repeat": [1.0, 1.0], "anisotropy": 8, "texelDensityIntent": "保持对象尺度稳定，局部不因部件缩放而拉伸。"}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.8, "amplitude": 0.18, "role": "broad color zones and silhouette-scale response"}, {"id": "meso", "frequency": 8.0, "amplitude": 0.08, "role": "bevel and seam response"}, {"id": "micro", "frequency": 42.0, "amplitude": 0.035, "role": "soft highlight breakup"}], "roughness": {"base": 0.48, "variation": 0.12, "map": "body_roughness.png", "localResponse": "局部接缝与凹陷处粗糙度提高，边缘高光略降低。"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "body_normal.png", "strength": 0.22, "scale": 18.0, "space": "tangent"}, "bump": {"pattern": "body_height.png", "amplitude": 0.035, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.32, "contactShadowBias": 0.34, "notes": "接缝、关节和嵌入式发光件周围独立AO响应。"}, "wear": {"edgeWear": 0.06, "scratches": [], "chips": []}, "dirt": {"amount": 0.02, "cavityBias": 0.18, "color": "#172131"}, "localOverrides": [], "referencePbr": {"version": "1.0", "sourceImage": "/Users/wsh/Documents/Codex/项目/img2threejs-试用/robot-v1/generated/reference.png", "extractor": "extract_pbr_evidence.py", "method": "reference-pixel-extraction", "verdict": "pass", "hardLimit": "single-image PBR is an estimate", "usable": true, "confidence": 0.86, "estimatedFidelity": 0.86, "targetThreshold": 0.7, "maps": {"albedo": {"path": "/Users/wsh/Documents/Codex/项目/img2threejs-试用/robot-v1/material-evidence/body/body_albedo.png", "url": "material-evidence/body/body_albedo.png", "channel": "albedo"}, "roughness": {"path": "/Users/wsh/Documents/Codex/项目/img2threejs-试用/robot-v1/material-evidence/body/body_roughness.png", "url": "material-evidence/body/body_roughness.png", "channel": "roughness"}, "height": {"path": "/Users/wsh/Documents/Codex/项目/img2threejs-试用/robot-v1/material-evidence/body/body_height.png", "url": "material-evidence/body/body_height.png", "channel": "height"}, "normal": {"path": "/Users/wsh/Documents/Codex/项目/img2threejs-试用/robot-v1/material-evidence/body/body_normal.png", "url": "material-evidence/body/body_normal.png", "channel": "normal"}, "ao": {"path": "/Users/wsh/Documents/Codex/项目/img2threejs-试用/robot-v1/material-evidence/body/body_ao.png", "url": "material-evidence/body/body_ao.png", "channel": "ambient-occlusion"}}}, "shaderNotes": ["使用独立albedo、roughness、height、normal和AO通道；不将albedo复用为其他通道。"], "notes": "课堂教学用材质近似，不宣称真实硬件材质。"},
    options
  );
  materialMap["cyan-emissive"] = createSculptMaterial(
    "cyan-emissive",
    {"id": "cyan-emissive", "name": "青色发光材料", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#57E8FA", "color": "#57E8FA", "albedo": {"dominant": "#57E8FA", "secondary": ["#20B3D3"], "samplingNotes": "参考图局部采样后的主色与次色区间。"}, "colorVariation": {"palette": ["#57E8FA", "#20B3D3"], "pattern": "subtle-zone-variation", "amplitude": 0.08, "heightCorrelation": 0.18}, "textureResolution": 1024, "textureProjection": {"mode": "generated-uv", "repeat": [1.0, 1.0], "anisotropy": 8, "texelDensityIntent": "保持对象尺度稳定，局部不因部件缩放而拉伸。"}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.8, "amplitude": 0.18, "role": "broad color zones and silhouette-scale response"}, {"id": "meso", "frequency": 8.0, "amplitude": 0.08, "role": "bevel and seam response"}, {"id": "micro", "frequency": 42.0, "amplitude": 0.035, "role": "soft highlight breakup"}], "roughness": {"base": 0.28, "variation": 0.12, "map": "visor_roughness.png", "localResponse": "局部接缝与凹陷处粗糙度提高，边缘高光略降低。"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "visor_normal.png", "strength": 0.22, "scale": 18.0, "space": "tangent"}, "bump": {"pattern": "visor_height.png", "amplitude": 0.035, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.32, "contactShadowBias": 0.34, "notes": "接缝、关节和嵌入式发光件周围独立AO响应。"}, "wear": {"edgeWear": 0.06, "scratches": [], "chips": []}, "dirt": {"amount": 0.02, "cavityBias": 0.18, "color": "#172131"}, "localOverrides": [], "referencePbr": {"version": "1.0", "sourceImage": "/Users/wsh/Documents/Codex/项目/img2threejs-试用/robot-v1/generated/reference.png", "extractor": "extract_pbr_evidence.py", "method": "reference-pixel-extraction", "verdict": "pass", "hardLimit": "single-image PBR is an estimate", "usable": true, "confidence": 0.86, "estimatedFidelity": 0.86, "targetThreshold": 0.7, "maps": {"albedo": {"path": "/Users/wsh/Documents/Codex/项目/img2threejs-试用/robot-v1/material-evidence/visor/visor_albedo.png", "url": "material-evidence/visor/visor_albedo.png", "channel": "albedo"}, "roughness": {"path": "/Users/wsh/Documents/Codex/项目/img2threejs-试用/robot-v1/material-evidence/visor/visor_roughness.png", "url": "material-evidence/visor/visor_roughness.png", "channel": "roughness"}, "height": {"path": "/Users/wsh/Documents/Codex/项目/img2threejs-试用/robot-v1/material-evidence/visor/visor_height.png", "url": "material-evidence/visor/visor_height.png", "channel": "height"}, "normal": {"path": "/Users/wsh/Documents/Codex/项目/img2threejs-试用/robot-v1/material-evidence/visor/visor_normal.png", "url": "material-evidence/visor/visor_normal.png", "channel": "normal"}, "ao": {"path": "/Users/wsh/Documents/Codex/项目/img2threejs-试用/robot-v1/material-evidence/visor/visor_ao.png", "url": "material-evidence/visor/visor_ao.png", "channel": "ambient-occlusion"}}}, "shaderNotes": ["使用独立albedo、roughness、height、normal和AO通道；不将albedo复用为其他通道。"], "notes": "课堂教学用材质近似，不宣称真实硬件材质。"},
    options
  );
  materialMap["rubber-trim"] = createSculptMaterial(
    "rubber-trim",
    {"id": "rubber-trim", "name": "深色橡胶边", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#141E2B", "color": "#141E2B", "albedo": {"dominant": "#141E2B", "secondary": ["#304056"], "samplingNotes": "参考图局部采样后的主色与次色区间。"}, "colorVariation": {"palette": ["#141E2B", "#304056"], "pattern": "subtle-zone-variation", "amplitude": 0.08, "heightCorrelation": 0.18}, "textureResolution": 1024, "textureProjection": {"mode": "generated-uv", "repeat": [1.0, 1.0], "anisotropy": 8, "texelDensityIntent": "保持对象尺度稳定，局部不因部件缩放而拉伸。"}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.8, "amplitude": 0.18, "role": "broad color zones and silhouette-scale response"}, {"id": "meso", "frequency": 8.0, "amplitude": 0.08, "role": "bevel and seam response"}, {"id": "micro", "frequency": 42.0, "amplitude": 0.035, "role": "soft highlight breakup"}], "roughness": {"base": 0.62, "variation": 0.12, "map": "joint_roughness.png", "localResponse": "局部接缝与凹陷处粗糙度提高，边缘高光略降低。"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "joint_normal.png", "strength": 0.22, "scale": 18.0, "space": "tangent"}, "bump": {"pattern": "joint_height.png", "amplitude": 0.035, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.32, "contactShadowBias": 0.34, "notes": "接缝、关节和嵌入式发光件周围独立AO响应。"}, "wear": {"edgeWear": 0.06, "scratches": [], "chips": []}, "dirt": {"amount": 0.02, "cavityBias": 0.18, "color": "#172131"}, "localOverrides": [], "referencePbr": {"version": "1.0", "sourceImage": "/Users/wsh/Documents/Codex/项目/img2threejs-试用/robot-v1/generated/reference.png", "extractor": "extract_pbr_evidence.py", "method": "reference-pixel-extraction", "verdict": "pass", "hardLimit": "single-image PBR is an estimate", "usable": true, "confidence": 0.86, "estimatedFidelity": 0.86, "targetThreshold": 0.7, "maps": {"albedo": {"path": "/Users/wsh/Documents/Codex/项目/img2threejs-试用/robot-v1/material-evidence/joint/joint_albedo.png", "url": "material-evidence/joint/joint_albedo.png", "channel": "albedo"}, "roughness": {"path": "/Users/wsh/Documents/Codex/项目/img2threejs-试用/robot-v1/material-evidence/joint/joint_roughness.png", "url": "material-evidence/joint/joint_roughness.png", "channel": "roughness"}, "height": {"path": "/Users/wsh/Documents/Codex/项目/img2threejs-试用/robot-v1/material-evidence/joint/joint_height.png", "url": "material-evidence/joint/joint_height.png", "channel": "height"}, "normal": {"path": "/Users/wsh/Documents/Codex/项目/img2threejs-试用/robot-v1/material-evidence/joint/joint_normal.png", "url": "material-evidence/joint/joint_normal.png", "channel": "normal"}, "ao": {"path": "/Users/wsh/Documents/Codex/项目/img2threejs-试用/robot-v1/material-evidence/joint/joint_ao.png", "url": "material-evidence/joint/joint_ao.png", "channel": "ambient-occlusion"}}}, "shaderNotes": ["使用独立albedo、roughness、height、normal和AO通道；不将albedo复用为其他通道。"], "notes": "课堂教学用材质近似，不宣称真实硬件材质。"},
    options
  );

  const nodes: Record<string, THREE.Object3D> = { root };
  const meshes: Record<string, THREE.Mesh> = {};
  const sockets: Record<string, THREE.Object3D> = {};
  const colliders: Record<string, unknown> = {};
  const destructionGroups: Record<string, THREE.Object3D[]> = {};

  const endpoint_root_0 = makeAttachmentEndpoint(null);
  const node_root_0 = new THREE.Group();
  node_root_0.name = "AI\u540c\u5b66\u6574\u4f53__pivot";
  node_root_0.scale.set(1, 1, 1);
  if (endpoint_root_0) {
    node_root_0.position.copy(endpoint_root_0.start);
    node_root_0.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_root_0.position.set(0.0, 0.0, 0.0);
    node_root_0.rotation.set(0.0, 0.0, 0.0);
  }
  node_root_0.userData.sculptComponent = {"id": "root", "name": "AI同学整体", "level": "macro", "role": "root", "importance": 0.82, "confidence": 0.86, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "可见部件具有独立边界、装配接缝或明确发光表面，按组合实体分别建模。", "geometryDescriptor": {"topologyIntent": "rounded assembled volume with softened edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.04, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 3.15, "height": 6.1, "depth": 1.8, "units": "relative", "confidence": 0.84}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.86}, "transformChannels": {"translate": false, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "课堂交互用简化碰撞代理"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "navy-polymer"}}, "material": "warm-shell", "materialLayers": ["warm-shell"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["overall-silhouette"], "surfaceDetail": {"macroRoughness": 0.42, "microRoughness": 0.15, "bumpAmplitude": 0.04, "normalPattern": "soft molded plastic micro-breakup", "displacementPattern": "none", "occlusionPattern": "contact seams and joint cavities", "edgeWearPattern": "subtle edge highlight", "notes": "教学示意模型，保留可读的形体与材质差异"}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "structural-pass", "colorMaterialRecipe": {"dominantAlbedo": "rgba(241, 238, 231, 1.0)", "secondaryAlbedo": "rgba(213, 214, 211, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.88, "colorGradient": {"type": "linear", "stops": [{"position": 0, "color": "rgba(241, 238, 231, 1.0)"}, {"position": 1, "color": "rgba(213, 214, 211, 1.0)"}]}}};
  node_root_0.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.86}, "transformChannels": {"translate": false, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "课堂交互用简化碰撞代理"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "navy-polymer"}};
  (nodes["root"] ?? root).add(node_root_0);
  nodes["root"] = node_root_0;
  const mesh_root_0Geometry = endpoint_root_0
    ? new THREE.CylinderGeometry(endpoint_root_0.endRadius, endpoint_root_0.baseRadius, endpoint_root_0.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_root_0) {
    mesh_root_0Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_root_0 = new THREE.Mesh(
    mesh_root_0Geometry,
    materialMap["warm-shell"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_root_0.name = "AI\u540c\u5b66\u6574\u4f53";
  if (endpoint_root_0) {
    mesh_root_0.position.copy(endpoint_root_0.midpoint);
    mesh_root_0.quaternion.copy(endpoint_root_0.quaternion);
  }
  mesh_root_0.castShadow = options.castShadow ?? true;
  mesh_root_0.receiveShadow = options.receiveShadow ?? true;
  mesh_root_0.userData.sculptComponent = {"id": "root", "name": "AI同学整体", "level": "macro", "role": "root", "importance": 0.82, "confidence": 0.86, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "可见部件具有独立边界、装配接缝或明确发光表面，按组合实体分别建模。", "geometryDescriptor": {"topologyIntent": "rounded assembled volume with softened edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.04, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 3.15, "height": 6.1, "depth": 1.8, "units": "relative", "confidence": 0.84}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.86}, "transformChannels": {"translate": false, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "课堂交互用简化碰撞代理"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "navy-polymer"}}, "material": "warm-shell", "materialLayers": ["warm-shell"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["overall-silhouette"], "surfaceDetail": {"macroRoughness": 0.42, "microRoughness": 0.15, "bumpAmplitude": 0.04, "normalPattern": "soft molded plastic micro-breakup", "displacementPattern": "none", "occlusionPattern": "contact seams and joint cavities", "edgeWearPattern": "subtle edge highlight", "notes": "教学示意模型，保留可读的形体与材质差异"}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "structural-pass", "colorMaterialRecipe": {"dominantAlbedo": "rgba(241, 238, 231, 1.0)", "secondaryAlbedo": "rgba(213, 214, 211, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.88, "colorGradient": {"type": "linear", "stops": [{"position": 0, "color": "rgba(241, 238, 231, 1.0)"}, {"position": 1, "color": "rgba(213, 214, 211, 1.0)"}]}}};
  node_root_0.add(mesh_root_0);
  meshes["root"] = mesh_root_0;
  colliders["root"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "课堂交互用简化碰撞代理"};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_root_0);

  const endpoint_torso_1 = makeAttachmentEndpoint(null);
  const node_torso_1 = new THREE.Group();
  node_torso_1.name = "\u8eaf\u5e72\u5916\u58f3__pivot";
  node_torso_1.scale.set(1, 1, 1);
  if (endpoint_torso_1) {
    node_torso_1.position.copy(endpoint_torso_1.start);
    node_torso_1.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_torso_1.position.set(0.0, 1.75, 0.0);
    node_torso_1.rotation.set(0.0, 0.0, 0.0);
  }
  node_torso_1.userData.sculptComponent = {"id": "torso", "name": "躯干外壳", "level": "macro", "role": "torso", "importance": 0.82, "confidence": 0.86, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "可见部件具有独立边界、装配接缝或明确发光表面，按组合实体分别建模。", "geometryDescriptor": {"topologyIntent": "rounded assembled volume with softened edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.12, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "torso-socket", "localStart": [0, 1.55, 0], "localEnd": [0, 1.85, 0], "contactType": "socket", "embedDepth": 0.035, "overlap": 0.035, "gapTolerance": 0.006, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 1.65, "height": 2.25, "depth": 1.15, "units": "relative", "confidence": 0.84}, "transform": {"position": [0, 1.75, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "torso", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.86}, "transformChannels": {"translate": false, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "课堂交互用简化碰撞代理"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "torso", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "navy-polymer"}}, "material": "warm-shell", "materialLayers": ["warm-shell"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["torso-shell", "shell-highlight"], "surfaceDetail": {"macroRoughness": 0.42, "microRoughness": 0.15, "bumpAmplitude": 0.04, "normalPattern": "soft molded plastic micro-breakup", "displacementPattern": "none", "occlusionPattern": "contact seams and joint cavities", "edgeWearPattern": "subtle edge highlight", "notes": "教学示意模型，保留可读的形体与材质差异"}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "structural-pass", "colorMaterialRecipe": {"dominantAlbedo": "rgba(241, 238, 231, 1.0)", "secondaryAlbedo": "rgba(213, 214, 211, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.88, "colorGradient": {"type": "linear", "stops": [{"position": 0, "color": "rgba(241, 238, 231, 1.0)"}, {"position": 1, "color": "rgba(213, 214, 211, 1.0)"}]}}};
  node_torso_1.userData.actionProfile = {"animationRole": "torso", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.86}, "transformChannels": {"translate": false, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "课堂交互用简化碰撞代理"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "torso", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "navy-polymer"}};
  (nodes["root"] ?? root).add(node_torso_1);
  nodes["torso"] = node_torso_1;
  const mesh_torso_1Geometry = endpoint_torso_1
    ? new THREE.CylinderGeometry(endpoint_torso_1.endRadius, endpoint_torso_1.baseRadius, endpoint_torso_1.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_torso_1) {
    mesh_torso_1Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_torso_1 = new THREE.Mesh(
    mesh_torso_1Geometry,
    materialMap["warm-shell"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_torso_1.name = "\u8eaf\u5e72\u5916\u58f3";
  if (endpoint_torso_1) {
    mesh_torso_1.position.copy(endpoint_torso_1.midpoint);
    mesh_torso_1.quaternion.copy(endpoint_torso_1.quaternion);
  }
  mesh_torso_1.castShadow = options.castShadow ?? true;
  mesh_torso_1.receiveShadow = options.receiveShadow ?? true;
  mesh_torso_1.userData.sculptComponent = {"id": "torso", "name": "躯干外壳", "level": "macro", "role": "torso", "importance": 0.82, "confidence": 0.86, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "可见部件具有独立边界、装配接缝或明确发光表面，按组合实体分别建模。", "geometryDescriptor": {"topologyIntent": "rounded assembled volume with softened edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.12, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "torso-socket", "localStart": [0, 1.55, 0], "localEnd": [0, 1.85, 0], "contactType": "socket", "embedDepth": 0.035, "overlap": 0.035, "gapTolerance": 0.006, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 1.65, "height": 2.25, "depth": 1.15, "units": "relative", "confidence": 0.84}, "transform": {"position": [0, 1.75, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "torso", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.86}, "transformChannels": {"translate": false, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "课堂交互用简化碰撞代理"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "torso", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "navy-polymer"}}, "material": "warm-shell", "materialLayers": ["warm-shell"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["torso-shell", "shell-highlight"], "surfaceDetail": {"macroRoughness": 0.42, "microRoughness": 0.15, "bumpAmplitude": 0.04, "normalPattern": "soft molded plastic micro-breakup", "displacementPattern": "none", "occlusionPattern": "contact seams and joint cavities", "edgeWearPattern": "subtle edge highlight", "notes": "教学示意模型，保留可读的形体与材质差异"}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "structural-pass", "colorMaterialRecipe": {"dominantAlbedo": "rgba(241, 238, 231, 1.0)", "secondaryAlbedo": "rgba(213, 214, 211, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.88, "colorGradient": {"type": "linear", "stops": [{"position": 0, "color": "rgba(241, 238, 231, 1.0)"}, {"position": 1, "color": "rgba(213, 214, 211, 1.0)"}]}}};
  node_torso_1.add(mesh_torso_1);
  meshes["torso"] = mesh_torso_1;
  colliders["torso"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "课堂交互用简化碰撞代理"};
  destructionGroups["torso"] ??= [];
  destructionGroups["torso"].push(node_torso_1);

  const endpoint_head_2 = makeAttachmentEndpoint(null);
  const node_head_2 = new THREE.Group();
  node_head_2.name = "\u5934\u90e8__pivot";
  node_head_2.scale.set(1, 1, 1);
  if (endpoint_head_2) {
    node_head_2.position.copy(endpoint_head_2.start);
    node_head_2.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_head_2.position.set(0.0, 3.62, 0.0);
    node_head_2.rotation.set(0.0, 0.0, 0.0);
  }
  node_head_2.userData.sculptComponent = {"id": "head", "name": "头部", "level": "macro", "role": "head", "importance": 0.82, "confidence": 0.86, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "可见部件具有独立边界、装配接缝或明确发光表面，按组合实体分别建模。", "geometryDescriptor": {"topologyIntent": "rounded assembled volume with softened edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.16, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "head-socket", "localStart": [0, 3.0, 0], "localEnd": [0, 3.35, 0], "contactType": "socket", "embedDepth": 0.035, "overlap": 0.035, "gapTolerance": 0.006, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 2.35, "height": 1.48, "depth": 1.25, "units": "relative", "confidence": 0.84}, "transform": {"position": [0, 3.62, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "head", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.86}, "transformChannels": {"translate": false, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "课堂交互用简化碰撞代理"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "navy-polymer"}}, "material": "warm-shell", "materialLayers": ["warm-shell"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["head-shell", {"id": "head-shell", "kind": "bevel", "description": "head-shell", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.42, "microRoughness": 0.15, "bumpAmplitude": 0.04, "normalPattern": "soft molded plastic micro-breakup", "displacementPattern": "none", "occlusionPattern": "contact seams and joint cavities", "edgeWearPattern": "subtle edge highlight", "notes": "教学示意模型，保留可读的形体与材质差异"}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "structural-pass", "colorMaterialRecipe": {"dominantAlbedo": "rgba(241, 238, 231, 1.0)", "secondaryAlbedo": "rgba(213, 214, 211, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.88, "colorGradient": {"type": "linear", "stops": [{"position": 0, "color": "rgba(241, 238, 231, 1.0)"}, {"position": 1, "color": "rgba(213, 214, 211, 1.0)"}]}}};
  node_head_2.userData.actionProfile = {"animationRole": "head", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.86}, "transformChannels": {"translate": false, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "课堂交互用简化碰撞代理"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "navy-polymer"}};
  (nodes["root"] ?? root).add(node_head_2);
  nodes["head"] = node_head_2;
  const mesh_head_2Geometry = endpoint_head_2
    ? new THREE.CylinderGeometry(endpoint_head_2.endRadius, endpoint_head_2.baseRadius, endpoint_head_2.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_head_2) {
    mesh_head_2Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_head_2 = new THREE.Mesh(
    mesh_head_2Geometry,
    materialMap["warm-shell"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_head_2.name = "\u5934\u90e8";
  if (endpoint_head_2) {
    mesh_head_2.position.copy(endpoint_head_2.midpoint);
    mesh_head_2.quaternion.copy(endpoint_head_2.quaternion);
  }
  mesh_head_2.castShadow = options.castShadow ?? true;
  mesh_head_2.receiveShadow = options.receiveShadow ?? true;
  mesh_head_2.userData.sculptComponent = {"id": "head", "name": "头部", "level": "macro", "role": "head", "importance": 0.82, "confidence": 0.86, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "可见部件具有独立边界、装配接缝或明确发光表面，按组合实体分别建模。", "geometryDescriptor": {"topologyIntent": "rounded assembled volume with softened edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.16, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "head-socket", "localStart": [0, 3.0, 0], "localEnd": [0, 3.35, 0], "contactType": "socket", "embedDepth": 0.035, "overlap": 0.035, "gapTolerance": 0.006, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 2.35, "height": 1.48, "depth": 1.25, "units": "relative", "confidence": 0.84}, "transform": {"position": [0, 3.62, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "head", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.86}, "transformChannels": {"translate": false, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "课堂交互用简化碰撞代理"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "navy-polymer"}}, "material": "warm-shell", "materialLayers": ["warm-shell"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["head-shell", {"id": "head-shell", "kind": "bevel", "description": "head-shell", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.42, "microRoughness": 0.15, "bumpAmplitude": 0.04, "normalPattern": "soft molded plastic micro-breakup", "displacementPattern": "none", "occlusionPattern": "contact seams and joint cavities", "edgeWearPattern": "subtle edge highlight", "notes": "教学示意模型，保留可读的形体与材质差异"}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "structural-pass", "colorMaterialRecipe": {"dominantAlbedo": "rgba(241, 238, 231, 1.0)", "secondaryAlbedo": "rgba(213, 214, 211, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.88, "colorGradient": {"type": "linear", "stops": [{"position": 0, "color": "rgba(241, 238, 231, 1.0)"}, {"position": 1, "color": "rgba(213, 214, 211, 1.0)"}]}}};
  node_head_2.add(mesh_head_2);
  meshes["head"] = mesh_head_2;
  colliders["head"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "课堂交互用简化碰撞代理"};
  destructionGroups["head"] ??= [];
  destructionGroups["head"].push(node_head_2);

  const endpoint_abdomen_3 = makeAttachmentEndpoint(null);
  const node_abdomen_3 = new THREE.Group();
  node_abdomen_3.name = "\u8179\u90e8\u8231\u4f53__pivot";
  node_abdomen_3.scale.set(1, 1, 1);
  if (endpoint_abdomen_3) {
    node_abdomen_3.position.copy(endpoint_abdomen_3.start);
    node_abdomen_3.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_abdomen_3.position.set(0.0, 0.7, 0.0);
    node_abdomen_3.rotation.set(0.0, 0.0, 0.0);
  }
  node_abdomen_3.userData.sculptComponent = {"id": "abdomen", "name": "腹部舱体", "level": "macro", "role": "abdomen", "importance": 0.82, "confidence": 0.86, "primitive": "ellipsoid", "topologyClass": "assembled-solid", "topologyRationale": "可见部件具有独立边界、装配接缝或明确发光表面，按组合实体分别建模。", "geometryDescriptor": {"topologyIntent": "rounded assembled volume with softened edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.1, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "abdomen-socket", "localStart": [0, 0.45, 0], "localEnd": [0, 0.85, 0], "contactType": "socket", "embedDepth": 0.035, "overlap": 0.035, "gapTolerance": 0.006, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 1.2, "height": 0.92, "depth": 0.95, "units": "relative", "confidence": 0.84}, "transform": {"position": [0, 0.7, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "abdomen", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.86}, "transformChannels": {"translate": false, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "课堂交互用简化碰撞代理"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "abdomen", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "navy-polymer"}}, "material": "navy-polymer", "materialLayers": ["navy-polymer"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["abdomen-shell", {"id": "abdomen-shell", "kind": "bevel", "description": "abdomen-shell", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.42, "microRoughness": 0.15, "bumpAmplitude": 0.04, "normalPattern": "soft molded plastic micro-breakup", "displacementPattern": "none", "occlusionPattern": "contact seams and joint cavities", "edgeWearPattern": "subtle edge highlight", "notes": "教学示意模型，保留可读的形体与材质差异"}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "structural-pass", "colorMaterialRecipe": {"dominantAlbedo": "rgba(32, 52, 79, 1.0)", "secondaryAlbedo": "rgba(20, 30, 43, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.86, "colorGradient": {"type": "linear", "stops": [{"position": 0, "color": "rgba(32, 52, 79, 1.0)"}, {"position": 1, "color": "rgba(20, 30, 43, 1.0)"}]}}};
  node_abdomen_3.userData.actionProfile = {"animationRole": "abdomen", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.86}, "transformChannels": {"translate": false, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "课堂交互用简化碰撞代理"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "abdomen", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "navy-polymer"}};
  (nodes["root"] ?? root).add(node_abdomen_3);
  nodes["abdomen"] = node_abdomen_3;
  const mesh_abdomen_3Geometry = endpoint_abdomen_3
    ? new THREE.CylinderGeometry(endpoint_abdomen_3.endRadius, endpoint_abdomen_3.baseRadius, endpoint_abdomen_3.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_abdomen_3) {
    mesh_abdomen_3Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_abdomen_3 = new THREE.Mesh(
    mesh_abdomen_3Geometry,
    materialMap["navy-polymer"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_abdomen_3.name = "\u8179\u90e8\u8231\u4f53";
  if (endpoint_abdomen_3) {
    mesh_abdomen_3.position.copy(endpoint_abdomen_3.midpoint);
    mesh_abdomen_3.quaternion.copy(endpoint_abdomen_3.quaternion);
  }
  mesh_abdomen_3.castShadow = options.castShadow ?? true;
  mesh_abdomen_3.receiveShadow = options.receiveShadow ?? true;
  mesh_abdomen_3.userData.sculptComponent = {"id": "abdomen", "name": "腹部舱体", "level": "macro", "role": "abdomen", "importance": 0.82, "confidence": 0.86, "primitive": "ellipsoid", "topologyClass": "assembled-solid", "topologyRationale": "可见部件具有独立边界、装配接缝或明确发光表面，按组合实体分别建模。", "geometryDescriptor": {"topologyIntent": "rounded assembled volume with softened edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.1, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "abdomen-socket", "localStart": [0, 0.45, 0], "localEnd": [0, 0.85, 0], "contactType": "socket", "embedDepth": 0.035, "overlap": 0.035, "gapTolerance": 0.006, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 1.2, "height": 0.92, "depth": 0.95, "units": "relative", "confidence": 0.84}, "transform": {"position": [0, 0.7, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "abdomen", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.86}, "transformChannels": {"translate": false, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "课堂交互用简化碰撞代理"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "abdomen", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "navy-polymer"}}, "material": "navy-polymer", "materialLayers": ["navy-polymer"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["abdomen-shell", {"id": "abdomen-shell", "kind": "bevel", "description": "abdomen-shell", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.42, "microRoughness": 0.15, "bumpAmplitude": 0.04, "normalPattern": "soft molded plastic micro-breakup", "displacementPattern": "none", "occlusionPattern": "contact seams and joint cavities", "edgeWearPattern": "subtle edge highlight", "notes": "教学示意模型，保留可读的形体与材质差异"}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "structural-pass", "colorMaterialRecipe": {"dominantAlbedo": "rgba(32, 52, 79, 1.0)", "secondaryAlbedo": "rgba(20, 30, 43, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.86, "colorGradient": {"type": "linear", "stops": [{"position": 0, "color": "rgba(32, 52, 79, 1.0)"}, {"position": 1, "color": "rgba(20, 30, 43, 1.0)"}]}}};
  node_abdomen_3.add(mesh_abdomen_3);
  meshes["abdomen"] = mesh_abdomen_3;
  colliders["abdomen"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "课堂交互用简化碰撞代理"};
  destructionGroups["abdomen"] ??= [];
  destructionGroups["abdomen"].push(node_abdomen_3);

  const attachment_left_hip_4 = {"parentId": "root", "parentSocket": "left-hip-socket", "localStart": [-0.34, 0.2, 0], "localEnd": [-0.42, 0.0, 0], "contactType": "socket", "embedDepth": 0.035, "overlap": 0.035, "gapTolerance": 0.006, "evidenceRefs": ["full-object"]};
  const endpoint_left_hip_4 = makeAttachmentEndpoint(attachment_left_hip_4);
  const node_left_hip_4 = new THREE.Group();
  node_left_hip_4.name = "left\u9acb\u5173\u8282__pivot";
  node_left_hip_4.scale.set(1, 1, 1);
  if (endpoint_left_hip_4) {
    node_left_hip_4.position.copy(endpoint_left_hip_4.start);
    node_left_hip_4.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_left_hip_4.position.set(-0.42, 0.0, 0.0);
    node_left_hip_4.rotation.set(0.0, 0.0, 0.0);
  }
  node_left_hip_4.userData.sculptComponent = {"id": "left-hip", "name": "left髋关节", "level": "micro", "role": "left-hip", "importance": 0.65, "confidence": 0.86, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "可见部件具有独立边界、装配接缝或明确发光表面，按组合实体分别建模。", "geometryDescriptor": {"topologyIntent": "rounded assembled volume with softened edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.03, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "left-hip-socket", "localStart": [-0.34, 0.2, 0], "localEnd": [-0.42, 0.0, 0], "contactType": "socket", "embedDepth": 0.035, "overlap": 0.035, "gapTolerance": 0.006, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.42, "height": 0.32, "depth": 0.42, "units": "relative", "confidence": 0.84}, "transform": {"position": [-0.42, 0.0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "left-hip", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.86}, "transformChannels": {"translate": false, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "课堂交互用简化碰撞代理"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "left-hip", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "navy-polymer"}}, "material": "rubber-trim", "materialLayers": ["rubber-trim"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["left-hip-joints", {"id": "left-hip-joints", "kind": "bevel", "description": "left-hip-joints", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.42, "microRoughness": 0.15, "bumpAmplitude": 0.04, "normalPattern": "soft molded plastic micro-breakup", "displacementPattern": "none", "occlusionPattern": "contact seams and joint cavities", "edgeWearPattern": "subtle edge highlight", "notes": "教学示意模型，保留可读的形体与材质差异"}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "structural-pass", "colorMaterialRecipe": {"dominantAlbedo": "rgba(20, 30, 43, 1.0)", "secondaryAlbedo": "rgba(48, 64, 86, 1.0)", "materialClass": "rubber", "materialClassConfidence": 0.8, "colorGradient": {"type": "linear", "stops": [{"position": 0, "color": "rgba(20, 30, 43, 1.0)"}, {"position": 1, "color": "rgba(48, 64, 86, 1.0)"}]}}};
  node_left_hip_4.userData.actionProfile = {"animationRole": "left-hip", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.86}, "transformChannels": {"translate": false, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "课堂交互用简化碰撞代理"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "left-hip", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "navy-polymer"}};
  (nodes["root"] ?? root).add(node_left_hip_4);
  nodes["left-hip"] = node_left_hip_4;
  const mesh_left_hip_4Geometry = endpoint_left_hip_4
    ? new THREE.CylinderGeometry(endpoint_left_hip_4.endRadius, endpoint_left_hip_4.baseRadius, endpoint_left_hip_4.length, 32, 12)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
  if (!endpoint_left_hip_4) {
    mesh_left_hip_4Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_left_hip_4 = new THREE.Mesh(
    mesh_left_hip_4Geometry,
    materialMap["rubber-trim"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_left_hip_4.name = "left\u9acb\u5173\u8282";
  if (endpoint_left_hip_4) {
    mesh_left_hip_4.position.copy(endpoint_left_hip_4.midpoint);
    mesh_left_hip_4.quaternion.copy(endpoint_left_hip_4.quaternion);
  }
  mesh_left_hip_4.castShadow = options.castShadow ?? true;
  mesh_left_hip_4.receiveShadow = options.receiveShadow ?? true;
  mesh_left_hip_4.userData.sculptComponent = {"id": "left-hip", "name": "left髋关节", "level": "micro", "role": "left-hip", "importance": 0.65, "confidence": 0.86, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "可见部件具有独立边界、装配接缝或明确发光表面，按组合实体分别建模。", "geometryDescriptor": {"topologyIntent": "rounded assembled volume with softened edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.03, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "left-hip-socket", "localStart": [-0.34, 0.2, 0], "localEnd": [-0.42, 0.0, 0], "contactType": "socket", "embedDepth": 0.035, "overlap": 0.035, "gapTolerance": 0.006, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.42, "height": 0.32, "depth": 0.42, "units": "relative", "confidence": 0.84}, "transform": {"position": [-0.42, 0.0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "left-hip", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.86}, "transformChannels": {"translate": false, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "课堂交互用简化碰撞代理"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "left-hip", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "navy-polymer"}}, "material": "rubber-trim", "materialLayers": ["rubber-trim"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["left-hip-joints", {"id": "left-hip-joints", "kind": "bevel", "description": "left-hip-joints", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.42, "microRoughness": 0.15, "bumpAmplitude": 0.04, "normalPattern": "soft molded plastic micro-breakup", "displacementPattern": "none", "occlusionPattern": "contact seams and joint cavities", "edgeWearPattern": "subtle edge highlight", "notes": "教学示意模型，保留可读的形体与材质差异"}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "structural-pass", "colorMaterialRecipe": {"dominantAlbedo": "rgba(20, 30, 43, 1.0)", "secondaryAlbedo": "rgba(48, 64, 86, 1.0)", "materialClass": "rubber", "materialClassConfidence": 0.8, "colorGradient": {"type": "linear", "stops": [{"position": 0, "color": "rgba(20, 30, 43, 1.0)"}, {"position": 1, "color": "rgba(48, 64, 86, 1.0)"}]}}};
  node_left_hip_4.add(mesh_left_hip_4);
  meshes["left-hip"] = mesh_left_hip_4;
  colliders["left-hip"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "课堂交互用简化碰撞代理"};
  destructionGroups["left-hip"] ??= [];
  destructionGroups["left-hip"].push(node_left_hip_4);

  const attachment_left_shin_5 = {"parentId": "left-hip", "parentSocket": "left-shin-socket", "localStart": [0, -0.1, 0], "localEnd": [0, -0.55, 0], "contactType": "socket", "embedDepth": 0.035, "overlap": 0.035, "gapTolerance": 0.006, "evidenceRefs": ["full-object"]};
  const endpoint_left_shin_5 = makeAttachmentEndpoint(attachment_left_shin_5);
  const node_left_shin_5 = new THREE.Group();
  node_left_shin_5.name = "left\u5c0f\u817f__pivot";
  node_left_shin_5.scale.set(1, 1, 1);
  if (endpoint_left_shin_5) {
    node_left_shin_5.position.copy(endpoint_left_shin_5.start);
    node_left_shin_5.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_left_shin_5.position.set(-0.42, -0.78, 0.0);
    node_left_shin_5.rotation.set(0.0, 0.0, 0.0);
  }
  node_left_shin_5.userData.sculptComponent = {"id": "left-shin", "name": "left小腿", "level": "meso", "role": "left-shin", "importance": 0.82, "confidence": 0.86, "primitive": "capsule", "topologyClass": "assembled-solid", "topologyRationale": "可见部件具有独立边界、装配接缝或明确发光表面，按组合实体分别建模。", "geometryDescriptor": {"topologyIntent": "rounded assembled volume with softened edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.1, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "left-hip", "attachment": {"parentId": "left-hip", "parentSocket": "left-shin-socket", "localStart": [0, -0.1, 0], "localEnd": [0, -0.55, 0], "contactType": "socket", "embedDepth": 0.035, "overlap": 0.035, "gapTolerance": 0.006, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.62, "height": 1.15, "depth": 0.7, "units": "relative", "confidence": 0.84}, "transform": {"position": [-0.42, -0.78, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "left-shin", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.86}, "transformChannels": {"translate": false, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "课堂交互用简化碰撞代理"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "left-shin", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "navy-polymer"}}, "material": "warm-shell", "materialLayers": ["warm-shell"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["left-shin-shell"], "surfaceDetail": {"macroRoughness": 0.42, "microRoughness": 0.15, "bumpAmplitude": 0.04, "normalPattern": "soft molded plastic micro-breakup", "displacementPattern": "none", "occlusionPattern": "contact seams and joint cavities", "edgeWearPattern": "subtle edge highlight", "notes": "教学示意模型，保留可读的形体与材质差异"}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "structural-pass", "colorMaterialRecipe": {"dominantAlbedo": "rgba(241, 238, 231, 1.0)", "secondaryAlbedo": "rgba(213, 214, 211, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.88, "colorGradient": {"type": "linear", "stops": [{"position": 0, "color": "rgba(241, 238, 231, 1.0)"}, {"position": 1, "color": "rgba(213, 214, 211, 1.0)"}]}}};
  node_left_shin_5.userData.actionProfile = {"animationRole": "left-shin", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.86}, "transformChannels": {"translate": false, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "课堂交互用简化碰撞代理"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "left-shin", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "navy-polymer"}};
  (nodes["left-hip"] ?? root).add(node_left_shin_5);
  nodes["left-shin"] = node_left_shin_5;
  const mesh_left_shin_5Geometry = endpoint_left_shin_5
    ? new THREE.CylinderGeometry(endpoint_left_shin_5.endRadius, endpoint_left_shin_5.baseRadius, endpoint_left_shin_5.length, 32, 12)
    : buildWatertightCapsule(0.35, 0.7, 16, 32, 1);
  if (!endpoint_left_shin_5) {
    mesh_left_shin_5Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_left_shin_5 = new THREE.Mesh(
    mesh_left_shin_5Geometry,
    materialMap["warm-shell"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_left_shin_5.name = "left\u5c0f\u817f";
  if (endpoint_left_shin_5) {
    mesh_left_shin_5.position.copy(endpoint_left_shin_5.midpoint);
    mesh_left_shin_5.quaternion.copy(endpoint_left_shin_5.quaternion);
  }
  mesh_left_shin_5.castShadow = options.castShadow ?? true;
  mesh_left_shin_5.receiveShadow = options.receiveShadow ?? true;
  mesh_left_shin_5.userData.sculptComponent = {"id": "left-shin", "name": "left小腿", "level": "meso", "role": "left-shin", "importance": 0.82, "confidence": 0.86, "primitive": "capsule", "topologyClass": "assembled-solid", "topologyRationale": "可见部件具有独立边界、装配接缝或明确发光表面，按组合实体分别建模。", "geometryDescriptor": {"topologyIntent": "rounded assembled volume with softened edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.1, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "left-hip", "attachment": {"parentId": "left-hip", "parentSocket": "left-shin-socket", "localStart": [0, -0.1, 0], "localEnd": [0, -0.55, 0], "contactType": "socket", "embedDepth": 0.035, "overlap": 0.035, "gapTolerance": 0.006, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.62, "height": 1.15, "depth": 0.7, "units": "relative", "confidence": 0.84}, "transform": {"position": [-0.42, -0.78, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "left-shin", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.86}, "transformChannels": {"translate": false, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "课堂交互用简化碰撞代理"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "left-shin", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "navy-polymer"}}, "material": "warm-shell", "materialLayers": ["warm-shell"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["left-shin-shell"], "surfaceDetail": {"macroRoughness": 0.42, "microRoughness": 0.15, "bumpAmplitude": 0.04, "normalPattern": "soft molded plastic micro-breakup", "displacementPattern": "none", "occlusionPattern": "contact seams and joint cavities", "edgeWearPattern": "subtle edge highlight", "notes": "教学示意模型，保留可读的形体与材质差异"}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "structural-pass", "colorMaterialRecipe": {"dominantAlbedo": "rgba(241, 238, 231, 1.0)", "secondaryAlbedo": "rgba(213, 214, 211, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.88, "colorGradient": {"type": "linear", "stops": [{"position": 0, "color": "rgba(241, 238, 231, 1.0)"}, {"position": 1, "color": "rgba(213, 214, 211, 1.0)"}]}}};
  node_left_shin_5.add(mesh_left_shin_5);
  meshes["left-shin"] = mesh_left_shin_5;
  colliders["left-shin"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "课堂交互用简化碰撞代理"};
  destructionGroups["left-shin"] ??= [];
  destructionGroups["left-shin"].push(node_left_shin_5);

  const endpoint_left_foot_6 = makeAttachmentEndpoint(null);
  const node_left_foot_6 = new THREE.Group();
  node_left_foot_6.name = "left\u811a\u5e95__pivot";
  node_left_foot_6.scale.set(1, 1, 1);
  if (endpoint_left_foot_6) {
    node_left_foot_6.position.copy(endpoint_left_foot_6.start);
    node_left_foot_6.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_left_foot_6.position.set(-0.42, -1.65, 0.1);
    node_left_foot_6.rotation.set(0.0, 0.0, 0.0);
  }
  node_left_foot_6.userData.sculptComponent = {"id": "left-foot", "name": "left脚底", "level": "macro", "role": "left-foot", "importance": 0.82, "confidence": 0.86, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "可见部件具有独立边界、装配接缝或明确发光表面，按组合实体分别建模。", "geometryDescriptor": {"topologyIntent": "rounded assembled volume with softened edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.12, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "left-shin", "attachment": {"parentId": "left-shin", "parentSocket": "left-foot-socket", "localStart": [0, -0.5, 0], "localEnd": [0, -0.75, 0], "contactType": "socket", "embedDepth": 0.035, "overlap": 0.035, "gapTolerance": 0.006, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.98, "height": 0.58, "depth": 1.25, "units": "relative", "confidence": 0.84}, "transform": {"position": [-0.42, -1.65, 0.1], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "left-foot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.86}, "transformChannels": {"translate": false, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "课堂交互用简化碰撞代理"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "left-foot", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "navy-polymer"}}, "material": "warm-shell", "materialLayers": ["warm-shell"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["left-foot-base", {"id": "left-foot-base-trim", "kind": "bevel", "description": "left-foot-base-trim", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.42, "microRoughness": 0.15, "bumpAmplitude": 0.04, "normalPattern": "soft molded plastic micro-breakup", "displacementPattern": "none", "occlusionPattern": "contact seams and joint cavities", "edgeWearPattern": "subtle edge highlight", "notes": "教学示意模型，保留可读的形体与材质差异"}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "structural-pass", "colorMaterialRecipe": {"dominantAlbedo": "rgba(241, 238, 231, 1.0)", "secondaryAlbedo": "rgba(213, 214, 211, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.88, "colorGradient": {"type": "linear", "stops": [{"position": 0, "color": "rgba(241, 238, 231, 1.0)"}, {"position": 1, "color": "rgba(213, 214, 211, 1.0)"}]}}};
  node_left_foot_6.userData.actionProfile = {"animationRole": "left-foot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.86}, "transformChannels": {"translate": false, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "课堂交互用简化碰撞代理"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "left-foot", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "navy-polymer"}};
  (nodes["left-shin"] ?? root).add(node_left_foot_6);
  nodes["left-foot"] = node_left_foot_6;
  const mesh_left_foot_6Geometry = endpoint_left_foot_6
    ? new THREE.CylinderGeometry(endpoint_left_foot_6.endRadius, endpoint_left_foot_6.baseRadius, endpoint_left_foot_6.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_left_foot_6) {
    mesh_left_foot_6Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_left_foot_6 = new THREE.Mesh(
    mesh_left_foot_6Geometry,
    materialMap["warm-shell"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_left_foot_6.name = "left\u811a\u5e95";
  if (endpoint_left_foot_6) {
    mesh_left_foot_6.position.copy(endpoint_left_foot_6.midpoint);
    mesh_left_foot_6.quaternion.copy(endpoint_left_foot_6.quaternion);
  }
  mesh_left_foot_6.castShadow = options.castShadow ?? true;
  mesh_left_foot_6.receiveShadow = options.receiveShadow ?? true;
  mesh_left_foot_6.userData.sculptComponent = {"id": "left-foot", "name": "left脚底", "level": "macro", "role": "left-foot", "importance": 0.82, "confidence": 0.86, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "可见部件具有独立边界、装配接缝或明确发光表面，按组合实体分别建模。", "geometryDescriptor": {"topologyIntent": "rounded assembled volume with softened edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.12, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "left-shin", "attachment": {"parentId": "left-shin", "parentSocket": "left-foot-socket", "localStart": [0, -0.5, 0], "localEnd": [0, -0.75, 0], "contactType": "socket", "embedDepth": 0.035, "overlap": 0.035, "gapTolerance": 0.006, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.98, "height": 0.58, "depth": 1.25, "units": "relative", "confidence": 0.84}, "transform": {"position": [-0.42, -1.65, 0.1], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "left-foot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.86}, "transformChannels": {"translate": false, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "课堂交互用简化碰撞代理"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "left-foot", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "navy-polymer"}}, "material": "warm-shell", "materialLayers": ["warm-shell"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["left-foot-base", {"id": "left-foot-base-trim", "kind": "bevel", "description": "left-foot-base-trim", "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.42, "microRoughness": 0.15, "bumpAmplitude": 0.04, "normalPattern": "soft molded plastic micro-breakup", "displacementPattern": "none", "occlusionPattern": "contact seams and joint cavities", "edgeWearPattern": "subtle edge highlight", "notes": "教学示意模型，保留可读的形体与材质差异"}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "structural-pass", "colorMaterialRecipe": {"dominantAlbedo": "rgba(241, 238, 231, 1.0)", "secondaryAlbedo": "rgba(213, 214, 211, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.88, "colorGradient": {"type": "linear", "stops": [{"position": 0, "color": "rgba(241, 238, 231, 1.0)"}, {"position": 1, "color": "rgba(213, 214, 211, 1.0)"}]}}};
  node_left_foot_6.add(mesh_left_foot_6);
  meshes["left-foot"] = mesh_left_foot_6;
  colliders["left-foot"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "课堂交互用简化碰撞代理"};
  destructionGroups["left-foot"] ??= [];
  destructionGroups["left-foot"].push(node_left_foot_6);

  const attachment_right_hip_7 = {"parentId": "root", "parentSocket": "right-hip-socket", "localStart": [0.34, 0.2, 0], "localEnd": [0.42, 0.0, 0], "contactType": "socket", "embedDepth": 0.035, "overlap": 0.035, "gapTolerance": 0.006, "evidenceRefs": ["full-object"]};
  const endpoint_right_hip_7 = makeAttachmentEndpoint(attachment_right_hip_7);
  const node_right_hip_7 = new THREE.Group();
  node_right_hip_7.name = "right\u9acb\u5173\u8282__pivot";
  node_right_hip_7.scale.set(1, 1, 1);
  if (endpoint_right_hip_7) {
    node_right_hip_7.position.copy(endpoint_right_hip_7.start);
    node_right_hip_7.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_right_hip_7.position.set(0.42, 0.0, 0.0);
    node_right_hip_7.rotation.set(0.0, 0.0, 0.0);
  }
  node_right_hip_7.userData.sculptComponent = {"id": "right-hip", "name": "right髋关节", "level": "micro", "role": "right-hip", "importance": 0.65, "confidence": 0.86, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "可见部件具有独立边界、装配接缝或明确发光表面，按组合实体分别建模。", "geometryDescriptor": {"topologyIntent": "rounded assembled volume with softened edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.03, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "right-hip-socket", "localStart": [0.34, 0.2, 0], "localEnd": [0.42, 0.0, 0], "contactType": "socket", "embedDepth": 0.035, "overlap": 0.035, "gapTolerance": 0.006, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.42, "height": 0.32, "depth": 0.42, "units": "relative", "confidence": 0.84}, "transform": {"position": [0.42, 0.0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "right-hip", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.86}, "transformChannels": {"translate": false, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "课堂交互用简化碰撞代理"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "right-hip", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "navy-polymer"}}, "material": "rubber-trim", "materialLayers": ["rubber-trim"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["right-hip-joints"], "surfaceDetail": {"macroRoughness": 0.42, "microRoughness": 0.15, "bumpAmplitude": 0.04, "normalPattern": "soft molded plastic micro-breakup", "displacementPattern": "none", "occlusionPattern": "contact seams and joint cavities", "edgeWearPattern": "subtle edge highlight", "notes": "教学示意模型，保留可读的形体与材质差异"}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "structural-pass", "colorMaterialRecipe": {"dominantAlbedo": "rgba(20, 30, 43, 1.0)", "secondaryAlbedo": "rgba(48, 64, 86, 1.0)", "materialClass": "rubber", "materialClassConfidence": 0.8, "colorGradient": {"type": "linear", "stops": [{"position": 0, "color": "rgba(20, 30, 43, 1.0)"}, {"position": 1, "color": "rgba(48, 64, 86, 1.0)"}]}}};
  node_right_hip_7.userData.actionProfile = {"animationRole": "right-hip", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.86}, "transformChannels": {"translate": false, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "课堂交互用简化碰撞代理"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "right-hip", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "navy-polymer"}};
  (nodes["root"] ?? root).add(node_right_hip_7);
  nodes["right-hip"] = node_right_hip_7;
  const mesh_right_hip_7Geometry = endpoint_right_hip_7
    ? new THREE.CylinderGeometry(endpoint_right_hip_7.endRadius, endpoint_right_hip_7.baseRadius, endpoint_right_hip_7.length, 32, 12)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
  if (!endpoint_right_hip_7) {
    mesh_right_hip_7Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_right_hip_7 = new THREE.Mesh(
    mesh_right_hip_7Geometry,
    materialMap["rubber-trim"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_right_hip_7.name = "right\u9acb\u5173\u8282";
  if (endpoint_right_hip_7) {
    mesh_right_hip_7.position.copy(endpoint_right_hip_7.midpoint);
    mesh_right_hip_7.quaternion.copy(endpoint_right_hip_7.quaternion);
  }
  mesh_right_hip_7.castShadow = options.castShadow ?? true;
  mesh_right_hip_7.receiveShadow = options.receiveShadow ?? true;
  mesh_right_hip_7.userData.sculptComponent = {"id": "right-hip", "name": "right髋关节", "level": "micro", "role": "right-hip", "importance": 0.65, "confidence": 0.86, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "可见部件具有独立边界、装配接缝或明确发光表面，按组合实体分别建模。", "geometryDescriptor": {"topologyIntent": "rounded assembled volume with softened edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.03, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "right-hip-socket", "localStart": [0.34, 0.2, 0], "localEnd": [0.42, 0.0, 0], "contactType": "socket", "embedDepth": 0.035, "overlap": 0.035, "gapTolerance": 0.006, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.42, "height": 0.32, "depth": 0.42, "units": "relative", "confidence": 0.84}, "transform": {"position": [0.42, 0.0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "right-hip", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.86}, "transformChannels": {"translate": false, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "课堂交互用简化碰撞代理"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "right-hip", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "navy-polymer"}}, "material": "rubber-trim", "materialLayers": ["rubber-trim"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["right-hip-joints"], "surfaceDetail": {"macroRoughness": 0.42, "microRoughness": 0.15, "bumpAmplitude": 0.04, "normalPattern": "soft molded plastic micro-breakup", "displacementPattern": "none", "occlusionPattern": "contact seams and joint cavities", "edgeWearPattern": "subtle edge highlight", "notes": "教学示意模型，保留可读的形体与材质差异"}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "structural-pass", "colorMaterialRecipe": {"dominantAlbedo": "rgba(20, 30, 43, 1.0)", "secondaryAlbedo": "rgba(48, 64, 86, 1.0)", "materialClass": "rubber", "materialClassConfidence": 0.8, "colorGradient": {"type": "linear", "stops": [{"position": 0, "color": "rgba(20, 30, 43, 1.0)"}, {"position": 1, "color": "rgba(48, 64, 86, 1.0)"}]}}};
  node_right_hip_7.add(mesh_right_hip_7);
  meshes["right-hip"] = mesh_right_hip_7;
  colliders["right-hip"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "课堂交互用简化碰撞代理"};
  destructionGroups["right-hip"] ??= [];
  destructionGroups["right-hip"].push(node_right_hip_7);

  const attachment_right_shin_8 = {"parentId": "right-hip", "parentSocket": "right-shin-socket", "localStart": [0, -0.1, 0], "localEnd": [0, -0.55, 0], "contactType": "socket", "embedDepth": 0.035, "overlap": 0.035, "gapTolerance": 0.006, "evidenceRefs": ["full-object"]};
  const endpoint_right_shin_8 = makeAttachmentEndpoint(attachment_right_shin_8);
  const node_right_shin_8 = new THREE.Group();
  node_right_shin_8.name = "right\u5c0f\u817f__pivot";
  node_right_shin_8.scale.set(1, 1, 1);
  if (endpoint_right_shin_8) {
    node_right_shin_8.position.copy(endpoint_right_shin_8.start);
    node_right_shin_8.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_right_shin_8.position.set(0.42, -0.78, 0.0);
    node_right_shin_8.rotation.set(0.0, 0.0, 0.0);
  }
  node_right_shin_8.userData.sculptComponent = {"id": "right-shin", "name": "right小腿", "level": "meso", "role": "right-shin", "importance": 0.82, "confidence": 0.86, "primitive": "capsule", "topologyClass": "assembled-solid", "topologyRationale": "可见部件具有独立边界、装配接缝或明确发光表面，按组合实体分别建模。", "geometryDescriptor": {"topologyIntent": "rounded assembled volume with softened edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.1, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "right-hip", "attachment": {"parentId": "right-hip", "parentSocket": "right-shin-socket", "localStart": [0, -0.1, 0], "localEnd": [0, -0.55, 0], "contactType": "socket", "embedDepth": 0.035, "overlap": 0.035, "gapTolerance": 0.006, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.62, "height": 1.15, "depth": 0.7, "units": "relative", "confidence": 0.84}, "transform": {"position": [0.42, -0.78, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "right-shin", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.86}, "transformChannels": {"translate": false, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "课堂交互用简化碰撞代理"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "right-shin", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "navy-polymer"}}, "material": "warm-shell", "materialLayers": ["warm-shell"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["right-shin-shell"], "surfaceDetail": {"macroRoughness": 0.42, "microRoughness": 0.15, "bumpAmplitude": 0.04, "normalPattern": "soft molded plastic micro-breakup", "displacementPattern": "none", "occlusionPattern": "contact seams and joint cavities", "edgeWearPattern": "subtle edge highlight", "notes": "教学示意模型，保留可读的形体与材质差异"}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "structural-pass", "colorMaterialRecipe": {"dominantAlbedo": "rgba(241, 238, 231, 1.0)", "secondaryAlbedo": "rgba(213, 214, 211, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.88, "colorGradient": {"type": "linear", "stops": [{"position": 0, "color": "rgba(241, 238, 231, 1.0)"}, {"position": 1, "color": "rgba(213, 214, 211, 1.0)"}]}}};
  node_right_shin_8.userData.actionProfile = {"animationRole": "right-shin", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.86}, "transformChannels": {"translate": false, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "课堂交互用简化碰撞代理"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "right-shin", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "navy-polymer"}};
  (nodes["right-hip"] ?? root).add(node_right_shin_8);
  nodes["right-shin"] = node_right_shin_8;
  const mesh_right_shin_8Geometry = endpoint_right_shin_8
    ? new THREE.CylinderGeometry(endpoint_right_shin_8.endRadius, endpoint_right_shin_8.baseRadius, endpoint_right_shin_8.length, 32, 12)
    : buildWatertightCapsule(0.35, 0.7, 16, 32, 1);
  if (!endpoint_right_shin_8) {
    mesh_right_shin_8Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_right_shin_8 = new THREE.Mesh(
    mesh_right_shin_8Geometry,
    materialMap["warm-shell"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_right_shin_8.name = "right\u5c0f\u817f";
  if (endpoint_right_shin_8) {
    mesh_right_shin_8.position.copy(endpoint_right_shin_8.midpoint);
    mesh_right_shin_8.quaternion.copy(endpoint_right_shin_8.quaternion);
  }
  mesh_right_shin_8.castShadow = options.castShadow ?? true;
  mesh_right_shin_8.receiveShadow = options.receiveShadow ?? true;
  mesh_right_shin_8.userData.sculptComponent = {"id": "right-shin", "name": "right小腿", "level": "meso", "role": "right-shin", "importance": 0.82, "confidence": 0.86, "primitive": "capsule", "topologyClass": "assembled-solid", "topologyRationale": "可见部件具有独立边界、装配接缝或明确发光表面，按组合实体分别建模。", "geometryDescriptor": {"topologyIntent": "rounded assembled volume with softened edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.1, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "right-hip", "attachment": {"parentId": "right-hip", "parentSocket": "right-shin-socket", "localStart": [0, -0.1, 0], "localEnd": [0, -0.55, 0], "contactType": "socket", "embedDepth": 0.035, "overlap": 0.035, "gapTolerance": 0.006, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.62, "height": 1.15, "depth": 0.7, "units": "relative", "confidence": 0.84}, "transform": {"position": [0.42, -0.78, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "right-shin", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.86}, "transformChannels": {"translate": false, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "课堂交互用简化碰撞代理"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "right-shin", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "navy-polymer"}}, "material": "warm-shell", "materialLayers": ["warm-shell"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["right-shin-shell"], "surfaceDetail": {"macroRoughness": 0.42, "microRoughness": 0.15, "bumpAmplitude": 0.04, "normalPattern": "soft molded plastic micro-breakup", "displacementPattern": "none", "occlusionPattern": "contact seams and joint cavities", "edgeWearPattern": "subtle edge highlight", "notes": "教学示意模型，保留可读的形体与材质差异"}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "structural-pass", "colorMaterialRecipe": {"dominantAlbedo": "rgba(241, 238, 231, 1.0)", "secondaryAlbedo": "rgba(213, 214, 211, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.88, "colorGradient": {"type": "linear", "stops": [{"position": 0, "color": "rgba(241, 238, 231, 1.0)"}, {"position": 1, "color": "rgba(213, 214, 211, 1.0)"}]}}};
  node_right_shin_8.add(mesh_right_shin_8);
  meshes["right-shin"] = mesh_right_shin_8;
  colliders["right-shin"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "课堂交互用简化碰撞代理"};
  destructionGroups["right-shin"] ??= [];
  destructionGroups["right-shin"].push(node_right_shin_8);

  const endpoint_right_foot_9 = makeAttachmentEndpoint(null);
  const node_right_foot_9 = new THREE.Group();
  node_right_foot_9.name = "right\u811a\u5e95__pivot";
  node_right_foot_9.scale.set(1, 1, 1);
  if (endpoint_right_foot_9) {
    node_right_foot_9.position.copy(endpoint_right_foot_9.start);
    node_right_foot_9.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_right_foot_9.position.set(0.42, -1.65, 0.1);
    node_right_foot_9.rotation.set(0.0, 0.0, 0.0);
  }
  node_right_foot_9.userData.sculptComponent = {"id": "right-foot", "name": "right脚底", "level": "macro", "role": "right-foot", "importance": 0.82, "confidence": 0.86, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "可见部件具有独立边界、装配接缝或明确发光表面，按组合实体分别建模。", "geometryDescriptor": {"topologyIntent": "rounded assembled volume with softened edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.12, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "right-shin", "attachment": {"parentId": "right-shin", "parentSocket": "right-foot-socket", "localStart": [0, -0.5, 0], "localEnd": [0, -0.75, 0], "contactType": "socket", "embedDepth": 0.035, "overlap": 0.035, "gapTolerance": 0.006, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.98, "height": 0.58, "depth": 1.25, "units": "relative", "confidence": 0.84}, "transform": {"position": [0.42, -1.65, 0.1], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "right-foot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.86}, "transformChannels": {"translate": false, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "课堂交互用简化碰撞代理"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "right-foot", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "navy-polymer"}}, "material": "warm-shell", "materialLayers": ["warm-shell"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["right-foot-base"], "surfaceDetail": {"macroRoughness": 0.42, "microRoughness": 0.15, "bumpAmplitude": 0.04, "normalPattern": "soft molded plastic micro-breakup", "displacementPattern": "none", "occlusionPattern": "contact seams and joint cavities", "edgeWearPattern": "subtle edge highlight", "notes": "教学示意模型，保留可读的形体与材质差异"}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "structural-pass", "colorMaterialRecipe": {"dominantAlbedo": "rgba(241, 238, 231, 1.0)", "secondaryAlbedo": "rgba(213, 214, 211, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.88, "colorGradient": {"type": "linear", "stops": [{"position": 0, "color": "rgba(241, 238, 231, 1.0)"}, {"position": 1, "color": "rgba(213, 214, 211, 1.0)"}]}}};
  node_right_foot_9.userData.actionProfile = {"animationRole": "right-foot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.86}, "transformChannels": {"translate": false, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "课堂交互用简化碰撞代理"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "right-foot", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "navy-polymer"}};
  (nodes["right-shin"] ?? root).add(node_right_foot_9);
  nodes["right-foot"] = node_right_foot_9;
  const mesh_right_foot_9Geometry = endpoint_right_foot_9
    ? new THREE.CylinderGeometry(endpoint_right_foot_9.endRadius, endpoint_right_foot_9.baseRadius, endpoint_right_foot_9.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_right_foot_9) {
    mesh_right_foot_9Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_right_foot_9 = new THREE.Mesh(
    mesh_right_foot_9Geometry,
    materialMap["warm-shell"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_right_foot_9.name = "right\u811a\u5e95";
  if (endpoint_right_foot_9) {
    mesh_right_foot_9.position.copy(endpoint_right_foot_9.midpoint);
    mesh_right_foot_9.quaternion.copy(endpoint_right_foot_9.quaternion);
  }
  mesh_right_foot_9.castShadow = options.castShadow ?? true;
  mesh_right_foot_9.receiveShadow = options.receiveShadow ?? true;
  mesh_right_foot_9.userData.sculptComponent = {"id": "right-foot", "name": "right脚底", "level": "macro", "role": "right-foot", "importance": 0.82, "confidence": 0.86, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "可见部件具有独立边界、装配接缝或明确发光表面，按组合实体分别建模。", "geometryDescriptor": {"topologyIntent": "rounded assembled volume with softened edges", "edgeTreatment": {"type": "bevel", "bevelRadius": 0.12, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "right-shin", "attachment": {"parentId": "right-shin", "parentSocket": "right-foot-socket", "localStart": [0, -0.5, 0], "localEnd": [0, -0.75, 0], "contactType": "socket", "embedDepth": 0.035, "overlap": 0.035, "gapTolerance": 0.006, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.98, "height": 0.58, "depth": 1.25, "units": "relative", "confidence": 0.84}, "transform": {"position": [0.42, -1.65, 0.1], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "right-foot", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.86}, "transformChannels": {"translate": false, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "课堂交互用简化碰撞代理"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "right-foot", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "navy-polymer"}}, "material": "warm-shell", "materialLayers": ["warm-shell"], "deformations": [], "joints": [], "seams": [], "localFeatures": ["right-foot-base"], "surfaceDetail": {"macroRoughness": 0.42, "microRoughness": 0.15, "bumpAmplitude": 0.04, "normalPattern": "soft molded plastic micro-breakup", "displacementPattern": "none", "occlusionPattern": "contact seams and joint cavities", "edgeWearPattern": "subtle edge highlight", "notes": "教学示意模型，保留可读的形体与材质差异"}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "structural-pass", "colorMaterialRecipe": {"dominantAlbedo": "rgba(241, 238, 231, 1.0)", "secondaryAlbedo": "rgba(213, 214, 211, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.88, "colorGradient": {"type": "linear", "stops": [{"position": 0, "color": "rgba(241, 238, 231, 1.0)"}, {"position": 1, "color": "rgba(213, 214, 211, 1.0)"}]}}};
  node_right_foot_9.add(mesh_right_foot_9);
  meshes["right-foot"] = mesh_right_foot_9;
  colliders["right-foot"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "课堂交互用简化碰撞代理"};
  destructionGroups["right-foot"] ??= [];
  destructionGroups["right-foot"].push(node_right_foot_9);

  root.userData.sculptRuntime = { nodes, meshes, sockets, colliders, destructionGroups } satisfies ProceduralModelRuntime;
  root.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry"}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  root.userData.actionReadiness = {
    note: 'Use root.userData.sculptRuntime.nodes for transforms, sockets for attachments, colliders for physics proxies, and destructionGroups for breakable sets.',
  };
  return root;
}

export function createAIClassmateEducationalRobotLookDevLights(
  mode: 'neutral' | 'grazing' | 'reference' = 'neutral',
): THREE.Group {
  const lights = new THREE.Group();
  lights.name = "AI Classmate Educational Robot look-dev lights";
  const hemi = new THREE.HemisphereLight(
    mode === 'reference' ? 0xfff0d6 : 0xf2f4ff,
    0x363b42,
    mode === 'grazing' ? 0.28 : mode === 'reference' ? 0.72 : 0.85,
  );
  lights.add(hemi);
  const key = new THREE.DirectionalLight(
    mode === 'reference' ? 0xffcf8a : 0xfff4e8,
    mode === 'grazing' ? 4.2 : mode === 'reference' ? 2.6 : 2.15,
  );
  if (mode === 'grazing') key.position.set(7.5, 1.1, 4.0);
  else if (mode === 'reference') key.position.set(-4.5, 7.5, 5.0);
  else key.position.set(-4.0, 6.0, 5.5);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.018;
  key.shadow.radius = 7;
  key.shadow.blurSamples = 24;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 30;
  key.shadow.camera.left = -2.6;
  key.shadow.camera.right = 2.6;
  key.shadow.camera.top = 2.6;
  key.shadow.camera.bottom = -2.6;
  key.shadow.camera.updateProjectionMatrix();
  lights.add(key);
  const fill = new THREE.DirectionalLight(0xa8c4ff, mode === 'grazing' ? 0.12 : 0.42);
  fill.position.set(4.0, 3.0, 3.5);
  lights.add(fill);
  const rim = new THREE.DirectionalLight(0xfff1c4, mode === 'grazing' ? 0.28 : 0.85);
  rim.position.set(0.5, 4.5, -6.0);
  lights.add(rim);
  lights.userData.reviewMode = mode;
  lights.userData.lightingFromPhoto = ["key light: 左前上方大面积柔光，形成头壳和肩部的柔和高光。", "fill light: 正面偏右低强度填充，保留深蓝面板细节。", "rim light: 后上方冷色轮廓光，分离天线与头壳轮廓。", "exposure: 中性略高曝光；tone mapping: ACES/Filmic。", "background: 浅灰白无纹理背景。", "contact shadow: 双脚与地面、关节接缝处保留软接触阴影。"];
  lights.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry"}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  return lights;
}

// PBR materials (clearcoat/iridescence/transmission/anisotropy) need an environment
// map to visually behave as intended — call this once per renderer and assign the
// result to scene.environment before rendering. No external HDR asset required.
export function createAIClassmateEducationalRobotEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return texture;
}

// Plan 1.3 §3.2 — auto-framing by bounding box. The Divine Eye can only compare a
// render to the reference if the object is FRAMED consistently (an object framed
// differently scores as wrong even when its shape is right). This positions the camera
// deterministically from the object's bounding box so it fills the frame at a stable
// margin, and sets near/far to the object scale. Call after adding the model to the
// scene, and again on resize (after updating camera.aspect).
export function frameAIClassmateEducationalRobotCamera(
  camera: THREE.PerspectiveCamera,
  object: THREE.Object3D,
  options: { margin?: number; azimuthDeg?: number; elevationDeg?: number } = {},
): void {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const margin = options.margin ?? 1.15;
  const maxDim = Math.max(size.x, size.y, size.z) * margin;
  const fov = (camera.fov * Math.PI) / 180;
  // distance so the largest object dimension fits vertically in the frame
  const distance = (maxDim / 2) / Math.tan(fov / 2);
  const az = ((options.azimuthDeg ?? 0) * Math.PI) / 180;
  const el = ((options.elevationDeg ?? 0) * Math.PI) / 180;
  const dir = new THREE.Vector3(
    Math.sin(az) * Math.cos(el),
    Math.sin(el),
    Math.cos(az) * Math.cos(el),
  );
  camera.position.copy(center).addScaledVector(dir, distance);
  camera.near = Math.max(0.01, distance - maxDim);
  camera.far = distance + maxDim * 2;
  camera.lookAt(center);
  camera.updateProjectionMatrix();
}

// Plan 1.3 §3.2c — PRESENTATION composer (DOF + bloom). CRITICAL (R-POSTFX): this is
// for the showcase/hero render ONLY. The Divine Eye's EVALUATION render MUST use a
// plain renderer with NO composer — bloom blows highlights and DOF blurs edges, which
// would corrupt the deterministic IoU/DCD/edge/blowout signals. Enable dof/bloom ONLY
// when the reference photo actually exhibits them (detect_reference_effects.py authorizes).
export function createAIClassmateEducationalRobotPresentationComposer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options: { dof?: boolean; bloom?: boolean; bloomStrength?: number; dofFocus?: number; dofAperture?: number } = {},
): EffectComposer {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  if (options.dof) {
    composer.addPass(new BokehPass(scene, camera, {
      focus: options.dofFocus ?? 10.0,
      aperture: options.dofAperture ?? 0.0002,
      maxblur: 0.01,
    }));
  }
  if (options.bloom) {
    const size = new THREE.Vector2();
    renderer.getSize(size);
    composer.addPass(new UnrealBloomPass(size, options.bloomStrength ?? 0.4, 0.4, 0.85));
  }
  return composer;
}

export function configureAIClassmateEducationalRobotRenderer(renderer: THREE.WebGLRenderer): void {
  // Load-bearing for view-dependent finishes (anodized / Doppler): without ACES + sRGB
  // the environment reflection reads flat/washed instead of a believable metal response.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}

export function createAIClassmateEducationalRobotInspectControls(
  camera: THREE.Camera,
  domElement: HTMLElement,
): OrbitControls {
  // View-dependent finishes only read correctly once the user orbits — their color
  // comes from the environment reflection, not albedo, so free rotation matters here.
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.minDistance = 1.0;
  controls.maxDistance = 8.0;
  controls.autoRotate = false;
  return controls;
}
