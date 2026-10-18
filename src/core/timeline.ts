export const SLAP_DURATION = 0.16;
// 一个纯函数同时供实时预览和未来离线逐帧输出调用，不累计 delta，不依赖帧率。
export function stickerPoseAtTime(time: number, placedAt: number) {
  const t = Math.max(0, Math.min(1, (time - placedAt) / SLAP_DURATION));
  const contact = 0.72;
  const approach = Math.min(1, t / contact);
  const distance = 0.34 * (1 - approach * approach * approach);
  const scale = t <= contact ? 1 : 1 + Math.sin((t - contact) / (1 - contact) * Math.PI) * 0.045;
  return { visible: time >= placedAt, complete: time - placedAt >= SLAP_DURATION - 1e-9, distance, scale, tilt: (1 - approach) * 0.16 };
}
export function frameTimes(fps: number, duration: number) {
  return Array.from({ length: Math.round(fps * duration) }, (_, i) => i / fps);
}
