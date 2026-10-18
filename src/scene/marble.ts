import * as THREE from 'three';
const fract = (x: number) => x - Math.floor(x);
const hash = (x: number, y: number) => fract(Math.sin(x * 127.1 + y * 311.7 + 1837) * 43758.5453);
function noise(x: number, y: number) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = fract(x), fy = fract(y);
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix, iy), hash(ix + 1, iy), sx), THREE.MathUtils.lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), sx), sy);
}
// 细腻灰白大理石：保留淡淡的矿物色差，去掉水泥般的砂粒与黑孔。
// 使用标准颜色、微法线和粗糙度贴图，网页、视频和 USDZ 都能保存同一种表面。
function createMarbleMaterial() {
  const size = 1024, canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const normalCanvas = canvas.cloneNode() as HTMLCanvasElement, roughCanvas = canvas.cloneNode() as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!, nctx = normalCanvas.getContext('2d')!, rctx = roughCanvas.getContext('2d')!;
  const color = ctx.createImageData(size, size), normals = nctx.createImageData(size, size), roughness = rctx.createImageData(size, size);
  const relief = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const cloud = noise(x / 190, y / 190), mineral = noise(x / 28, y / 28), fine = hash(x, y);
    const v = 222 + (cloud - .5) * 7 + (mineral - .5) * 2 + (fine - .5) * .8, i = (y * size + x) * 4;
    color.data.set([v, v * .997, v * .988, 255], i);
    // 微起伏只影响很近处的柔和反光，不制造肉眼可见的颗粒和坑点。
    relief[y * size + x] = mineral * .025 + fine * .002;
    const r = (0.9 + cloud * .08) * 255;
    roughness.data.set([r, r, r, 255], i);
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const sample = (xx: number, yy: number) => relief[((yy + size) % size) * size + (xx + size) % size];
    const nx = (sample(x - 1, y) - sample(x + 1, y)) * .1, ny = (sample(x, y + 1) - sample(x, y - 1)) * .1;
    const inv = 1 / Math.hypot(nx, ny, 1), i = (y * size + x) * 4;
    normals.data.set([(nx * inv * .5 + .5) * 255, (ny * inv * .5 + .5) * 255, (inv * .5 + .5) * 255, 255], i);
  }
  ctx.putImageData(color, 0, 0); nctx.putImageData(normals, 0, 0); rctx.putImageData(roughness, 0, 0);
  const map = new THREE.CanvasTexture(canvas), normalMap = new THREE.CanvasTexture(normalCanvas), roughnessMap = new THREE.CanvasTexture(roughCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  for (const t of [map, normalMap, roughnessMap]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 4); t.anisotropy = 8; }
  const material = new THREE.MeshPhysicalMaterial({
    map, normalMap, roughnessMap, normalScale: new THREE.Vector2(.2, .2), color: '#dfddd8',
    roughness: .43, metalness: 0, ior: 1.48, specularIntensity: .55,
    envMapIntensity: .24, clearcoat: 0,
  });
  material.userData.stone = true;
  return material;
}

let cachedMarble:THREE.MeshPhysicalMaterial|undefined;
export function marbleMaterial() {
  cachedMarble??=createMarbleMaterial();
  const material=cachedMarble.clone();
  for(const key of ['map','normalMap','roughnessMap'] as const){material[key]=cachedMarble[key]!.clone();material[key]!.needsUpdate=true;}
  return material;
}
