---
description: "Deep Image panel knowledge: the panel is ThreeDeeRender's ImageMode SceneExtension, WorkerImageDecoder pipeline, camera-model projection (pinhole/fisheye), and annotation overlays."
---

# Panel Image Skill

The Image panel is **not** a separate panel — it is a specialized mode of the 3D panel
(`ThreeDeeRender`) that uses a 2D camera projection.

## Architecture

```
ImagePanel (re-export wrapper, panels/Image/)
    │
    ▼
ThreeDeeRender (Renderer.ts)
    │
    ▼
ImageMode SceneExtension
    │
    ├── WorkerImageDecoder (JPEG/PNG/… in a Worker)
    ├── Camera-model projection (pinhole, fisheye, …)
    └── Annotation overlays (boxes, points, text)
```

## Core Components

| File | Role |
|------|------|
| `renderables/Images/ImageMode.ts` | SceneExtension for image display |
| `renderables/Images/WorkerImageDecoder.ts` | Worker-based image decoding (Comlink) |
| `renderables/Images/WorkerImageDecoder.worker.ts` | Worker-side decode implementation |
| `renderables/Images/annotations/` | Overlay rendering (boxes, points, text) |

## Image Decoding Pipeline

1. Raw image message arrives (compressed JPEG/PNG or raw bytes)
2. Sent to `WorkerImageDecoder` via Comlink (off the main thread)
3. Decoded to an `ImageBitmap` or raw pixel buffer
4. Applied as a THREE.js texture on a plane geometry
5. The camera model determines UV mapping (handles distortion)

## Camera Models

- **Pinhole** — standard perspective projection
- **Fisheye** — equidistant / equisolid / stereographic projections
- **Custom** — extensions register additional models via `installedCameraModels`

`CameraInfo` intrinsics map pixels to 3D rays correctly.

## Annotations

Overlaid on the image plane as THREE.js objects in screen space: bounding boxes (with labels),
point annotations, and text overlays.

## Performance Notes

- JPEG/PNG decompression is CPU-heavy → always in a Worker
- `ImageBitmap` enables a GPU-side decode path in supported browsers
- Large images (4K+) strain GPU memory — consider downscaling
- At high frame rates, skip decode if the previous frame isn't yet displayed

## Key Files
- `packages/suite-base/src/panels/ThreeDeeRender/renderables/Images/`
- `packages/suite-base/src/panels/ThreeDeeRender/renderables/Images/WorkerImageDecoder.ts`
- `packages/suite-base/src/panels/Image/` (re-export wrapper)

## Skills Reference
- For 3D rendering fundamentals: load `3d-rendering` skill
- For Worker patterns (image decode): load `web-workers` skill
