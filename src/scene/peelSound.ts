import {DEFAULT_PEEL_SOUND_URL,PeelAudioEngine} from '../vendor/sticker-forge/peel-audio';

type AudioEngine=Pick<PeelAudioEngine,'configure'|'unlock'|'reset'|'begin'|'update'|'end'|'stop'>;

/** One active pointer owns the foley. A detached, stationary or cancelled sheet stays quiet. */
export class StickerPeelSound {
  private prepared=false;
  private owner:string|null=null;
  constructor(private engine:AudioEngine=new PeelAudioEngine()){}
  prepare(){
    if(this.prepared)return;
    this.engine.configure({enabled:true,src:DEFAULT_PEEL_SOUND_URL,volume:.68,useBuiltInProfile:true});
    this.prepared=true;
  }
  begin(id:string){
    this.prepare();this.engine.unlock();this.engine.reset(0);this.engine.begin(0);this.owner=id;
  }
  move(id:string,progress:number,timestamp:number){
    if(this.owner===id)this.engine.update(progress,timestamp);
  }
  end(id:string,progress:number){
    if(this.owner!==id)return;
    this.engine.end(progress);this.owner=null;
  }
  cancel(id:string){
    if(this.owner!==id)return;
    this.engine.stop();this.owner=null;
  }
}

export const peelSound=new StickerPeelSound();
