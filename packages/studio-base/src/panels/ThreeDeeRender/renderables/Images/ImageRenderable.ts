// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";
import { assert } from "ts-essentials";

import { PinholeCameraModel } from "@foxglove/den/image";
import { toNanoSec } from "@foxglove/rostime";
import { IRenderer } from "@foxglove/studio-base/panels/ThreeDeeRender/IRenderer";
import { BaseUserData, Renderable } from "@foxglove/studio-base/panels/ThreeDeeRender/Renderable";
import { stringToRgba } from "@foxglove/studio-base/panels/ThreeDeeRender/color";
import { projectPixel } from "@foxglove/studio-base/panels/ThreeDeeRender/renderables/projections";
import { RosValue } from "@foxglove/studio-base/players/types";

import { AnyImage } from "./ImageTypes";
import { RawImageOptions, decodeRawImage } from "./decodeImage";
import { CameraInfo } from "../../ros";

export interface ImageRenderableSettings {
  visible: boolean;
  frameLocked?: boolean;
  cameraInfoTopic: string | undefined;
  distance: number;
  planarProjectionFactor: number;
  color: string;
  minValue?: number;
  maxValue?: number;
}

export const CREATE_BITMAP_ERR_KEY = "CreateBitmap";
const IMAGE_TOPIC_PATH = ["imageMode", "imageTopic"];

const DEFAULT_DISTANCE = 1;
const DEFAULT_PLANAR_PROJECTION_FACTOR = 0;
export const IMAGE_RENDERABLE_DEFAULT_SETTINGS: ImageRenderableSettings = {
  visible: false,
  frameLocked: true,
  cameraInfoTopic: undefined,
  distance: DEFAULT_DISTANCE,
  planarProjectionFactor: DEFAULT_PLANAR_PROJECTION_FACTOR,
  color: "#ffffff",
};
export type ImageUserData = BaseUserData & {
  topic: string;
  settings: ImageRenderableSettings;
  cameraInfo: CameraInfo | undefined;
  cameraModel: PinholeCameraModel | undefined;
  image: AnyImage | undefined;
  texture: THREE.Texture | undefined;
  material: THREE.MeshBasicMaterial | undefined;
  geometry: THREE.PlaneGeometry | undefined;
  mesh: THREE.Mesh | undefined;
};

export class ImageRenderable extends Renderable<ImageUserData> {
  // Make sure that everything is build the first time we render
  // set when camera info or image changes
  #geometryNeedsUpdate = true;
  // set when geometry or material reference changes
  #meshNeedsUpdate = true;
  // set when image changes
  #textureNeedsUpdate = true;
  // set when material or texture changes
  #materialNeedsUpdate = true;

  #renderBehindScene: boolean = false;

  #bitmap?: ImageBitmap;

  #isUpdating = false;

  public constructor(topicName: string, renderer: IRenderer, userData: ImageUserData) {
    super(topicName, renderer, userData);
  }

  public override dispose(): void {
    this.userData.texture?.dispose();
    this.userData.material?.dispose();
    this.userData.geometry?.dispose();
    super.dispose();
  }

  public updateHeaderInfo(): void {
    assert(this.userData.image, "updateHeaderInfo called without image");

    // If there is camera info, the frameId comes from the camera info since the user may have
    // selected camera info with a different frame than our image frame.
    //
    // If there is no camera info, we fall back to the image's frame
    const image = this.userData.image;
    const rawFrameId =
      this.userData.cameraInfo?.header.frame_id ??
      ("header" in image ? image.header.frame_id : image.frame_id);
    this.userData.frameId =
      typeof rawFrameId === "string" ? this.renderer.normalizeFrameId(rawFrameId) : rawFrameId;
    this.userData.messageTime = toNanoSec("header" in image ? image.header.stamp : image.timestamp);
  }

  public override details(): Record<string, RosValue> {
    return { image: this.userData.image, camera_info: this.userData.cameraInfo };
  }

  public setRenderBehindScene(): void {
    this.#renderBehindScene = true;
    this.#materialNeedsUpdate = true;
    this.#meshNeedsUpdate = true;
  }

  // Renderable should only need to care about the model
  public setCameraModel = (cameraModel: PinholeCameraModel): void => {
    this.#geometryNeedsUpdate ||= this.userData.cameraModel !== cameraModel;
    this.userData.cameraModel = cameraModel;
  };

  public setSettings(newSettings: ImageRenderableSettings): void {
    const prevSettings = this.userData.settings;
    if (prevSettings.cameraInfoTopic !== newSettings.cameraInfoTopic) {
      // clear mesh since it is no longer showing userData accurately
      if (this.userData.mesh != undefined) {
        this.remove(this.userData.mesh);
      }
      this.userData.mesh = undefined;
      this.#geometryNeedsUpdate = true;
    }
    if (
      prevSettings.distance !== newSettings.distance ||
      newSettings.planarProjectionFactor !== prevSettings.planarProjectionFactor
    ) {
      this.#geometryNeedsUpdate = true;
    }

    if (newSettings.color !== prevSettings.color) {
      this.#materialNeedsUpdate = true;
    }

    if (
      prevSettings.minValue !== newSettings.minValue ||
      prevSettings.maxValue !== newSettings.maxValue
    ) {
      this.#textureNeedsUpdate = true;
    }

    this.userData.settings = newSettings;
  }

