import {describe,it,expect} from 'vitest';
import {zipSync,unzipSync} from 'fflate';
import {cleanLivePhotoPackage} from './livePhotoPackage';

describe('Live Photo download package',()=>{
 it('ignores macOS resource forks and guides while preserving the real pair',()=>{
  const jpg=new Uint8Array([1,2,3]),mov=new Uint8Array([4,5,6]);
  const bytes=zipSync({'sample/sample.jpg':jpg,'sample/sample.mov':mov,
   'sample/._sample.jpg':new Uint8Array([0]),'__MACOSX/sample/._sample.mov':new Uint8Array([0]),
   'sample/manifest.json':new Uint8Array([0]),'sample/使用说明.txt':new Uint8Array([0])});
  const cleaned=unzipSync(cleanLivePhotoPackage(bytes));
  expect(Object.keys(cleaned).sort()).toEqual(['sample/sample.jpg','sample/sample.mov']);
  expect(cleaned['sample/sample.jpg']).toEqual(jpg);
  expect(cleaned['sample/sample.mov']).toEqual(mov);
 });
 it('rejects a missing video even when its resource fork exists',()=>{
  expect(()=>cleanLivePhotoPackage(zipSync({'a.jpg':new Uint8Array([1]),'._a.mov':new Uint8Array([0])}))).toThrow('缺少');
 });
});
