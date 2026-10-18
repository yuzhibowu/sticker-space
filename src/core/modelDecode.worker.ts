import {prepareModel} from './preparedModel';
const scope=self as unknown as {onmessage:((event:MessageEvent<Uint8Array>)=>void)|null;postMessage:(data:unknown,transfer?:Transferable[])=>void};
scope.onmessage=event=>{
 try{
  const data=prepareModel(event.data);
  const buffers=[data.position.buffer,data.normal.buffer,data.uv.buffer,...data.tree.roots,data.tree.index!.buffer];
  scope.postMessage(data,[...new Set(buffers)] as ArrayBuffer[]);
 }catch(error){scope.postMessage({error:error instanceof Error?error.message:String(error)});}
};
