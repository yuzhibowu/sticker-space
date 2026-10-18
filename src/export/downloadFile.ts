// 所有导出生成完成后直接触发浏览器下载，保留原文件名；文件不上传到服务器。
export function startDownload(file:{url:string;name:string}) {
  const link=document.createElement('a'); link.href=file.url; link.download=file.name;
  link.style.display='none'; document.body.append(link); link.click(); link.remove();
}
export function releaseDownload(file:{url:string}) {
  if (file.url.startsWith('blob:')) URL.revokeObjectURL(file.url);
}
