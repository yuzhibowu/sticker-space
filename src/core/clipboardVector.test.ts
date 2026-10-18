import {expect,it} from 'vitest';
import {svgFromClipboardText,svgFromPaste} from './clipboardVector';
const svg='<svg xmlns="http://www.w3.org/2000/svg"><path fill="#ff0000" d="M0 0h10v10z"/></svg>';
it('extracts real SVG from text, HTML and SVG data URLs without converting PNGs to vectors',()=>{
 expect(svgFromClipboardText(svg)).toBe(svg);
 expect(svgFromClipboardText(`<div>${svg}</div>`)).toBe(svg);
 expect(svgFromClipboardText(`<img src="data:image/svg+xml,${encodeURIComponent(svg)}">`)).toBe(svg);
 expect(svgFromClipboardText(`<img src="data:image/svg+xml;base64,${btoa(svg)}">`)).toBe(svg);
 expect(svgFromClipboardText('<img src="data:image/png;base64,aaaa">')).toBeNull();
 expect(svgFromClipboardText('普通路牌文字')).toBeNull();
 expect(()=>svgFromClipboardText('x'.repeat(3*1024*1024))).toThrow();
});
it('prefers vector files and rich vector content over plain text',async()=>{
 const file=new Blob([svg],{type:'image/svg+xml'}) as File;
 Object.defineProperty(file,'name',{value:'shape.svg'});
 expect(await svgFromPaste({files:[file] as unknown as FileList,types:['Files'],getData:()=>''})).toBe(svg);
 expect(await svgFromPaste({files:[] as unknown as FileList,types:['text/html','text/plain'],getData:type=>type==='text/html'?`<div>${svg}</div>`:'普通文字'})).toBe(svg);
});
