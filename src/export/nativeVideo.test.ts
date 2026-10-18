import { afterEach, expect, it, vi } from 'vitest';
import { createNativeFrameQueue, detectNativeExporter, NativeCodecUnavailableError } from './nativeVideo';
afterEach(() => vi.unstubAllGlobals());
it('连接失败与已连接但不支持 HEVC Alpha 分开提示，ProRes 仍可使用',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({available:true,hevcAlpha:false,prores4444:true,architecture:'x86_64'}))));
 const signal=new AbortController().signal;
 await expect(detectNativeExporter('hevc',signal)).rejects.toBeInstanceOf(NativeCodecUnavailableError);
 expect(await detectNativeExporter('mov',signal)).toMatchObject({prores4444:true,architecture:'x86_64'});
 vi.stubGlobal('fetch',vi.fn(async()=>{throw new TypeError('offline');}));
 expect(await detectNativeExporter('hevc',signal)).toBeNull();
});
it('慢编码器下只保留两批，严格按序上传，取消会打断挂起请求', async () => {
  const uploads: Blob[] = [], finishes: (() => void)[] = [], signals: AbortSignal[] = [];
  vi.stubGlobal('fetch', vi.fn((_url: string, request: RequestInit) => {
    uploads.push(request.body as Blob); signals.push(request.signal as AbortSignal);
    return new Promise<Response>((resolve, reject) => {
      finishes.push(() => resolve(new Response('{}')));
      request.signal?.addEventListener('abort', () => reject(new DOMException('cancel', 'AbortError')));
    });
  }));
  const signal = new AbortController(), queue = createNativeFrameQueue({ id: 'job', endpoint: '/native', frameBatch: true }, signal.signal);
  for (let i = 0; i < 11; i++) await queue.append(new Blob([String(i)]));
  expect(uploads).toHaveLength(1);
  let released = false;
  const blocked = queue.append(new Blob(['11'])).then(() => { released = true; });
  await Promise.resolve(); expect(released).toBe(false);
  finishes[0](); await blocked;
  expect(uploads).toHaveLength(2);
  const readBatch = async (blob: Blob) => {
    const bytes = new Uint8Array(await blob.arrayBuffer()), view = new DataView(bytes.buffer); const values: string[] = [];
    for (let offset = 0; offset < bytes.length;) { const size = view.getUint32(offset); offset += 4; values.push(new TextDecoder().decode(bytes.slice(offset, offset + size))); offset += size; }
    return values;
  };
  expect(await readBatch(uploads[0])).toEqual(['0','1','2','3','4','5']);
  expect(await readBatch(uploads[1])).toEqual(['6','7','8','9','10','11']);
  signal.abort(); await queue.cancel(); expect(signals[1].aborted).toBe(true);
  await expect(queue.append(new Blob(['late']))).rejects.toThrow();
});
