import { expect, it } from 'vitest';
import { appleVendor } from './appleVendor';
const text = (value: string) => new TextEncoder().encode(value);
function atom(type: string, payload: Uint8Array) { const bytes = new Uint8Array(8 + payload.length); new DataView(bytes.buffer).setUint32(0, bytes.length); bytes.set(text(type), 4); bytes.set(payload, 8); return bytes; }
it('只改样本描述中的 vendor，压缩帧里的相同字节保持原样', () => {
  const entry = atom('ap4h', new Uint8Array(20)); entry.set(text('FFMP'), 20);
  const descriptions = new Uint8Array(8 + entry.length); new DataView(descriptions.buffer).setUint32(4, 1); descriptions.set(entry, 8);
  let moov = atom('stsd', descriptions);
  for (const type of ['stbl', 'minf', 'mdia', 'trak', 'moov']) moov = atom(type, moov);
  const media = atom('mdat', text('compressed-FFMP-frame'));
  const file = new Uint8Array(media.length + moov.length); file.set(media); file.set(moov, media.length);
  const result = appleVendor(file);
  expect(result.slice(0, media.length)).toEqual(media);
  expect(new TextDecoder().decode(result.slice(media.length))).toContain('apl0');
});
