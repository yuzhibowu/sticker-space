declare module 'three/examples/jsm/libs/opentype.module.js' {
  const opentype:{parse:(buffer:ArrayBuffer)=>{unitsPerEm:number;ascender:number;descender:number;charToGlyph:(c:string)=>{index:number;advanceWidth:number;path:{commands:{type:string;x?:number;y?:number;x1?:number;y1?:number;x2?:number;y2?:number}[]}}}};
  export default opentype;
}
