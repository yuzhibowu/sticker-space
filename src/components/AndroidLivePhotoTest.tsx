import {useState} from 'react';
import {AnimatedDetails} from './AnimatedDetails';

/** Temporary Android entry until social-app recognition is verified on a physical phone. */
export function AndroidLivePhotoTest(){
 const [download,setDownload]=useState('');
 return <AnimatedDetails className="live-photo-export export-drawer android-live-test" open>
  <summary>实况照片 · Live Photo</summary>
  <div className="section-label">安卓实况 · 兼容性测试</div>
  <p className="section-help">先测试手机能否识别实况，无需安装电脑导出助手。测试图是彩色动态图案，不是当前模型。</p>
  <a className="mobile-live-install-button" href="/android-live-test/bingbing-oplus-v1-MP.jpg" download="bingbing-oplus-v1-MP.jpg" onClick={()=>setDownload('A')}>① 下载 A · OPPO／一加实况测试图</a>
  <p className="section-help">一加 8T / ColorOS 14 先测试 A。1080P · 60 帧 · 3 秒。</p>
  <a className="mobile-live-install-button android-live-secondary" href="/android-live-test/bingbing-google-v1-MP.jpg" download="bingbing-google-v1-MP.jpg" onClick={()=>setDownload('B')}>② A 不识别，再下载 B · 通用格式</a>
  <p className="section-help">下载后，到小红书和微信朋友圈的选图页面，检查有没有“实况”标记、选中后能否动态预览。先不用发布。</p>
  <p className="section-help">找不到文件时，在文件管理的“下载”中把原 JPG 移到 Pictures（图片）目录，再重新打开 App 选图。不要截图或重新存图。</p>
  {download&&<p className="section-help" role="status">已请求下载 {download}，请在浏览器下载列表中确认完成。</p>}
  <a className="text-button" href="/android-live-test.html" target="_blank" rel="noopener noreferrer">查看完整测试说明 ↗</a>
 </AnimatedDetails>;
}
