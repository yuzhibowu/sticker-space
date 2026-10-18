export type OrbitKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown';
export type OrbitVelocity = { x: number; y: number };
const SPEED = 1.25; // 按住时每秒转动的弧度
const DECAY = 9; // 松开后指数缓出的衰减系数
export const isOrbitKey = (key: string): key is OrbitKey => ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key);

// 用解析积分计算衰减，保证不同帧率下的惯性距离一致。
export function stepKeyboardOrbit(keys: ReadonlySet<OrbitKey>, velocity: OrbitVelocity, seconds: number) {
  const x = Number(keys.has('ArrowLeft')) - Number(keys.has('ArrowRight'));
  const y = Number(keys.has('ArrowUp')) - Number(keys.has('ArrowDown'));
  if (keys.size) {
    const length = Math.hypot(x, y) || 1;
    const next = { x: x / length * SPEED, y: y / length * SPEED };
    return { velocity: next, delta: { x: next.x * seconds, y: next.y * seconds } };
  }
  const decay = Math.exp(-DECAY * seconds), distance = (1 - decay) / DECAY;
  return { velocity: { x: velocity.x * decay, y: velocity.y * decay }, delta: { x: velocity.x * distance, y: velocity.y * distance } };
}
