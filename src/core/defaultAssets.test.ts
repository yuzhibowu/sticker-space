import {it,expect} from 'vitest';
import {demoAssets,refreshDefaultAssets} from './assets';
import {parseProject,portableProject} from './project';
import {POLE} from './types';
it('generated examples stay portable without fetching proprietary art',async()=>{
 const assets=demoAssets();expect(assets).toHaveLength(3);
 expect(assets.every(a=>a.image.startsWith('data:image/png;base64,iVBORw0KGgo'))).toBe(true);
 const backup=await portableProject({version:1,surface:POLE,assets,stickers:[]});
 expect(parseProject(backup).assets).toHaveLength(3);
});
it('refresh retains personal uploads and replaces generated defaults',()=>{
 const uploaded={...demoAssets()[0],id:'user-1',name:'personal'};
 const scene={version:1 as const,surface:POLE,assets:[{...demoAssets()[0],image:'old'},uploaded],stickers:[]};
 const restored=refreshDefaultAssets(scene);expect(restored.assets).toHaveLength(4);
 expect(restored.assets[0].image).toEqual(demoAssets()[0].image);expect(restored.assets[3]).toEqual(uploaded);
});
