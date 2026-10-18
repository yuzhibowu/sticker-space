import {videoDimensions,type VideoSettings} from './videoSettings';
import type { VideoFormat } from './videoSettings';
// PNG 微动画的有序 PNG 批量协议：一个上传批次与下一批渲染重叠。
export type NativeExporter = { endpoint: string; frameBatch: boolean; hevcAlpha: boolean; prores4444: boolean; highQualityHevc?:boolean; helperVersion?:string; architecture?:string; maxFrames?:number; livePhoto?:boolean };
export type NativeSession = { id: string; endpoint: string; frameBatch: boolean };
export const ENDPOINT = 'http://127.0.0.1:43987/v1';
export const HELPER_DOWNLOAD = '/helper-build.html';
export async function detectNativeExporter(format: VideoFormat, signal: AbortSignal): Promise<NativeExporter | null> {
  signal.throwIfAborted();
  try {
    const timeout = AbortSignal.timeout(2500);
    const response = await fetch(`${ENDPOINT}/capabilities`, { cache: 'no-store', signal: AbortSignal.any([signal, timeout]) });
    if (!response.ok) return null;
    const caps = await response.json();
    if(caps.available && format==='hevc' && !caps.hevcAlpha)throw new NativeCodecUnavailableError('助手已连接，但这台 Mac 没有可用的 HEVC Alpha 编码器。请使用 ProRes 4444 MOV。');
    return caps.available && (format === 'hevc' ? caps.hevcAlpha : caps.prores4444) ? { ...caps, endpoint: ENDPOINT } : null;
  } catch(error) { signal.throwIfAborted(); if(error instanceof NativeCodecUnavailableError)throw error; return null; }
}
export class NativeCodecUnavailableError extends Error {}
export async function checkNativeResponse(response: Response) {
  if (!response.ok) {
    const text = await response.text();
    let message = text;
    try { message = JSON.parse(text).error || text; } catch { /* HTTP 错误正文 */ }
    throw new Error(message || `本机助手返回 ${response.status}`);
  }
  return response;
}
export async function startNativeExport(caps: NativeExporter, format: VideoFormat, fps: number, totalFrames: number, outputName: string, signal: AbortSignal, settings?:VideoSettings): Promise<NativeSession> {
  const response = await checkNativeResponse(await fetch(`${caps.endpoint}/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ format, fps, totalFrames, outputName,...(settings?videoDimensions(settings):{}) }), signal }));
  return { ...await response.json(), endpoint: caps.endpoint, frameBatch: caps.frameBatch };
}
async function appendFrames(session: NativeSession, frames: Blob[], signal: AbortSignal) {
  if (!session.frameBatch || frames.length === 1) {
    for (const frame of frames) await checkNativeResponse(await fetch(`${session.endpoint}/frame/${session.id}`, { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: frame, signal }));
    return;
  }
  const parts: BlobPart[] = [];
  for (const frame of frames) {
    const size = new Uint8Array(4); new DataView(size.buffer).setUint32(0, frame.size, false); parts.push(size, frame);
  }
  await checkNativeResponse(await fetch(`${session.endpoint}/frames/${session.id}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: new Blob(parts), signal }));
}
export function createNativeFrameQueue(session: NativeSession, signal: AbortSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort(); signal.addEventListener('abort', abort, { once: true }); if (signal.aborted) abort();
  let frames: Blob[] = [], bytes = 0, pending = Promise.resolve(), failure: unknown = null;
  const checkQueue = () => { controller.signal.throwIfAborted(); if (failure) throw failure; };
  const flush = async () => {
    await pending; checkQueue(); if (!frames.length) return;
    const batch = frames; frames = []; bytes = 0;
    pending = appendFrames(session, batch, controller.signal).catch(error => { failure = error; });
  };
  return {
    async append(frame: Blob) { checkQueue(); frames.push(frame); bytes += frame.size; if (frames.length >= 6 || bytes >= 24 * 1024 * 1024) await flush(); },
    async finish() { await flush(); await pending; checkQueue(); signal.removeEventListener('abort', abort); },
    async cancel() { controller.abort(); frames = []; bytes = 0; signal.removeEventListener('abort', abort); await pending; },
  };
}
export async function finishNativeExport(session: NativeSession, signal: AbortSignal): Promise<{ downloadUrl: string; outputName: string }> {
  const response = await checkNativeResponse(await fetch(`${session.endpoint}/finish/${session.id}`, { method: 'POST', signal })); return response.json();
}
export function cancelNativeExport(session: NativeSession) {
  void fetch(`${session.endpoint}/cancel/${session.id}`, { method: 'POST', keepalive: true }).catch(() => {});
}
