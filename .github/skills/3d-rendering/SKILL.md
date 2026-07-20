---
description: "Deep THREE.js rendering knowledge for the 3D panel: WebGL pipeline, buffer management, instanced rendering, shader considerations, and scene optimization techniques."
---

# 3D Rendering Skill

## THREE.js Integration

### Renderer Setup
```typescript
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.outputColorSpace = THREE.SRGBColorSpace;
```

### Render Loop
- Driven by `requestAnimationFrame`
- Each frame: update transforms → update extensions → render scene
- No double-buffering needed (WebGL handles swap)

## DynamicBufferGeometry Details

`packages/suite-base/src/panels/ThreeDeeRender/DynamicBufferGeometry.ts`:

```typescript
class DynamicBufferGeometry extends THREE.BufferGeometry {
  // Grows to EXACTLY itemCount when capacity is exceeded — no geometric doubling.
  resize(itemCount: number): void {
    this.setDrawRange(0, itemCount);
    if (itemCount <= this.#itemCapacity) {
      return; // capacity sufficient — only the draw range changed
    }
    // For each attribute, allocate a NEW typed array of exactly itemCount * itemSize
    // (old data is NOT copied; callers refill the buffer after resize)
    this.#itemCapacity = itemCount;
  }
}
```

### Growth Behavior (Important)
- `resize(itemCount)` always calls `setDrawRange(0, itemCount)` first
- If `itemCount <= itemCapacity`, it returns early — buffers are reused, only the draw range moves
- If `itemCount > itemCapacity`, each attribute is reallocated to **exactly** `itemCount * itemSize`
  (no `* 2` over-allocation, no copy of existing data)
- Capacity only ever grows; it is never shrunk below a previous high-water mark

> ⚠️ Do not assume geometric/amortized doubling here. Repeatedly increasing the count by small
> increments reallocates every time, so callers that know a target size should resize to it once.

## Point Cloud Rendering

### Data Flow
```text
Raw message (PointCloud2)
    │
    ▼
Decode fields (x, y, z, rgb, intensity)
    │
    ▼
Fill position buffer (Float32Array)
Fill color buffer (Uint8Array)
    │
    ▼
Upload to GPU (BufferAttribute.needsUpdate = true)
    │
    ▼
Render with THREE.Points or InstancedMesh
```

### Decay History
- Configurable `decayTime` in seconds
- Old points are culled by sliding the `drawRange` start forward
- Ring-buffer approach: write position wraps around, draw range skips old data
- Avoids array shifting (O(1) per frame instead of O(n))

### Point Budget
- Too many points → GPU bottleneck
- `filterQueue`: processes messages in batches per frame
- Downsampling: skip points when exceeding budget

## Transform Resolution

### TF Tree Structure
```text
world (root)
├── base_link
│   ├── lidar_link
│   ├── camera_link
│   └── imu_link
└── map
    └── odom
        └── base_link (loop via static transform)
```

### Time-based Lookup
```typescript
// TransformTree.apply has an 8-argument signature:
const pose = transformTree.apply(
  output,       // Pose written in place (returned, or undefined on failure)
  input,        // Readonly<Pose> source pose
  frameId,      // destination/target frame
  rootFrameId,  // optional explicit root frame (defaults to frame.root())
  srcFrameId,   // source frame
  dstTime,      // Time to evaluate the destination frame at
  srcTime,      // Time to evaluate the source frame at
  maxDelta,     // optional Duration cap on extrapolation
);
```

- Defined in `packages/suite-base/src/panels/ThreeDeeRender/transforms/TransformTree.ts`
- Writes into the provided `output` Pose and returns it (or `undefined` if a frame is missing)
- Interpolates between stored transforms at query time; `maxDelta` caps extrapolation from stale data

## Instanced Rendering

For many identical objects (markers, arrows):
```typescript
const mesh = new THREE.InstancedMesh(geometry, material, maxCount);
// Update per-instance transform
mesh.setMatrixAt(index, matrix);
mesh.instanceMatrix.needsUpdate = true;
```

- Single draw call for all instances
- Massively reduces draw call overhead (100→1 for 100 markers)
- `maxCount` determines GPU buffer allocation — avoid over-allocation

## Shader Considerations

- Custom materials extend `THREE.ShaderMaterial` or `THREE.RawShaderMaterial`
- Point size attenuation: points shrink with distance (`sizeAttenuation: true`)
- Color mapping: intensity → color lookup via uniform texture
- Vertex colors: per-point coloring via `vertexColors: true` on material

## Performance Optimization Checklist

1. ✅ Use `DynamicBufferGeometry` — never `new BufferGeometry()` per frame
2. ✅ Set `needsUpdate = true` only on changed attributes
3. ✅ Use `InstancedMesh` for repeated geometries (>10 instances)
4. ✅ Dispose materials/geometries on removal (prevents GPU memory leak)
5. ✅ Frustum culling enabled (default in THREE.js)
6. ✅ Reuse temporary Vector3/Matrix4 instances (object pool pattern)
7. ✅ Limit point count with decay + budget
8. ❌ Never create new `THREE.Material` per frame
9. ❌ Never call `renderer.render()` if scene hasn't changed
10. ❌ Never use `traverse()` in hot path — cache node references
