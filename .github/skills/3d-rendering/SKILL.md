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

```typescript
class DynamicBufferGeometry extends THREE.BufferGeometry {
  // Geometric growth: doubles capacity when full
  resize(newCount: number) {
    if (newCount <= this.#capacity) return;
    const newCapacity = Math.max(newCount, this.#capacity * 2);
    // Allocate new buffer, copy old data, set on geometry
  }

  // Update only the changed portion
  setDrawRange(start: number, count: number);
}
```

### Why Geometric Growth?
- Avoids O(n²) copy cost of linear growth
- GPU buffer upload is expensive — minimize frequency
- `setDrawRange` renders only valid portion (no wasted draw calls)

## Point Cloud Rendering

### Data Flow
```
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
```
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
// Get transform from camera_link to world at specific time
const tf = transformTree.apply(
  "camera_link",  // source frame
  "world",        // target frame
  timestamp,      // interpolation time
);
```

- Interpolates between stored transforms at query time
- Extrapolation capped to prevent wild transforms from stale data

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
