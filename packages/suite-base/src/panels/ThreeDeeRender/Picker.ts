// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// Adapted from <https://github.com/bzztbomb/three_js_gpu_picking/blob/main/src/gpupicker.js>
// released under the public domain. Original authors:
// - bzztbomb https://github.com/bzztbomb
// - jfaust https://github.com/jfaust

import * as THREE from "three";
import { assert } from "ts-essentials";

import type { Renderable } from "./Renderable";

type Camera = THREE.PerspectiveCamera | THREE.OrthographicCamera;

// The width and height of the output viewport. This could be 1 to sample a
// single pixel, but GL_POINTS with a >1 point size would be clipped
const PIXEL_WIDTH = 31;
const tempResolution = new THREE.Vector2(0, 0);

const WHITE_COLOR = new THREE.Color(0xffffff);

// This works around an incorrect method definition, where passing null is valid
const NullScene = ReactNull as unknown as THREE.Scene;

export type PickedRenderable = {
  renderable: Renderable;
  instanceIndex?: number;
};

export type PickerOptions = {
  debug?: boolean;
  /**
   * Disable the setting of the projection matrix in the picking pass.
   * Use this if you are setting the projection matrix of the camera manually elsewhere
   */
  disableSetViewOffset?: boolean;
};

/**
 * Handles picking of objects in a scene (detecting 3D objects at a given screen
 * coordinate). This works by performing a second rendering pass after
 * `WebGLRenderer.renderLists` has been populated from a normal rendering pass.
 * In the second pass, objectIds are written as colors to a small offscreen
 * rendering target surrounding the sample point. The color at the sample point
 * is then read back and used to determine which object was picked.
 *
 * Objects can set their own `userData.pickingMaterial` to override the default
 * shader used for picking.
 */
export class Picker {
  #gl: THREE.WebGLRenderer;
  #scene: THREE.Scene;
  #camera?: Camera;
  #materialCache = new Map<number, THREE.ShaderMaterial>();
  #emptyScene: THREE.Scene;
  #pixelBuffer: Uint8Array;
  #currClearColor = new THREE.Color();
  #pickingTarget: THREE.WebGLRenderTarget;
  #isDebugPass = false;

