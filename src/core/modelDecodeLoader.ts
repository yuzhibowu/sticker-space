import type {BufferGeometry} from 'three';
import {decodeModel} from './modelDecode';
import {restorePreparedModel,type PreparedModel} from './preparedModel';
/** Transfer scan parsing, normal smoothing and BVH construction off the UI thread. */
export async function decodeModelInBackground(downloaded:Uint8Array):Promise<BufferGeometry>{
 if(typeof Worker==='undefined')return decodeModel(downloaded);
 const worker=new Worker(new URL('./modelDecode.worker.ts',import.meta.url),{type:'module'});
 try{return await new Promise<BufferGeometry>((resolve,reject)=>{
  worker.onmessage=(event:MessageEvent<PreparedModel|{error:string}>)=>{
   if('error' in event.data){reject(new Error(event.data.error));return;}
   try{resolve(restorePreparedModel(event.data));}catch(error){reject(error);}
  };
  worker.onerror=()=>reject(new Error('模型后台处理失败，请重试。'));
  worker.onmessageerror=()=>reject(new Error('模型数据传输失败，请重试。'));
  worker.postMessage(downloaded,[downloaded.buffer]);
 });}finally{worker.terminate();}
}
