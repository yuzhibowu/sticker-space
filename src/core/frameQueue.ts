/** Pointer events can arrive faster than display frames. Keep the latest position,
 * and flush it before committing so the final position and undo step are exact. */
export function createFrameQueue(schedule=(run:()=>void)=>requestAnimationFrame(run),cancel=(id:number)=>cancelAnimationFrame(id)) {
  let frame:number|null=null,pending:(()=>void)|null=null;
  const run=()=>{frame=null;const next=pending;pending=null;next?.();};
  return {
    push(task:()=>void){pending=task;if(frame===null)frame=schedule(run);},
    flush(){if(frame!==null)cancel(frame);frame=null;const next=pending;pending=null;next?.();},
    cancel(){if(frame!==null)cancel(frame);frame=null;pending=null;},
  };
}
