/** Local adapter: the bundled Vite asset is fetched from this app's own origin. */
export async function loadAudioSource(src:string,signal?:AbortSignal):Promise<ArrayBuffer>{
  const response=await fetch(src,{signal});
  if(!response.ok)throw new Error(`Peel audio request failed: ${response.status}`);
  return response.arrayBuffer();
}
