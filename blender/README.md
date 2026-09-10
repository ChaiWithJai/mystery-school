# Astral School Blender sidecar

An authored forest school for the browser demo. The editable scene has a central oak and round library, six satellite islands, layered cedar trees, stratified rock, hanging roots, stone paths, brass portals, paper lanterns and six small learning spaces. Materials use dark pine, moss, warm paper and brass. Geometry is deterministic with seed 41.

## Outputs

- `../public/assets/school.blend`: editable source, with 1,079 separate mesh objects, materials and preview camera and lights.
- `../public/assets/school.glb`: browser asset, 49 meshes and 37,678 triangles. Seven fixed island meshes, 41 controllable cedar batches and one connection mesh. No camera or lights exported; no external textures or compression decoder required. Current byte sizes and material primitive counts are in `verification.json`.
- `../public/assets/school-preview.png`: actual 1600 by 1300 Eevee render.
- `scene-manifest.json`: anchors, units and conservative authored object bounds.
- `verification.json`: fresh Blender import results, exact exported mesh bounds and output byte sizes.

## Browser Integration

Load `/assets/school.glb` using Three.js `GLTFLoader`. Add `gltf.scene` at position `[0, 0, 0]`, scale `[1, 1, 1]`, with no axis rotation. Units are meters; Y is up. Use the frontend's scene lights. The GLB uses standard PBR materials, with modest emissive material on portal inlays, lanterns and library windows. It includes no background or ground plane.

The root is named `Astral School`. Island parents have stable names below, and their fixed geometry children are named `island_<id>_geometry`. Island parents contain `radius` extras; satellites also contain `world_id`. The central parent is `island_library`. The combined mesh named `connections` holds the six thin brass connections. Preserve the existing interactive nodes at the listed anchors. Scene geometry is authored demo content, not an AI projection result.

### Tree Density

Each named foliage node contains one complete cedar, including its trunk, branches and five foliage layers. All remain parented to their original island, so moving an island moves its foliage too. The central oak stays in the fixed library geometry as a landmark. At density zero all 41 cedars disappear; the oak and small ground ferns remain. At density one the geometry matches the original scene.

Exact node names use these inclusive ranges:

- `foliage_library_0` through `foliage_library_4`
- `foliage_memory_0` through `foliage_memory_5`
- `foliage_questions_0` through `foliage_questions_5`
- `foliage_experiments_0` through `foliage_experiments_5`
- `foliage_futures_0` through `foliage_futures_5`
- `foliage_people_0` through `foliage_people_5`
- `foliage_reflection_0` through `foliage_reflection_5`

The GLB node extras include `foliage_batch` (zero-based), `foliage_batch_count` (5 or 6), and `world_id`. The full node list is also in `scene-manifest.json` and `verification.json`. Three.js may create a Group for a mesh with several material primitives; set visibility on the named node, without requiring `isMesh`.

```js
const density = Math.max(0, Math.min(1, tree_density));
gltf.scene.traverse((node) => {
  if (/^foliage_/.test(node.name) && Number.isInteger(node.userData.foliage_batch)) {
    node.visible = node.userData.foliage_batch <
      Math.ceil(density * node.userData.foliage_batch_count);
  }
});
gltf.scene.getObjectByName('connections').visible = showConnections;
```

This provides deterministic whole-tree steps. At density 0.5 there are three cedars per island, 21 total. In the editable blend, individual cedar objects carry matching `export_group` and `foliage_batch` properties; the export combines their copies under the names above.

| World | GLB Position X, Y, Z | Radius |
| --- | --- | --- |
| library | 0, 0, 0 | 3.3 |
| memory | 9.2, 0, 0 | 2.0 |
| questions | 4.6, 0, 7.967434 | 2.0 |
| experiments | -4.6, 0, 7.967434 | 2.0 |
| futures | -9.2, 0, 0 | 2.0 |
| people | -4.6, 0, -7.967434 | 2.0 |
| reflection | 4.6, 0, -7.967434 | 2.0 |

Verified exported bounds are approximately X `[-11.262, 11.286]`, Y `[-3.370, 5.723]`, Z `[-10.089, 9.973]`. Terrain tops lie around Y 0.08. Island anchors stay at Y 0. Blender source coordinates map `(x, y, z)` to GLB `(x, z, -y)`.

## Rebuild

From the `astral-school` directory:

```sh
sh blender/run.sh
blender/runtime/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python blender/verify_school.py
```

The run script places Blender configuration and temporary files inside `blender/runtime`. Blender 5.2.1 LTS runs directly from `runtime/Blender.app`; nothing is installed in `/Applications`. The build saves the authored scene before combining temporary export copies. Rebuilding overwrites only the three named asset files and sidecar metadata. Eevee is the default, with Cycles available through `sh blender/run.sh -- --cycles`.

To edit visually, open `school.blend` with the project-local Blender application. The Python script remains the reproducible source; rebuilding regenerates the scene and replaces manual edits to those asset outputs.

## Runtime Provenance

Verified on the official Blender website on September 10, 2026:

- Download page: https://www.blender.org/download/
- Official release link: https://www.blender.org/download/release/Blender5.2/blender-5.2.1-macos-arm64.dmg/
- Direct mirror resolved by that page: https://mirror.blender.org/release/Blender5.2/blender-5.2.1-macos-arm64.dmg
- Executed version: Blender 5.2.1 LTS, build hash `9e2066aef7ef`, built August 25, 2026.

The downloaded DMG was verified and mounted by `hdiutil`, copied with `ditto` into `runtime/Blender.app`, then unmounted. The download and runtime are excluded by the sidecar `.gitignore`.
