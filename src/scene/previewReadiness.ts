/** Driver/texture readiness is a warm-up, never an indefinite navigation lock. */
export async function waitForPreview(check:()=>boolean,nextFrame:()=>Promise<void>,cancelled:()=>boolean,timeoutMs:number,now:()=>number=()=>performance.now()){
 const started=now();
 while(!cancelled()&&!check()){
  if(now()-started>=timeoutMs)return false;
  await nextFrame();
 }
 return !cancelled();
}
