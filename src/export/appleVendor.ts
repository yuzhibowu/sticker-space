// 仅改 MOV 视频样本描述中的厂商字段；不能在压缩帧字节中全局替换 FFMP。
export function appleVendor(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
  const containers = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl']);
  function scan(start: number, end: number) {
    for (let offset = start; offset + 8 <= end;) {
      let size = view.getUint32(offset), header = 8;
      if (size === 1) { if (offset + 16 > end) return; size = Number(view.getBigUint64(offset + 8)); header = 16; }
      if (size === 0) size = end - offset;
      if (!Number.isSafeInteger(size) || size < header || offset + size > end) return;
      const type = text(offset + 4);
      if (containers.has(type)) scan(offset + header, offset + size);
      if (type === 'stsd') {
        if (size < header + 8) return;
        let entry = offset + header + 8;
        const count = view.getUint32(offset + header + 4);
        for (let i = 0; i < count && entry + 24 <= offset + size; i++) {
          const length = view.getUint32(entry);
          if (length < 24 || entry + length > offset + size) break;
          if (['ap4h', 'ap4x'].includes(text(entry + 4)) && text(entry + 20) === 'FFMP') bytes.set([97, 112, 108, 48], entry + 20);
          entry += length;
        }
      }
      offset += size;
    }
  }
  scan(0, bytes.length); return bytes;
}
