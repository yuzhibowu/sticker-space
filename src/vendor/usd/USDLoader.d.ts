import {Loader,Group,LoadingManager} from 'three';
export class USDLoader extends Loader<Group> { constructor(manager?:LoadingManager); parse(buffer:ArrayBuffer|string,path?:string,onLoad?:(group:Group)=>void,onError?:(error:unknown)=>void):Group; }
