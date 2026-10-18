import * as THREE from 'three';

const WIDTH = 512, HEIGHT = 1024;
const fract = (x: number) => x - Math.floor(x);
const hash = (x: number, y: number) => fract(Math.sin(x * 127.1 + y * 311.7 + 42) * 43758.5453);
const wrap = (x: number, period: number) => (x % period + period) % period;

function noise(x: number, y: number, period: number) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = fract(x), fy = fract(y);
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(wrap(ix, period), iy), b = hash(wrap(ix + 1, period), iy);
  const c = hash(wrap(ix, period), iy + 1), d = hash(wrap(ix + 1, period), iy + 1);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, sx), THREE.MathUtils.lerp(c, d, sx), sy);
}

/** 固定种子的镀锌结晶、氧化斑驳和细划痕。三条贴图均可进入标准 USDZ 材质。 */
function createGalvanizedMaps() {
  const colorCanvas = document.createElement('canvas'); colorCanvas.width = WIDTH; colorCanvas.height = HEIGHT;
  const roughCanvas = colorCanvas.cloneNode() as HTMLCanvasElement;
  const normalCanvas = colorCanvas.cloneNode() as HTMLCanvasElement;
  const colorCtx = colorCanvas.getContext('2d')!, roughCtx = roughCanvas.getContext('2d')!, normalCtx = normalCanvas.getContext('2d')!;
  const color = colorCtx.createImageData(WIDTH, HEIGHT), rough = roughCtx.createImageData(WIDTH, HEIGHT), normal = normalCtx.createImageData(WIDTH, HEIGHT);
  const relief = new Float32Array(WIDTH * HEIGHT);
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const u = x / WIDTH, v = y / HEIGHT;
      const cloud = noise(u * 18, v * 28, 18) * 0.5 + noise(u * 72, v * 110, 72) * 0.5;
      const grain = noise(u * 280, v * 432, 280);
      // 小晶片亮度不相同；环向周期采样使圆柱背面的 UV 接缝连续。
      const gx = u * 176, gy = v * 288, ix = Math.floor(gx), iy = Math.floor(gy);
      let nearest = Infinity, crystal = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const cx = ix + dx, cy = iy + dy, hx = wrap(cx, 176);
        const px = cx + hash(hx, cy), py = cy + hash(hx + 193, cy);
        const dist = (gx - px) ** 2 + (gy - py) ** 2;
        if (dist < nearest) { nearest = dist; crystal = hash(hx + 71, cy + 17); }
      }
      const speckle = hash(x, y) - 0.5;
      // 参考杆身是平整的旧镀锌金属。氧化主要改变反照率，不能把晶片做成铝箔凸面。
      const oxidation = Math.max(0, 0.5 - noise(u * 140, v * 216, 140)) * 48;
      const value = 186 - oxidation + (cloud - 0.5) * 10 + (crystal - 0.5) * 12 + (grain - 0.5) * 32 + speckle * 26;
      const i = (y * WIDTH + x) * 4;
      color.data[i] = value; color.data[i + 1] = value; color.data[i + 2] = value + 1; color.data[i + 3] = 255;
      const r = 112 + grain * 8;
      rough.data[i] = r; rough.data[i + 1] = r; rough.data[i + 2] = r; rough.data[i + 3] = 255;
      relief[y * WIDTH + x] = grain * 0.8 + speckle * 0.2;
    }
  }
  colorCtx.putImageData(color, 0, 0); roughCtx.putImageData(rough, 0, 0);
  // 细痕疏密与长度不一致，不把整根杆做成规则拉丝或等距线条。
  for (let i = 0; i < 64; i++) {
    const x = hash(i, 19) * WIDTH, y = hash(i, 81) * HEIGHT;
    const length = 8 + hash(i, 24) * 72, slant = (hash(i, 37) - 0.5) * 22;
    colorCtx.strokeStyle = `rgba(53,57,60,${0.06 + hash(i, 56) * 0.12})`;
    colorCtx.lineWidth = 0.45 + hash(i, 17) * 0.5;
    colorCtx.beginPath(); colorCtx.moveTo(x, y); colorCtx.quadraticCurveTo(x + slant * 0.3, y + length * 0.6, x + slant, y + length); colorCtx.stroke();
  }
  for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
    const left = relief[y * WIDTH + wrap(x - 1, WIDTH)], right = relief[y * WIDTH + wrap(x + 1, WIDTH)];
    const down = relief[Math.min(HEIGHT - 1, y + 1) * WIDTH + x], up = relief[Math.max(0, y - 1) * WIDTH + x];
    // Canvas 的 Y 朝下，纹理 V 朝上。微法线只刻画浅结晶，不改变真实圆柱轮廓。
    // 微法线强度烘焙在像素里；r169 USDZExporter 不保留 normalScale，避免苹果端凹凸放大。
    const nx = (left - right) * 0.035, ny = (down - up) * 0.035, inv = 1 / Math.hypot(nx, ny, 1), i = (y * WIDTH + x) * 4;
    normal.data[i] = (nx * inv * 0.5 + 0.5) * 255; normal.data[i + 1] = (ny * inv * 0.5 + 0.5) * 255;
    normal.data[i + 2] = (inv * 0.5 + 0.5) * 255; normal.data[i + 3] = 255;
  }
  normalCtx.putImageData(normal, 0, 0);
  const texture = (canvas: HTMLCanvasElement, isColor = false) => {
    const t = new THREE.CanvasTexture(canvas); t.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = THREE.RepeatWrapping; t.anisotropy = 8; return t;
  };
  return { map: texture(colorCanvas, true), roughnessMap: texture(roughCanvas), normalMap: texture(normalCanvas) };
}

// Immutable canvas sources are shared; each consumer owns its disposable textures.
let cachedMaps:ReturnType<typeof createGalvanizedMaps>|undefined;
export function galvanizedMaps() {
  cachedMaps??=createGalvanizedMaps();
  const clone=(texture:THREE.Texture)=>{const value=texture.clone();value.needsUpdate=true;return value;};
  return {map:clone(cachedMaps.map),normalMap:clone(cachedMaps.normalMap),roughnessMap:clone(cachedMaps.roughnessMap)};
}

/** 杆身专用竖向柔光反射。纸张仍使用原来的环境与颜色校准。环境光不烘焙进纹理。 */
export function makePoleEnvironment(renderer: THREE.WebGLRenderer) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 256;
  const ctx = canvas.getContext('2d')!, image = ctx.createImageData(canvas.width, canvas.height);
  const angleDelta = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    const az = (x / canvas.width - 0.5) * Math.PI * 2, elevation = (0.5 - y / (canvas.height - 1)) * Math.PI;
    const stripe = (center: number, width: number, strength: number) => strength * Math.exp(-0.5 * (angleDelta(az, center) / width) ** 2) * Math.exp(-0.5 * (elevation / 1.05) ** 4);
    const radiance = 0.06 + stripe(2.65, 0.42, 1.45) + stripe(0.25, 0.32, 1.1) + stripe(-2.25, 0.5, 0.25);
    const encoded = THREE.MathUtils.clamp(radiance / 2, 0, 1), value = THREE.ColorManagement.convert(new THREE.Color(encoded, encoded, encoded), THREE.LinearSRGBColorSpace, THREE.SRGBColorSpace).r * 255;
    const i = (y * canvas.width + x) * 4;
    image.data[i] = value; image.data[i + 1] = value; image.data[i + 2] = value; image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas); texture.mapping = THREE.EquirectangularReflectionMapping; texture.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer), target = pmrem.fromEquirectangular(texture);
  pmrem.dispose(); texture.dispose(); return target;
}