  public constructor(gl: THREE.WebGLRenderer, scene: THREE.Scene) {
    this.#gl = gl;
    this.#scene = scene;

    // This is the PIXEL_WIDTH x PIXEL_WIDTH render target we use to do the picking
    this.#pickingTarget = new THREE.WebGLRenderTarget(PIXEL_WIDTH, PIXEL_WIDTH, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat, // stores objectIds as uint32
      generateMipmaps: false,
    });
    this.#pixelBuffer = new Uint8Array(4);
    // We need to be inside of .render in order to call renderBufferDirect in
    // renderList() so create an empty scene
    this.#emptyScene = new THREE.Scene();
  }

  public dispose(): void {
    for (const material of this.#materialCache.values()) {
      material.dispose();
    }
    this.#materialCache.clear();
    this.#pickingTarget.dispose();
  }

  public pick(
    x: number,
    y: number,
    camera: THREE.OrthographicCamera | THREE.PerspectiveCamera,
    options: PickerOptions = {},
  ): number {
    // Use the onAfterRender callback to actually render geometry for picking
    this.#emptyScene.onAfterRender = this.#renderForPicking;

    this.#camera = camera;
    const { xInView, yInView } = this.#updateCameraForPickAndGetPickCoordsInView(x, y, options);

    const originalRenderState = this.#prepareGLRendererForPick();

    this.#gl.render(this.#emptyScene, camera);
    this.#gl.readRenderTargetPixels(this.#pickingTarget, xInView, yInView, 1, 1, this.#pixelBuffer);

    this.#cleanUpGlRendererFromPick(originalRenderState);
    this.#resetCameraFromPick(options);

    const val =
      (this.#pixelBuffer[0]! << 24) +
      (this.#pixelBuffer[1]! << 16) +
      (this.#pixelBuffer[2]! << 8) +
      this.#pixelBuffer[3]!;

    if (options.debug === true) {
      this.#pickDebugRender(camera);
    }

    return val;
  }

  public pickInstance(
    x: number,
    y: number,
    camera: THREE.OrthographicCamera | THREE.PerspectiveCamera,
    renderable: THREE.Object3D,
    options: PickerOptions = {},
  ): number {
    this.#emptyScene.onAfterRender = this.#renderForPickingInstance.bind(this, renderable);

    this.#camera = camera;
    const { xInView, yInView } = this.#updateCameraForPickAndGetPickCoordsInView(x, y, options);

    const originalRenderState = this.#prepareGLRendererForPick();

    this.#gl.render(this.#emptyScene, this.#camera);
    this.#gl.readRenderTargetPixels(this.#pickingTarget, xInView, yInView, 1, 1, this.#pixelBuffer);

    this.#cleanUpGlRendererFromPick(originalRenderState);
    this.#resetCameraFromPick(options);

    if (options.debug === true) {
      this.#pickInstanceDebugRender(camera, renderable);
    }

    return (
      (this.#pixelBuffer[0]! << 24) +
      (this.#pixelBuffer[1]! << 16) +
      (this.#pixelBuffer[2]! << 8) +
      this.#pixelBuffer[3]!
    );
  }

  #updateCameraForPickAndGetPickCoordsInView(
    x: number,
    y: number,
    options: PickerOptions,
  ): { xInView: number; yInView: number } {
    assert(this.#camera, "camera must be set before updating for pick");
    const w = this.#gl.domElement.width;
    const h = this.#gl.domElement.height;
    const pixelRatio = this.#gl.getPixelRatio();

    if (options.disableSetViewOffset !== true) {
      const hw = (PIXEL_WIDTH / 2) | 0;
      const xi = Math.max(0, x * pixelRatio - hw);
      const yi = Math.max(0, y * pixelRatio - hw);
      // Set the projection matrix to only look at the pixels we are interested in
      this.#camera.setViewOffset(w, h, xi, yi, PIXEL_WIDTH, PIXEL_WIDTH);
      return { xInView: hw, yInView: hw };
    } else {
      if (this.#pickingTarget.width !== w || this.#pickingTarget.height !== h) {
        this.#pickingTarget.setSize(w, h);
      }
      const xi = Math.max(0, x * pixelRatio);
      // Flip y coordinate to match WebGL coordinate system
      const yi = Math.max(0, h - y * pixelRatio);
      return { xInView: xi, yInView: yi };
    }
  }

  #resetCameraFromPick(options: PickerOptions): void {
    assert(this.#camera, "camera must be set before resetting from pick");
    if (options.disableSetViewOffset !== true) {
      this.#camera.clearViewOffset();
    }
  }

  #prepareGLRendererForPick(): {
    originalRenderTarget: THREE.WebGLRenderTarget | ReactNull;
    originalAlpha: number;
  } {
    const originalRenderTarget = this.#gl.getRenderTarget();
    const originalAlpha = this.#gl.getClearAlpha();
    this.#gl.getClearColor(this.#currClearColor);
    this.#gl.setRenderTarget(this.#pickingTarget);
    this.#gl.setClearColor(WHITE_COLOR, 1);
    this.#gl.clear();
    return { originalRenderTarget, originalAlpha };
  }

  #cleanUpGlRendererFromPick({
    originalRenderTarget,
    originalAlpha,
  }: {
    originalRenderTarget: THREE.WebGLRenderTarget | ReactNull;
    originalAlpha: number;
  }): void {
    this.#gl.setRenderTarget(originalRenderTarget);
    this.#gl.setClearColor(this.#currClearColor, originalAlpha);
  }

  #pickDebugRender(camera: THREE.OrthographicCamera | THREE.PerspectiveCamera): void {
    this.#isDebugPass = true;
    this.#emptyScene.onAfterRender = this.#renderForPicking;
    const currAlpha = this.#gl.getClearAlpha();
    this.#gl.getClearColor(this.#currClearColor);
    this.#gl.setClearColor(WHITE_COLOR, 1);
    this.#gl.clear();
    this.#gl.render(this.#emptyScene, camera);
    this.#gl.setClearColor(this.#currClearColor, currAlpha);
    this.#isDebugPass = false;
  }

  #pickInstanceDebugRender(
    camera: THREE.OrthographicCamera | THREE.PerspectiveCamera,
    renderable: THREE.Object3D,
  ): void {
    this.#isDebugPass = true;
    this.#emptyScene.onAfterRender = this.#renderForPickingInstance.bind(this, renderable);
    const currAlpha = this.#gl.getClearAlpha();
    this.#gl.getClearColor(this.#currClearColor);
    this.#gl.setClearColor(WHITE_COLOR, 1);
    this.#gl.clear();
    this.#gl.render(this.#emptyScene, camera);
    this.#gl.setClearColor(this.#currClearColor, currAlpha);
    this.#isDebugPass = false;
  }

  #renderForPicking = (): void => {
    // This is the magic, these render lists are still filled with valid data.
    // So we can submit them again for picking and save lots of work!
    const renderList = this.#gl.renderLists.get(this.#scene, 0);
    renderList.opaque.forEach(this.#renderItemForPicking);
    renderList.transmissive.forEach(this.#renderItemForPicking);
    renderList.transparent.forEach(this.#renderItemForPicking);
  };

  #renderForPickingInstance(renderable: THREE.Object3D) {
    // Note that no attempt is made to define a sensible sort order. Since the
    // instanced picking pass should only be rendering opaque pixels, the
    // worst that will happen is some overdraw
    renderable.traverseVisible((object) => {
      const maybeRender = object as Partial<THREE.Mesh>;
      if (maybeRender.id != undefined && maybeRender.geometry && maybeRender.material) {
        const renderItem: THREE.RenderItem = {
          id: maybeRender.id,
          object,
          geometry: maybeRender.geometry,
          material: maybeRender.material as THREE.Material,
          // `program` is not used by WebGLRenderer even though it is defined in RenderItem
          program: undefined as unknown as THREE.WebGLProgram,
          groupOrder: 0,
          renderOrder: 0,
          z: 0,
          group: ReactNull,
        };
        this.#renderInstancedItemForPicking(renderItem);
      }
    });
  }

  #renderItemForPicking = (renderItem: THREE.RenderItem): void => {
    if (!this.#camera) {
      return;
    }
    const object = renderItem.object;
    const objId = this.#isDebugPass ? hashInt(object.id) : object.id;
    const material = renderItem.material;
    const geometry = renderItem.geometry;
    if (
      !geometry || // Skip if geometry is not defined
      renderItem.object.userData.picking === false // Skip if object is marked no picking
    ) {
      return;
    }

    const isSprite = material.type === "SpriteMaterial";

    const pickResolution = tempResolution.set(
      this.#pickingTarget.width,
      this.#pickingTarget.height,
    );
    const sizeAttenuation = (material as Partial<THREE.PointsMaterial>).sizeAttenuation === true;
    const pickingMaterial = renderItem.object.userData.pickingMaterial as
      | THREE.ShaderMaterial
      | undefined;
    // scale picking material to picking target size
    if (pickingMaterial?.uniforms.resolution != undefined) {
      pickingMaterial.uniforms.resolution.value.copy(pickResolution);
    }
    const renderMaterial =
      pickingMaterial ??
      this.#renderMaterial({
        isSprite,
        sizeAttenuation,
        depthTest: material.depthTest,
        depthWrite: material.depthWrite,
      });
    if (isSprite) {
      renderMaterial.uniforms.rotation = { value: (material as THREE.SpriteMaterial).rotation };
      renderMaterial.uniforms.center = { value: (object as THREE.Sprite).center };
    }
    setObjectId(renderMaterial, objId);
    renderMaterial.uniformsNeedUpdate = true;
    this.#gl.renderBufferDirect(
      this.#camera,
      NullScene,
      geometry,
      renderMaterial,
      object,
      ReactNull,
    );
  };

  #renderInstancedItemForPicking = (renderItem: THREE.RenderItem): void => {
    if (!this.#camera) {
      return;
    }
    const object = renderItem.object;
    const geometry = renderItem.geometry;
    if (
      !geometry || // Skip if geometry is not defined
      renderItem.object.userData.picking === false // Skip if object is marked no picking
    ) {
      return;
    }

    const instancePickingMaterial = renderItem.object.userData.instancePickingMaterial as
      | THREE.ShaderMaterial
      | undefined;
    const renderMaterial = instancePickingMaterial ?? this.#instanceRenderMaterial();
    this.#gl.renderBufferDirect(
      this.#camera,
      NullScene,
      geometry,
      renderMaterial,
      object,
      ReactNull,
    );
  };

  /** Create a unique picking material for each combination of parameters */
  #renderMaterial({
    isSprite,
    sizeAttenuation,
    depthTest,
    depthWrite,
  }: {
    isSprite: boolean;
    sizeAttenuation: boolean;
    depthTest: boolean;
    depthWrite: boolean;
  }): THREE.ShaderMaterial {
    const index =
      ((isSprite ? 1 : 0) << 0) |
      ((sizeAttenuation ? 1 : 0) << 1) |
      ((depthTest ? 1 : 0) << 2) |
      ((depthWrite ? 1 : 0) << 3);
    let renderMaterial = this.#materialCache.get(index);
    if (renderMaterial) {
      return renderMaterial;
    }

    let vertexShader = THREE.ShaderChunk.meshbasic_vert;
    if (isSprite) {
      vertexShader = THREE.ShaderChunk.sprite_vert!;
    }
    if (sizeAttenuation) {
      vertexShader = "#define USE_SIZEATTENUATION\n\n" + vertexShader;
    }
    renderMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: /* glsl */ `
          uniform vec4 objectId;
          void main() {
            gl_FragColor = objectId;
          }
        `,
      side: THREE.DoubleSide,
      uniforms: { objectId: { value: [NaN, NaN, NaN, NaN] } },
      depthTest,
      depthWrite,
    });
    this.#materialCache.set(index, renderMaterial);
    return renderMaterial;
  }

  #instanceRenderMaterial(): THREE.ShaderMaterial {
    const index = -1; // special materialCache index used for the instanced picking material
    let renderMaterial = this.#materialCache.get(index);
    if (renderMaterial) {
      return renderMaterial;
    }

    let vertexShader = THREE.ShaderChunk.meshbasic_vert;
    vertexShader = vertexShader.replace(
      "void main() {",
      /* glsl */ `
      varying vec4 objectId;

      void main() {
        objectId = vec4(
          float((gl_InstanceID >> 24) & 255) / 255.0,
          float((gl_InstanceID >> 16) & 255) / 255.0,
          float((gl_InstanceID >> 8) & 255) / 255.0,
          float(gl_InstanceID & 255) / 255.0);
      `,
    );
    renderMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: /* glsl */ `
          varying vec4 objectId;
          void main() {
            gl_FragColor = objectId;
          }
        `,
      side: THREE.DoubleSide,
      uniforms: { objectId: { value: [NaN, NaN, NaN, NaN] } },
    });
    this.#materialCache.set(index, renderMaterial);
    return renderMaterial;
  }
}

function setObjectId(material: THREE.ShaderMaterial, objectId: number): void {
  const iObjectId = material.uniforms.objectId;
  if (!iObjectId) {
    throw new Error(`objectId uniform not found in picking material`);
  }
  iObjectId.value = [
    ((objectId >> 24) & 255) / 255,
    ((objectId >> 16) & 255) / 255,
    ((objectId >> 8) & 255) / 255,
    (objectId & 255) / 255,
  ];
}

// Used for debug colors, this remaps objectIds to pseudo-random 32-bit integers
const A = new Uint32Array(1);
function hashInt(x: number): number {
  A[0] = x | 0;
  A[0] -= A[0] << 6;
  A[0] ^= A[0] >>> 17;
  A[0] -= A[0] << 9;
  A[0] ^= A[0] << 4;
  A[0] -= A[0] << 3;
  A[0] ^= A[0] << 10;
  A[0] ^= A[0] >>> 15;
  return A[0];
}
