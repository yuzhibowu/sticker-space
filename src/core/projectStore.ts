import type { StickerSceneData,SurfaceData } from './types';
import { parseProject } from './project';

const DB_NAME = 'sticker-lab-projects', STORE = 'drafts';
let database: Promise<IDBDatabase> | null = null;
let queue = Promise.resolve();
function openDatabase() {
  return database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = null; reject(request.error); };
  });
}
export function draftKey() {
  // 同源不同标签页各有草稿，验证页不会覆盖用户工作页；刷新继续使用原来的键。
  let key = sessionStorage.getItem('sticker-lab-draft');
  if (!key) { key = crypto.randomUUID(); sessionStorage.setItem('sticker-lab-draft', key); }
  return key;
}
function journalSurface(surface:SurfaceData):SurfaceData {if(surface.kind==='custom')return {...surface,source:'__model:'+surface.id};return surface.kind==='sign'&&surface.font?{...surface,font:{...surface.font,source:'__font:'+surface.font.id}}:surface;}
function restoreJournalSurface(surface:SurfaceData,scene:StickerSceneData):SurfaceData {
  if(surface.kind==='custom'&&surface.source.startsWith('__model:')){const saved=[scene.surface,...(scene.otherModels??[]).map(w=>w.surface)].find(s=>s.id===surface.id);if(saved?.kind!=='custom')throw new Error('模型尚未完整保存');return {...surface,source:saved.source};}
  if(surface.kind!=='sign'||!surface.font?.source.startsWith('__font:'))return surface;
  const saved=[scene.surface,...(scene.otherModels??[]).map(w=>w.surface)].find(s=>s.kind==='sign'&&s.font?.id===surface.font!.id);
  if(saved?.kind!=='sign'||!saved.font)throw new Error('字体尚未完整保存');
  return {...surface,font:saved.font};
}
export function writeJournal(scene: StickerSceneData) {
  const token = crypto.randomUUID();
  // 小型同步日志只存位置和素材 ID；PNG 留在 IndexedDB，避免 localStorage 容量不足。
  localStorage.setItem(`sticker-lab-journal:${draftKey()}`, JSON.stringify({ token, assets: scene.assets.map(a => a.id), stickers: scene.stickers, surface: journalSurface(scene.surface), view: scene.view, motion:scene.motion, otherModels:scene.otherModels?.map(w=>({...w,surface:journalSurface(w.surface)})) }));
  return token;
}
export function saveDraft(scene: StickerSceneData, token?: string) {
  const key = draftKey();
  queue = queue.catch(() => {}).then(async () => {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(scene, key); tx.objectStore(STORE).put(scene, 'latest');
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
    const journalKey = `sticker-lab-journal:${key}`, journal = localStorage.getItem(journalKey);
    if (token && journal && JSON.parse(journal).token === token) localStorage.removeItem(journalKey);
  });
  return queue;
}
export async function loadDraft(): Promise<StickerSceneData | null> {
  const db = await openDatabase(), key = draftKey();
  const stored = await new Promise<StickerSceneData | null>((resolve, reject) => {
    const store = db.transaction(STORE).objectStore(STORE), own = store.get(key);
    own.onsuccess = () => {
      if (own.result) resolve(own.result);
      else { const latest = store.get('latest'); latest.onsuccess = () => resolve(latest.result ?? null); latest.onerror = () => reject(latest.error); }
    };
    own.onerror = () => reject(own.error);
  });
  if (!stored) return null;
  const scene = parseProject(stored), journal = localStorage.getItem(`sticker-lab-journal:${key}`);
  if (journal) {
    try {
      const patch = JSON.parse(journal);
      if (patch.assets.length === scene.assets.length && patch.assets.every((id: string, i: number) => scene.assets[i].id === id)) return parseProject({ ...scene, surface: restoreJournalSurface(patch.surface,scene), stickers: patch.stickers, view: patch.view, motion:patch.motion, otherModels:patch.otherModels?.map((w:NonNullable<StickerSceneData['otherModels']>[number])=>({...w,surface:restoreJournalSurface(w.surface,scene)})) });
    } catch { /* 日志损坏时保留最近一次完整且有效的工程。 */ }
  }
  return scene;
}
