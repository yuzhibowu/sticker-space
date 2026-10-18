import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { appleVendor } from './appleVendor';
function wait<T>(promise: Promise<T>, signal: AbortSignal, timeout = 120_000): Promise<T> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(reject, new Error('浏览器编码超时，请降低分辨率或周期后重试')), timeout);
    const abort = () => finish(reject, new DOMException('已取消导出', 'AbortError'));
    const finish = (callback: (value: any) => void, value: unknown) => { clearTimeout(timer); signal.removeEventListener('abort', abort); callback(value); };
    signal.addEventListener('abort', abort, { once: true }); promise.then(value => finish(resolve, value), error => finish(reject, error));
  });
}
export async function createBrowserProResEncoder(fps: number, totalFrames: number, signal: AbortSignal, progress: (value: number) => void) {
  const ffmpeg = new FFmpeg(); let latestLog = '';
  const urls: string[] = [];
  const dispose = () => { ffmpeg.terminate(); urls.forEach(URL.revokeObjectURL); };
  try {
    ffmpeg.on('log', ({ message }) => { latestLog = message; });
    ffmpeg.on('progress', ({ progress: value }) => progress(Math.max(0, Math.min(1, value || 0))));
    // 单线程核心不要求跨域隔离；Vite 打包 @ffmpeg/ffmpeg 的专用 Worker。
    const coreURL = await wait(toBlobURL('/ffmpeg-core/ffmpeg-core.js', 'text/javascript').then(url => { if (signal.aborted) URL.revokeObjectURL(url); return url; }), signal, 180_000); urls.push(coreURL);
    const wasmURL = await wait(toBlobURL('/ffmpeg-core/ffmpeg-core.wasm', 'application/wasm').then(url => { if (signal.aborted) URL.revokeObjectURL(url); return url; }), signal, 180_000); urls.push(wasmURL);
    await wait(ffmpeg.load({ coreURL, wasmURL }), signal, 180_000);
  } catch (error) { dispose(); throw error; }
  const digits = Math.max(5, String(totalFrames - 1).length);
  return {
    async addFrame(index: number, blob: Blob) {
      const bytes = new Uint8Array(await wait(blob.arrayBuffer(), signal));
      await wait(ffmpeg.writeFile(`frame_${String(index).padStart(digits, '0')}.png`, bytes), signal);
    },
    async finish() {
      const outputName = 'output.mov';
      const args = ['-framerate', String(fps), '-i', `frame_%0${digits}d.png`, '-c:v', 'prores_ks', '-profile:v', '5', '-bits_per_mb', '8000', '-pix_fmt', 'yuva444p10le', '-alpha_bits', '16', '-vendor', 'apl0', outputName];
      const code = await wait(ffmpeg.exec(args), signal, 600_000);
      if (code !== 0) throw new Error(`ProRes 编码失败 (${code})：${latestLog}`);
      const output = await wait(ffmpeg.readFile(outputName), signal);
      if (typeof output === 'string') throw new Error('编码器未返回视频文件');
      return new Blob([appleVendor(output) as BlobPart], { type: 'video/quicktime' });
    },
    dispose,
  };
}
