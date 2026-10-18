const MAX_SVG=1024*1024;
export function svgFromClipboardText(text:string):string|null{
 if(text.length>MAX_SVG*2)throw new Error('剪贴板矢量图过大，请控制在 1 MB 以内。');
 const svg=text.match(/<svg\b[\s\S]*?<\/svg\s*>|<svg\b[^>]*\/>/i)?.[0];
 if(svg){if(svg.length>MAX_SVG)throw new Error('SVG 请控制在 1 MB 以内。');return svg;}
 const uri=text.match(/data:image\/svg\+xml(?:;charset=[^;,"'\s]+)?(;base64)?,([^"'<>\s]+)/i);
 if(!uri)return null;
 try{return svgFromClipboardText(uri[1]?atob(uri[2]):decodeURIComponent(uri[2]));}catch{throw new Error('剪贴板里的 SVG 数据无效。');}
}
export async function svgFromPaste(data:Pick<DataTransfer,'getData'|'files'|'types'>):Promise<string|null>{
 const file=Array.from(data.files).find(f=>f.type==='image/svg+xml'||/\.svg$/i.test(f.name));
 if(file){if(file.size>MAX_SVG)throw new Error('SVG 请控制在 1 MB 以内。');return file.text();}
 for(const type of ['image/svg+xml','text/html','text/plain']){const text=data.getData(type);if(text){const source=svgFromClipboardText(text);if(source)return source;}}
 return null;
}
export const CLIPBOARD_HELPER_DOWNLOAD='/helper-build.html';
export class ClipboardHelperUnavailable extends Error {}
export async function nativeVector(pdf?:Blob):Promise<string>{
 let response:Response;
 try{response=await fetch(`http://127.0.0.1:43987/v1/${pdf?'vector/pdf':'clipboard/vector'}`,{method:'POST',headers:pdf?{'Content-Type':'application/pdf'}:{'X-BingBing-Paste':'1'},body:pdf,signal:AbortSignal.timeout(10000)});}catch{throw new ClipboardHelperUnavailable('这种剪贴板格式需要启动新版饼饼助手（0.7.0），然后再次粘贴。');}
 if(response.status===404)throw new ClipboardHelperUnavailable('请更新饼饼助手到 0.7.0，再次粘贴。');
 const result=await response.json();if(!response.ok)throw new Error(result.error||'剪贴板矢量图读取失败。');
 if(typeof result.source!=='string'||result.source.length>MAX_SVG)throw new Error('助手返回的矢量图无效。');
 return result.source;
}
