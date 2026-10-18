Three.js USD loaders
MIT license, upstream commit f0a67319f396dfeaa05480bbba557e6ac7e6d445.
Adaptations: fflate uses the project dependency; bounded USDZ decompression; texture errors reject import; added binary ReferenceListOp / PayloadListOp from OpenUSD crateFile.cpp; composed reference prim paths are retained. Three.js r169 remains unchanged.
Source: https://github.com/mrdoob/three.js/tree/f0a67319f396dfeaa05480bbba557e6ac7e6d445/examples/jsm/loaders

Binary layout source: https://github.com/PixarAnimationStudios/OpenUSD/blob/release/pxr/usd/sdf/crateFile.cpp (Apache 2.0).
