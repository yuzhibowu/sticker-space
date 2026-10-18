import * as THREE from 'three';

// Each of the four comparisons uses the receiver's depth at that texel, not
// the centre depth. Otherwise a grazing plane shadows itself inside the PCF
// footprint, producing stripes even with a high-resolution shadow map.
const bilinear = /* glsl */`
vec2 signReceiverSlope(vec3 coordinate) {
  vec3 dx = dFdx(coordinate), dy = dFdy(coordinate);
  float determinant = dx.x * dy.y - dx.y * dy.x;
  float scale = length(dx.xy) * length(dy.xy);
  // Edge-on / degenerate derivatives must not produce infinities.
  if (abs(determinant) <= max(scale * 0.000001, 1e-20)) return vec2(0.0);
  return vec2(dy.y * dx.z - dx.y * dy.z, dx.x * dy.z - dy.x * dx.z) / determinant;
}
float signPlaneCompare(sampler2D depths, vec2 uv, vec3 receiver, vec2 slope, float softness) {
  float compare = receiver.z - softness + clamp(dot(uv - receiver.xy, slope), -0.01, 0.01);
  float depth = unpackRGBAToDepth(texture2D(depths, uv));
  return smoothstep(compare - softness, compare + softness, depth);
}
float signBilinearShadow(sampler2D depths, vec2 uv, vec2 mapSize, vec3 receiver, vec2 slope, float softness) {
  vec2 pixel = uv * mapSize - 0.5;
  vec2 fraction = fract(pixel);
  vec2 origin = (floor(pixel) + 0.5) / mapSize;
  vec2 texel = 1.0 / mapSize;
  return mix(
    mix(signPlaneCompare(depths, origin, receiver, slope, softness), signPlaneCompare(depths, origin + vec2(texel.x, 0.0), receiver, slope, softness), fraction.x),
    mix(signPlaneCompare(depths, origin + vec2(0.0, texel.y), receiver, slope, softness), signPlaneCompare(depths, origin + texel, receiver, slope, softness), fraction.x),
    fraction.y
  );
}
`;
// Fixed disk samples in the receiver plane: no frame-to-frame random noise.
const taps = [
  [-0.942, -0.399], [0.946, -0.769], [-0.094, -0.929], [0.345, 0.294], [-0.916, 0.458], [-0.815, -0.879], [-0.382, 0.277], [0.975, 0.756],
  [0.443, -0.975], [0.537, -0.473], [-0.265, -0.418], [0.792, 0.191], [-0.242, 0.997], [-0.814, 0.914], [0.2, 0.786], [0.143, -0.141]
].map(([x, y]) =>
  `signBilinearShadow(shadowMap, shadowCoord.xy + ${x.toFixed(3)} * receiverDX + ${y.toFixed(3)} * receiverDY, shadowMapSize, shadowCoord.xyz, receiverSlope, receiverSoftness)`
);
const filteredChunk = THREE.ShaderChunk.shadowmap_pars_fragment
  .replace('float getShadow(', `${bilinear}\nfloat getShadow(`)
  // Calculate derivatives before divergent frustum control flow.
  .replace('shadowCoord.z += shadowBias;', /* glsl */`shadowCoord.z += shadowBias;
    vec2 receiverSlope = signReceiverSlope(shadowCoord.xyz);
    // A screen-space footprint stays smooth when light-space texels stretch
    // across a grazing receiver. Apply the offset on its actual depth plane.
    vec2 receiverDX = dFdx(shadowCoord.xy) * shadowRadius * 5.0;
    vec2 receiverDY = dFdy(shadowCoord.xy) * shadowRadius * 5.0;
    float receiverSoftness = clamp(1.5 * dot(abs(receiverSlope), 1.0 / shadowMapSize), 0.00005, 0.002);
  `)
  .replace(/(#elif defined\( SHADOWMAP_TYPE_PCF_SOFT \))[\s\S]*?(?=#elif defined\( SHADOWMAP_TYPE_VSM \))/, `$1
    shadow = (${taps.join(' +\n      ')}) / 16.0;
  `);

/** Road-sign receivers only; model geometry and original-color stickers stay intact. */
export function installSignShadows(material: THREE.MeshStandardMaterial) {
  if (material.userData.signSoftShadows) return;
  material.userData.signSoftShadows = true;
  const previousCompile = material.onBeforeCompile, previousKey = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = function(shader, renderer) {
    previousCompile.call(this, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace('#include <shadowmap_pars_fragment>', filteredChunk);
  };
  material.customProgramCacheKey = () => `${previousKey()}|sign-bilinear-shadow-v2`;
  material.needsUpdate = true;
}
