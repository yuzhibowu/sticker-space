/** Preserve relative paths when a GLTF folder is dragged onto the import button. */
export async function modelDropFiles(transfer:DataTransfer):Promise<File[]> {
 const entries=Array.from(transfer.items).filter(item=>item.kind==='file').map(item=>item.webkitGetAsEntry());
 const fallback=Array.from(transfer.files);
 if(!entries.some(Boolean))return fallback;
 const files:File[]=[];
 const visit=async(entry:FileSystemEntry,path=''):Promise<void>=>{
  const relative=path+entry.name;
  if(entry.isFile){
   const file=await new Promise<File>((resolve,reject)=>(entry as FileSystemFileEntry).file(resolve,reject));
   Object.defineProperty(file,'webkitRelativePath',{value:relative});files.push(file);return;
  }
  const reader=(entry as FileSystemDirectoryEntry).createReader();
  while(true){const batch=await new Promise<FileSystemEntry[]>((resolve,reject)=>reader.readEntries(resolve,reject));if(!batch.length)break;for(const child of batch)await visit(child,relative+'/');}
 };
 for(const entry of entries)if(entry)await visit(entry);
 return files;
}
