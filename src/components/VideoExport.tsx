import {AnimatedDetails} from './AnimatedDetails';
import {motionPlan} from '../core/motion';
import { useEffect, useRef, useState } from 'react';
import type { StickerSceneData } from '../core/types';
import { exportVideo, HelperRequiredError, type VideoProgress, type VideoResult } from '../export/video';
import { HELPER_DOWNLOAD } from '../export/nativeVideo';
import { videoDimensions, type VideoFormat, type VideoSettings } from '../export/videoSettings';
import { Parameter } from './Parameter';
import { startDownload, releaseDownload } from '../export/downloadFile';
export function Options<T extends string | number>({ label, value, choices, onChange }: { label: string; value: T; choices: readonly { value: T; label: string }[]; onChange: (value: T) => void }) {
  return <div className="field"><label>{label}</label><div className="options" role="group" aria-label={label}>{choices.map(choice => <button key={choice.value} aria-pressed={value === choice.value} className={value === choice.value ? 'selected' : ''} onClick={() => onChange(choice.value)}>{choice.label}</button>)}</div></div>;
}
type Task = { running?: boolean; progress?: VideoProgress; error?: string; helperRequired?: boolean; done?: boolean };
const formats: { format: VideoFormat; label: string }[] = [{ format: 'hevc', label: 'HEVC Alpha' }, { format: 'mov', label: 'ProRes 4444 MOV' }];
export function VideoExport({ background, scene, settings, onChange, onRunning, ready }: { background: string; scene: StickerSceneData; settings: VideoSettings; onChange: (value: VideoSettings) => void; onRunning: (count: number) => void; ready: boolean }) {
  const [tasks, setTasks] = useState<Record<VideoFormat, Task>>({ hevc: {}, mov: {} });
  const controllers = useRef<Partial<Record<VideoFormat, AbortController>>>({}), results = useRef<Partial<Record<VideoFormat, VideoResult>>>({});
  const mounted = useRef(true), timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const patch = (format: VideoFormat, task: Partial<Task>) => { if (mounted.current) setTasks(prev => ({ ...prev, [format]: { ...prev[format], ...task } })); };
  useEffect(() => { onRunning(Number(Boolean(tasks.hevc.running)) + Number(Boolean(tasks.mov.running))); }, [tasks.hevc.running, tasks.mov.running, onRunning]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; Object.values(controllers.current).forEach(c => c?.abort()); Object.values(results.current).forEach(r => { if (r) void releaseDownload(r); }); timers.current.forEach(clearTimeout); };
  }, []);
  const start = async (format: VideoFormat) => {
    if (controllers.current[format]) return;
    if (results.current[format]) void releaseDownload(results.current[format]!);
    const controller = new AbortController(); controllers.current[format] = controller;
    patch(format, { running: true, progress: { value: 0, label: '准备导出…' }, error: undefined, helperRequired: false, done: false });
    try {
      const result = await exportVideo(structuredClone(scene), { ...settings, ...(scene.motion?.mode==='sequence'?{motion:scene.motion,duration:motionPlan(scene.stickers,scene.motion).duration}:{}) }, format, controller.signal, progress => patch(format, { progress }), false, background);
      controller.signal.throwIfAborted();
      results.current[format] = result; startDownload(result); patch(format, { done: true });
      timers.current.push(setTimeout(() => { if (results.current[format] === result) patch(format, { done: false }); }, 5000));
    } catch (error) {
      patch(format, { error: controller.signal.aborted ? '已取消导出' : error instanceof Error ? error.message : String(error), helperRequired: error instanceof HelperRequiredError });
    } finally { delete controllers.current[format]; patch(format, { running: false, progress: undefined }); }
  };
  return <AnimatedDetails className="video-export export-drawer" open={false}>
    <summary>视频 · MOV</summary>
    <SharedVideoControls settings={settings} onChange={onChange} sequence={scene.motion?.mode==='sequence'} disabled={!ready || Boolean(tasks.hevc.running||tasks.mov.running)}/>
    <p className="section-help">{scene.motion?.mode==='sequence'?`${background==='transparent'?'透明底':'背景色'} · 完整贴入动画 · ${motionPlan(scene.stickers,scene.motion).duration.toFixed(2)} 秒`:`${background==='transparent'?'透明底':'背景色'} · 匀速旋转一整圈 · 可循环播放`}</p>
    {formats.map(({ format, label }) => {
      const task = tasks[format];
      return <div className="export-task" key={format}>
        <div className="export-action"><button className="export-button" disabled={task.running || !ready} onClick={() => void start(format)}>{task.running ? `正在导出 ${label}` : task.done ? `✓ ${label} 已完成` : `导出 ${label}`}</button>{task.running && <button className="cancel-button" aria-label={`取消 ${label} 导出`} onClick={() => controllers.current[format]?.abort()}>取消</button>}</div>
        {task.running && task.progress && <div className="export-progress" role="status"><progress value={task.progress.value} max={1} /><span>{task.progress.label}</span><span>{Math.round(task.progress.value * 100)}%</span></div>}
        {task.error && <p role="status" className="export-error">{task.error}</p>}
        {task.helperRequired && <div className="helper-install-prompt"><p>已安装：打开电脑上的“饼饼导出助手”，再点击导出。</p><a className="helper-download-button" href={HELPER_DOWNLOAD}>未安装？下载助手 · 约 3.4 MB</a><p>下载包很小，解压后打开即可，只需下载一次。支持 macOS 13 及以上。</p></div>}
      </div>;
    })}
  </AnimatedDetails>;
}

export function SharedVideoControls({settings,onChange,sequence,disabled,mobile=false}:{mobile?:boolean;settings:VideoSettings;onChange:(settings:VideoSettings)=>void;sequence:boolean;disabled:boolean}){
 const dimensions=videoDimensions(settings);
 return <fieldset disabled={disabled}>
    <div className="resolution-control"><Options label="导出分辨率" value={settings.resolution} choices={[{ value: 720, label: '720P' }, { value: 1080, label: '1080P' }, { value: 1440 as const, label: '2K' }, { value: 2160 as const, label: '4K' }]} onChange={resolution => onChange({ ...settings, resolution })} /><div className="resolution-size">输出尺寸：<output>{dimensions.width} × {dimensions.height} px</output></div></div>
    <Options label="画布比例" value={settings.aspect} choices={[{ value: '16:9', label: '16:9' }, { value: '1:1', label: '1:1' }, { value: '9:16', label: '9:16' }, { value: '4:5', label: '4:5' }, { value: '3:4', label: '3:4' }]} onChange={aspect => onChange({ ...settings, aspect })} />
    <Options label="帧率" value={settings.fps} choices={[{ value: 24, label: '24 fps' }, { value: 30, label: '30 fps' }, { value: 60, label: '60 fps' }]} onChange={fps => onChange({ ...settings, fps })} />

 </fieldset>;
}