  public setImage(image: AnyImage): void {
    this.userData.image = image;
    this.#textureNeedsUpdate = true;
  }

  public setBitmap(bitmap: ImageBitmap): void {
    this.#bitmap = bitmap;
    this.#textureNeedsUpdate = true;
  }

  public update(): void {
    if (this.#isUpdating) {
      return;
    }
    this.#isUpdating = true;
    // fallback camera info needs image width and height
    if (this.#textureNeedsUpdate && this.userData.image) {
      this.#updateTexture();
      this.#textureNeedsUpdate = false;
    }
    // We need a valid camera model and image to render
    if (!this.userData.cameraModel || !this.userData.image) {
      this.#isUpdating = false;
      return;
    }

    this.updateHeaderInfo();

    if (this.#geometryNeedsUpdate) {
      this.#rebuildGeometry();
      this.#geometryNeedsUpdate = false;
    }

    if (this.#materialNeedsUpdate) {
      this.#updateMaterial();
      this.#materialNeedsUpdate = false;
    }

    if (this.#meshNeedsUpdate && this.userData.texture) {
      this.#updateMesh();
      this.#meshNeedsUpdate = false;
    }
    this.#isUpdating = false;
  }

  #rebuildGeometry() {
    assert(this.userData.cameraModel, "Camera model must be set before geometry can be updated");
    // Dispose of the current geometry if the settings have changed
    this.userData.geometry?.dispose();
    this.userData.geometry = undefined;
    const geometry = createGeometry(this.userData.cameraModel, this.userData.settings);
    this.userData.geometry = geometry;
    this.#meshNeedsUpdate = true;
  }

  #updateTexture(): void {
    assert(this.userData.image, "Image must be set before texture can be updated or created");
    const image = this.userData.image;
    // Create or update the bitmap texture
    if ("format" in image) {
      const bitmap = this.#bitmap;
      if (!bitmap) {
        return;
      }

      const canvasTexture = this.userData.texture;
      if (
        canvasTexture == undefined ||
        // instanceof check allows us to switch from a raw image (DataTexture) to a compressed image (CanvasTexture)
        !(canvasTexture instanceof THREE.CanvasTexture) ||
        !bitmapDimensionsEqual(bitmap, canvasTexture.image as ImageBitmap | undefined)
      ) {
        if (canvasTexture?.image instanceof ImageBitmap) {
          canvasTexture.image.close();
        }
        canvasTexture?.dispose();
        this.userData.texture = createCanvasTexture(bitmap);
      } else {
        canvasTexture.image = bitmap;
        canvasTexture.needsUpdate = true;
      }
    } else {
      const { width, height } = image;
      let dataTexture = this.userData.texture;
      if (
        dataTexture == undefined ||
        // instanceof check allows us to switch from a compressed image (CanvasTexture) to a raw image (DataTexture)
        !(dataTexture instanceof THREE.DataTexture) ||
        dataTexture.image.width !== width ||
        dataTexture.image.height !== height
      ) {
        dataTexture?.dispose();
        dataTexture = createDataTexture(width, height);
        this.userData.texture = dataTexture;
      }
      assert(dataTexture instanceof THREE.DataTexture); // https://github.com/microsoft/TypeScript/issues/54594

      try {
        decodeRawImage(image, this.#getRawImageOptions(), dataTexture.image.data);
        dataTexture.needsUpdate = true;
        this.renderer.settings.errors.remove(IMAGE_TOPIC_PATH, CREATE_BITMAP_ERR_KEY);
        this.renderer.settings.errors.removeFromTopic(this.userData.topic, CREATE_BITMAP_ERR_KEY);
      } catch (error) {
        this.renderer.settings.errors.add(
          IMAGE_TOPIC_PATH,
          CREATE_BITMAP_ERR_KEY,
          `Error decoding raw image: ${error.message}`,
        );
        this.renderer.settings.errors.addToTopic(
          this.userData.topic,
          CREATE_BITMAP_ERR_KEY,
          `Error decoding raw image: ${error.message}`,
        );
      }
    }
    this.#materialNeedsUpdate = true;
  }

  #getRawImageOptions(): RawImageOptions {
    return {
      minValue: this.userData.settings.minValue,
      maxValue: this.userData.settings.maxValue,
    };
  }

  #updateMaterial(): void {
    if (!this.userData.material) {
      this.#initMaterial();
      this.#meshNeedsUpdate = true;
    }
    const material = this.userData.material!;

    const texture = this.userData.texture;
    if (texture) {
      material.map = texture;
    }

    tempColor = stringToRgba(tempColor, this.userData.settings.color);
    const transparent = tempColor.a < 1;
    const color = new THREE.Color(tempColor.r, tempColor.g, tempColor.b);
    material.color.set(color);
    material.opacity = tempColor.a;
    material.transparent = transparent;
    material.depthWrite = !transparent;

    if (this.#renderBehindScene) {
      material.depthWrite = false;
      material.depthTest = false;
    } else {
      material.depthTest = true;
    }

    material.needsUpdate = true;
  }

  #initMaterial(): void {
    stringToRgba(tempColor, this.userData.settings.color);
    const transparent = tempColor.a < 1;
    const color = new THREE.Color(tempColor.r, tempColor.g, tempColor.b);
    this.userData.material = new THREE.MeshBasicMaterial({
      name: `${this.userData.topic}:Material`,
      color,
      side: THREE.DoubleSide,
      opacity: tempColor.a,
      transparent,
      depthWrite: !transparent,
    });
  }

  #updateMesh(): void {
    assert(this.userData.geometry, "Geometry must be set before mesh can be updated or created");
    assert(this.userData.material, "Material must be set before mesh can be updated or created");
    if (!this.userData.mesh) {
      this.userData.mesh = new THREE.Mesh(this.userData.geometry, this.userData.material);
      this.add(this.userData.mesh);
    } else {
      this.userData.mesh.geometry = this.userData.geometry;
      this.userData.mesh.material = this.userData.material;
    }

    if (!this.#renderBehindScene) {
      this.userData.mesh.renderOrder = 0;
      return;
    }

    this.userData.mesh.renderOrder = -1 * Number.MAX_SAFE_INTEGER;
  }
}

