import { expect, it } from 'vitest';
import { prepareNormalTextures } from './normalTextures';

it('USDZ 中中性法线解码为 (0,0,1)，只补法线采样器且可重复运行', () => {
  const diffuse = 'def Shader "Texture_9_diffuse" { token inputs:sourceColorSpace = "sRGB" }';
  const source = `def Shader "Texture_8_normal" { token inputs:sourceColorSpace = "raw" }\n${diffuse}`;
  const fixed = prepareNormalTextures(source);
  const scale = fixed.match(/inputs:scale = \(([^)]+)\)/)![1].split(',').map(Number);
  const bias = fixed.match(/inputs:bias = \(([^)]+)\)/)![1].split(',').map(Number);
  expect([0.5, 0.5, 1].map((v, i) => v * scale[i] + bias[i])).toEqual([0, 0, 1]);
  expect(fixed).toContain(diffuse); expect(fixed).toContain('sourceColorSpace = "raw"');
  expect(prepareNormalTextures(fixed)).toBe(fixed);
});
