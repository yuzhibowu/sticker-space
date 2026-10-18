import type { StickerSceneData, StickerData } from '../core/types';
export function StickerEditor({ scene, selected, onSelect, onDelete }: {
  scene: StickerSceneData; selected?: StickerData; onSelect: (id: string) => void;
  onDelete: () => void;
}) {
  return <div className="sticker-editor">
    <div className="placed-list" role="group" aria-label="已贴贴纸列表">{[...scene.stickers].reverse().map((s, reverseIndex) => {
      const a = scene.assets.find(a => a.id === s.assetId)!;
      const index = scene.stickers.length - reverseIndex;
      return <button key={s.id} className={selected?.id === s.id ? 'selected' : ''} aria-label={`选择已贴贴纸 ${index} ${a.name}`} aria-pressed={selected?.id === s.id} onClick={() => onSelect(s.id)}><img src={a.image} alt="" /><span>{a.name}</span><small>{index}</small></button>;
    })}</div>
    {selected ? <>
      <div className="selection-name">正在编辑 · {scene.assets.find(a => a.id === selected.assetId)?.name}</div>
      <button className="outline-button" onClick={onDelete}>删除选中贴纸</button>

    </> : null}
  </div>;
}
