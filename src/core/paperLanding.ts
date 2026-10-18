/** React DOM can commit before the separate Canvas renderer and frame callback.
 * Keep the carried paper until both the mesh and callback use the new geometry.
 */
export function paperLandingReady<S,G>(previous:{source:S;geometry:G},source:S,geometry:G,meshGeometry:G){
 return source!==previous.source&&geometry!==previous.geometry&&meshGeometry===geometry;
}
