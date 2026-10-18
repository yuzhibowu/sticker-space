/**
 * r169 输出 normalMap 时漏写 RGB → 切线法线的解码。
 * 标准 8 位法线图需 scale=(2,2,2,1)、bias=(-1,-1,-1,0)，且颜色空间为 raw。
 * 只补正常贴图采样器，不修改图片像素或其他材质；已存在的解码参数保持不动。
 * 依据：https://openusd.org/release/spec_usdpreviewsurface.html
 */
export function prepareNormalTextures(usda: string) {
  return usda.replace(/(def Shader "Texture_\d+_normal"\s*\{)([^{}]*)(\})/g, (_match, start, body: string, end) => {
    let fixed = body;
    if (!/inputs:scale\s*=/.test(fixed)) fixed += '\n\t\t\tfloat4 inputs:scale = (2, 2, 2, 1)\n';
    if (!/inputs:bias\s*=/.test(fixed)) fixed += '\t\t\tfloat4 inputs:bias = (-1, -1, -1, 0)\n';
    return start + fixed + end;
  });
}
