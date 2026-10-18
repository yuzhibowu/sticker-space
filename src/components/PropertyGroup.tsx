import {useId,type ReactNode} from 'react';
import {AnimatedDetails} from './AnimatedDetails';
export function PropertyGroup({label,className,defaultOpen=false,children,expansionRequest}:{label:string;className:string;defaultOpen?:boolean;children:ReactNode;expansionRequest?:{id:number;open:boolean}}){
 const maskId=useId();
 return <AnimatedDetails className={`property-group ${className}`} open={defaultOpen} expansionRequest={expansionRequest}>
  <summary className="group-title"><svg className="group-disclosure" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><defs><mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24"><rect width="24" height="24" fill="white" stroke="none"/><path d="m10 8 4 4-4 4" fill="none" stroke="black" strokeWidth="1.5"/></mask></defs><circle className="group-disclosure-core" cx="12" cy="12" r="9" mask={`url(#${maskId})`}/><circle cx="12" cy="12" r="9"/><path className="group-disclosure-arrow" d="m10 8 4 4-4 4"/></svg>{label}</summary>
  {children}
 </AnimatedDetails>;
}