let tempColor = { r: 0, g: 0, b: 0, a: 0 };

function createCanvasTexture(bitmap: ImageBitmap): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(
    bitmap,
    THREE.UVMapping,
    THREE.ClampToEdgeWrapping,
    THREE.ClampToEdgeWrapping,
    THREE.NearestFilter,
    THREE.LinearFilter,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  texture.generateMipmaps = false;
  texture.encoding = THREE.sRGBEncoding;
  return texture;
}

function createDataTexture(width: number, height: number): THREE.DataTexture {
  const size = width * height;
  const rgba = new Uint8ClampedArray(size * 4);
  return new THREE.DataTexture(
    rgba,
    width,
    height,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
    THREE.UVMapping,
    THREE.ClampToEdgeWrapping,
    THREE.ClampToEdgeWrapping,
    THREE.NearestFilter,
    THREE.LinearFilter,
    1,
    THREE.sRGBEncoding,
  );
}

function createGeometry(
  cameraModel: PinholeCameraModel,
  settings: ImageRenderableSettings,
): THREE.PlaneGeometry {
  const WIDTH_SEGMENTS = 10;
  const HEIGHT_SEGMENTS = 10;

  const width = cameraModel.width;
  const height = cameraModel.height;
  const geometry = new THREE.PlaneGeometry(1, 1, WIDTH_SEGMENTS, HEIGHT_SEGMENTS);

  const gridX1 = WIDTH_SEGMENTS + 1;
  const gridY1 = HEIGHT_SEGMENTS + 1;
  const size = gridX1 * gridY1;

  const segmentWidth = width / WIDTH_SEGMENTS;
  const segmentHeight = height / HEIGHT_SEGMENTS;

  // Use a slight offset to avoid z-fighting with the CameraInfo wireframe
  const EPS = 1e-3;

  // Rebuild the position buffer for the plane by iterating through the grid and
  // projecting each pixel space x/y coordinate into a 3D ray and casting out by
  // the user-configured distance setting. UV coordinates are rebuilt so the
  // image is not vertically flipped
  const pixel = { x: 0, y: 0 };
  const p = { x: 0, y: 0, z: 0 };
  const vertices = new Float32Array(size * 3);
  const uvs = new Float32Array(size * 2);
  for (let iy = 0; iy < gridY1; iy++) {
    for (let ix = 0; ix < gridX1; ix++) {
      const vOffset = (iy * gridX1 + ix) * 3;
      const uvOffset = (iy * gridX1 + ix) * 2;

      pixel.x = ix * segmentWidth;
      pixel.y = iy * segmentHeight;
      projectPixel(p, pixel, cameraModel, settings);

      vertices[vOffset + 0] = p.x;
      vertices[vOffset + 1] = p.y;
      vertices[vOffset + 2] = p.z - EPS;

      uvs[uvOffset + 0] = ix / WIDTH_SEGMENTS;
      uvs[uvOffset + 1] = iy / HEIGHT_SEGMENTS;
    }
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.attributes.position!.needsUpdate = true;
  geometry.attributes.uv!.needsUpdate = true;

  return geometry;
}

const bitmapDimensionsEqual = (a?: ImageBitmap, b?: ImageBitmap) =>
  a?.width === b?.width && a?.height === b?.height;
