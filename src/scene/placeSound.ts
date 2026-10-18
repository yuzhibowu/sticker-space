import soundUrl from '../assets/audio/sticker-place.wav?url';
import {getSharedAudioContext} from '../vendor/sticker-forge/peel-audio';
import {SLAP_DURATION} from '../core/timeline';

let buffer:Promise<AudioBuffer>|undefined;
const voices:AudioBufferSourceNode[]=[];
export function preparePlaceSound(){
 const context=getSharedAudioContext();if(!context)return;
 if(!buffer)buffer=fetch(soundUrl).then(response=>{if(!response.ok)throw new Error('Placement sound unavailable');return response.arrayBuffer();}).then(bytes=>context.decodeAudioData(bytes)).catch(error=>{buffer=undefined;throw error;});
 return buffer;
}
/** Only the successful placement command calls this; restored/exported stickers stay quiet. */
export function playPlaceSound(){
 const context=getSharedAudioContext();if(!context)return;
 const landedAt=performance.now()+SLAP_DURATION*1000;
 // Resume synchronously inside the click/pointer-up gesture for iPhone/iPad Safari.
 const resumed=context.state==='suspended'?context.resume():Promise.resolve();
 const ready=preparePlaceSound();if(!ready)return;
 void Promise.all([resumed,ready]).then(([,audio])=>{
  if(performance.now()-landedAt>350)return;
  while(voices.length>=5)voices.shift()?.stop();
  const source=context.createBufferSource(),gain=context.createGain();source.buffer=audio;gain.gain.value=.7;source.connect(gain);gain.connect(context.destination);voices.push(source);
  source.onended=()=>{const index=voices.indexOf(source);if(index>=0)voices.splice(index,1);source.disconnect();gain.disconnect();};
  source.start(context.currentTime+Math.max(0,landedAt-performance.now())/1000);
 }).catch(()=>{});
}
