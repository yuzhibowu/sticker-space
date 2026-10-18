import * as THREE from 'three';

// 扫描的微小法线噪声会把柔光切成碎斑。只平滑相邻面的法线，不移动顶点，
// 保持人体轮廓、贴纸接触位置和 BVH 三角形索引；不同 UV 分片共享同一法线。
export function smoothScanNormals(geometry: THREE.BufferGeometry) {
  const positions = geometry.getAttribute('position'), normals = geometry.getAttribute('normal'), index = geometry.index;
  if (!index || !normals) return;
  const groups = new Uint32Array(positions.count), byPosition = new Map<string, number>();
  const values: number[] = [], neighbours: number[][] = [];
  for (let i = 0; i < positions.count; i++) {
    const key = `${Math.round(positions.getX(i) * 1e5)},${Math.round(positions.getY(i) * 1e5)},${Math.round(positions.getZ(i) * 1e5)}`;
    let group = byPosition.get(key);
    if (group === undefined) {
      group = neighbours.length; byPosition.set(key, group); neighbours.push([]);
      values.push(normals.getX(i), normals.getY(i), normals.getZ(i));
    }
    groups[i] = group;
  }
  for (let i = 0; i < index.count; i += 3) {
    const a = groups[index.getX(i)], b = groups[index.getX(i + 1)], c = groups[index.getX(i + 2)];
    neighbours[a].push(b, c); neighbours[b].push(a, c); neighbours[c].push(a, b);
  }
  let current = new Float32Array(values), next = new Float32Array(values.length);
  for (let pass = 0; pass < 3; pass++) {
    for (let group = 0; group < neighbours.length; group++) {
      const offset = group * 3, x = current[offset], y = current[offset + 1], z = current[offset + 2];
      let sx = 0, sy = 0, sz = 0, count = 0;
      for (const neighbour of neighbours[group]) {
        const n = neighbour * 3;
        // 保留真正的锐边，避免把鼻尖、手指和衣带边缘磨平。
        if (x * current[n] + y * current[n + 1] + z * current[n + 2] < .75) continue;
        sx += current[n]; sy += current[n + 1]; sz += current[n + 2]; count++;
      }
      const nx = count ? x * .5 + sx / count * .5 : x;
      const ny = count ? y * .5 + sy / count * .5 : y;
      const nz = count ? z * .5 + sz / count * .5 : z;
      const length = Math.hypot(nx, ny, nz) || 1;
      next[offset] = nx / length; next[offset + 1] = ny / length; next[offset + 2] = nz / length;
    }
    [current, next] = [next, current];
  }
  for (let i = 0; i < positions.count; i++) {
    const offset = groups[i] * 3;
    normals.setXYZ(i, current[offset], current[offset + 1], current[offset + 2]);
  }
  normals.needsUpdate = true;
}
