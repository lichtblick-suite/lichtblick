// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as _ from "lodash-es";
import * as THREE from "three";
import { assert } from "ts-essentials";

import { VideoPlayer } from "@lichtblick/den/video";
import Logger from "@lichtblick/log";
import { toNanoSec } from "@lichtblick/rostime";
import { ICameraModel } from "@lichtblick/suite";
import { IRenderer } from "@lichtblick/suite-base/panels/ThreeDeeRender/IRenderer";
import { BaseUserData, Renderable } from "@lichtblick/suite-base/panels/ThreeDeeRender/Renderable";
import { stringToRgba } from "@lichtblick/suite-base/panels/ThreeDeeRender/color";
import {
  clampBrightness,
  clampContrast,
} from "@lichtblick/suite-base/panels/ThreeDeeRender/renderables/ImageMode/utils";
import { WorkerImageDecoder } from "@lichtblick/suite-base/panels/ThreeDeeRender/renderables/Images/WorkerImageDecoder";
import { projectPixel } from "@lichtblick/suite-base/panels/ThreeDeeRender/renderables/projections";
import { RosValue } from "@lichtblick/suite-base/players/types";

import { AnyImage, CompressedVideo } from "./ImageTypes";
import {
  decodeCompressedImageToBitmap,
  decodeCompressedVideoToBitmap,
  emptyVideoFrame,
  getVideoDecoderConfig,
} from "./decodeImage";
import { CameraInfo } from "../../ros";
import {
  DECODE_IMAGE_ERR_KEY,
  FRAGMENT_SHADER,
  IMAGE_TOPIC_PATH,
  INITIAL_BRIGHTNESS,
  INITIAL_CONTRAST,
  VERTEX_SHADER,
} from "../ImageMode/constants";
import { ColorModeSettings } from "../colorMode";

const log = Logger.getLogger(__filename);
export interface ImageRenderableSettings extends Partial<ColorModeSettings> {
  visible: boolean;
  frameLocked?: boolean;
  cameraInfoTopic: string | undefined;
  distance: number;
  planarProjectionFactor: number;
  color: string;
  brightness: number;
  contrast: number;
}

const DEFAULT_DISTANCE = 1;
const DEFAULT_PLANAR_PROJECTION_FACTOR = 0;
export const IMAGE_RENDERABLE_DEFAULT_SETTINGS: ImageRenderableSettings = {
  visible: false,
  frameLocked: true,
  cameraInfoTopic: undefined,
  distance: DEFAULT_DISTANCE,
  planarProjectionFactor: DEFAULT_PLANAR_PROJECTION_FACTOR,
  color: "#ffffff",
  brightness: INITIAL_BRIGHTNESS,
  contrast: INITIAL_CONTRAST,
};

const VIDEO_FORMATS = new Set(["h264"]);

export type ImageUserData = BaseUserData & {
  topic: string;
  settings: ImageRenderableSettings;
  firstMessageTime: bigint | undefined;
  cameraInfo: CameraInfo | undefined;
  cameraModel: ICameraModel | undefined;
  image: AnyImage | undefined;
  texture: THREE.Texture | undefined;
  // The material should use ShaderMaterial so we can use custom shaders to apply effects like brightness and contrast
  material: THREE.ShaderMaterial | undefined;
  geometry: THREE.PlaneGeometry | undefined;
  mesh: THREE.Mesh | undefined;
};

export class ImageRenderable extends Renderable<ImageUserData> {
  // A lazily instantiated player for compressed video
  public videoPlayer: VideoPlayer | undefined;

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

  #isUpdating = false;

  #decodedImage?: ImageBitmap | ImageData;
  protected decoder?: WorkerImageDecoder;
  #receivedImageSequenceNumber = 0;
  #displayedImageSequenceNumber = 0;
  #showingErrorImage = false;

  #disposed = false;

  public constructor(topicName: string, renderer: IRenderer, userData: ImageUserData) {
    super(topicName, renderer, userData);
  }

  protected isDisposed(): boolean {
    return this.#disposed;
  }

  public getDecodedImage(): ImageBitmap | ImageData | undefined {
    return this.#decodedImage;
  }

  public override dispose(): void {
    this.#disposed = true;
    this.userData.texture?.dispose();
    this.userData.material?.dispose();
    this.userData.geometry?.dispose();
    this.decoder?.terminate();
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
  public setCameraModel(cameraModel: ICameraModel): void {
    this.#geometryNeedsUpdate ||= this.userData.cameraModel !== cameraModel;
    this.userData.cameraModel = cameraModel;
  }

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

    if (
      newSettings.color !== prevSettings.color ||
      prevSettings.brightness !== newSettings.brightness ||
      prevSettings.contrast !== newSettings.contrast
    ) {
      this.#materialNeedsUpdate = true;
    }

    if (
      prevSettings.colorMode !== newSettings.colorMode ||
      prevSettings.flatColor !== newSettings.flatColor ||
      !_.isEqual(prevSettings.gradient, newSettings.gradient) ||
      prevSettings.colorMap !== newSettings.colorMap ||
      prevSettings.minValue !== newSettings.minValue ||
      prevSettings.maxValue !== newSettings.maxValue
    ) {
      this.userData.settings = newSettings;
      // Decode the current image again, which takes into account the new options
      const image = this.userData.image;
      if (image) {
        this.setImage(image);
      }
      return;
    }

    this.userData.settings = newSettings;
  }

  public setImage(image: AnyImage, resizeWidth?: number, onDecoded?: () => void): void {
    this.userData.image = image;

    const seq = ++this.#receivedImageSequenceNumber;
    const decodePromise = this.decodeImage(image, resizeWidth);

    decodePromise
      .then((result) => {
        if (this.isDisposed()) {
          return;
        }
        // prevent displaying an image older than the one currently displayed
        if (this.#displayedImageSequenceNumber > seq) {
          return;
        }
        this.#displayedImageSequenceNumber = seq;
        this.#decodedImage = result;
        this.#textureNeedsUpdate = true;
        this.update();
        this.#showingErrorImage = false;

        onDecoded?.();
        this.removeError(DECODE_IMAGE_ERR_KEY);
        this.renderer.queueAnimationFrame();
      })
      .catch((err: unknown) => {
        log.error(err);
        if (this.isDisposed()) {
          return;
        }
        // avoid needing to recreate error image if it already shown
        if (!this.#showingErrorImage) {
          void this.#setErrorImage(seq, onDecoded);
        }
        this.addError(DECODE_IMAGE_ERR_KEY, `Error decoding image: ${(err as Error).message}`);
      });
  }

  async #setErrorImage(seq: number, onDecoded?: () => void): Promise<void> {
    const errorBitmap = await getErrorImage(64, 64);
    if (this.isDisposed()) {
      return;
    }
    if (this.#displayedImageSequenceNumber > seq) {
      return;
    }
    this.#decodedImage = errorBitmap;
    this.#textureNeedsUpdate = true;
    this.update();
    this.#showingErrorImage = true;
    // call ondecoded to display the error image when calibration is None
    onDecoded?.();
    this.renderer.queueAnimationFrame();
  }

  protected async decodeImage(
    image: AnyImage,
    resizeWidth?: number,
  ): Promise<ImageBitmap | ImageData> {
    if ("format" in image) {
      if (!VIDEO_FORMATS.has(image.format)) {
        return await decodeCompressedImageToBitmap(image, resizeWidth);
      } else {
        const frameMsg = image as CompressedVideo;

        if (frameMsg.data.byteLength === 0) {
          const error = "Empty video frame";
          log.error(error);
          // show last frame instead of error image if available
          if (this.videoPlayer?.lastImageBitmap) {
            return this.videoPlayer.lastImageBitmap;
          }
          // show black image instead of error image
          return await emptyVideoFrame(this.videoPlayer, resizeWidth);
        }

        if (!this.videoPlayer) {
          this.videoPlayer = new VideoPlayer();
          this.videoPlayer.on("error", (err) => {
            log.error(err);
            this.addError(DECODE_IMAGE_ERR_KEY, `Error decoding video: ${err.message}`);
          });
          this.videoPlayer.on("warn", (msg) => {
            log.warn(msg);
          });
        }
        const videoPlayer = this.videoPlayer;

        // Initialize the video player if needed
        if (!videoPlayer.isInitialized()) {
          const decoderConfig = getVideoDecoderConfig(frameMsg);
          if (decoderConfig != undefined) {
            await videoPlayer.init(decoderConfig);
          } else {
            // Raise error so the caller can catch it
            throw new Error("Waiting for keyframe");
          }
        }

        assert(this.userData.firstMessageTime != undefined, "firstMessageTime must be set");

        return await decodeCompressedVideoToBitmap(
          frameMsg,
          videoPlayer,
          this.userData.firstMessageTime,
          resizeWidth,
        );
      }
    }
    return await (this.decoder ??= new WorkerImageDecoder()).decode(image, this.userData.settings);
  }

  public update(): void {
    if (this.#isUpdating) {
      return;
    }
    this.#isUpdating = true;

    if (this.#textureNeedsUpdate && this.#decodedImage) {
      this.#updateTexture();
      this.#textureNeedsUpdate = false;
    }

    if (this.userData.image) {
      this.updateHeaderInfo();
    }

    if (this.#geometryNeedsUpdate && this.userData.cameraModel) {
      this.#rebuildGeometry();
      this.#geometryNeedsUpdate = false;
    }

    if (this.#materialNeedsUpdate) {
      this.#updateMaterial();
      this.#materialNeedsUpdate = false;
    }

    if (
      this.#meshNeedsUpdate &&
      this.userData.texture &&
      this.userData.geometry &&
      this.userData.material
    ) {
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
    assert(
      this.#decodedImage,
      "Decoded image must be set before texture can be updated or created",
    );
    const decodedImage = this.#decodedImage;
    // Create or update the bitmap texture
    if (decodedImage instanceof ImageBitmap) {
      const canvasTexture = this.userData.texture;
      if (
        canvasTexture == undefined ||
        // instanceof check allows us to switch from a raw image (DataTexture) to a compressed image (CanvasTexture)
        !(canvasTexture instanceof THREE.CanvasTexture) ||
        !bitmapDimensionsEqual(decodedImage, canvasTexture.image as ImageBitmap | undefined)
      ) {
        if (canvasTexture?.image instanceof ImageBitmap) {
          // don't close the image if it is the error image
          canvasTexture.image.close();
        }
        canvasTexture?.dispose();
        this.userData.texture = createCanvasTexture(decodedImage);
      } else {
        canvasTexture.image = decodedImage;
        canvasTexture.needsUpdate = true;
      }
    } else {
      let dataTexture = this.userData.texture;
      if (
        dataTexture == undefined ||
        // instanceof check allows us to switch from a compressed image (CanvasTexture) to a raw image (DataTexture)
        !(dataTexture instanceof THREE.DataTexture) ||
        dataTexture.image.width !== decodedImage.width ||
        dataTexture.image.height !== decodedImage.height
      ) {
        dataTexture?.dispose();
        dataTexture = createDataTexture(decodedImage);
        this.userData.texture = dataTexture;
      } else {
        dataTexture.image = decodedImage;
        dataTexture.needsUpdate = true;
      }
    }
    this.#materialNeedsUpdate = true;
  }

  #updateMaterial(): void {
    if (!this.userData.material) {
      this.#initMaterial();
      this.#meshNeedsUpdate = true;
    }
    const material = this.userData.material!;

    const texture = this.userData.texture;
    if (texture) {
      material.uniforms.map = { value: texture };
    }

    tempColor = stringToRgba(tempColor, this.userData.settings.color);
    const transparent = tempColor.a < 1;
    const color = new THREE.Color(tempColor.r, tempColor.g, tempColor.b);
    const { brightness, contrast } = this.userData.settings;
    material.uniforms.color = { value: color };
    material.uniforms.brightness = { value: clampBrightness(brightness) };
    material.uniforms.contrast = { value: clampContrast(contrast) };
    material.uniforms.opacity = { value: tempColor.a };
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
    const { brightness, contrast } = this.userData.settings;
    const uniforms = {
      map: { value: this.userData.texture },
      color: { value: color },
      opacity: { value: tempColor.a },
      brightness: { value: clampBrightness(brightness) },
      contrast: { value: clampContrast(contrast) },
    };
    this.userData.material = new THREE.ShaderMaterial({
      name: `${this.userData.topic}:Material`,
      uniforms,
      side: THREE.DoubleSide,
      opacity: tempColor.a,
      transparent,
      depthWrite: !transparent,
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
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

  protected addError(key: string, message: string): void {
    if (this.isDisposed()) {
      return;
    }
    // must account for if the renderable is part of `ImageMode` or `Images` scene extension
    this.renderer.settings.errors.add(IMAGE_TOPIC_PATH, key, message);
    this.renderer.settings.errors.addToTopic(this.userData.topic, key, message);
  }

  protected removeError(key: string): void {
    this.renderer.settings.errors.remove(IMAGE_TOPIC_PATH, key);
    this.renderer.settings.errors.removeFromTopic(this.userData.topic, key);
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
  // Color space needs to be set to LinearSRGBColorSpace for correct color rendering on custom Shader
  texture.colorSpace = THREE.LinearSRGBColorSpace;
  return texture;
}

function createDataTexture(imageData: ImageData): THREE.DataTexture {
  const dataTexture = new THREE.DataTexture(
    imageData.data,
    imageData.width,
    imageData.height,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
    THREE.UVMapping,
    THREE.ClampToEdgeWrapping,
    THREE.ClampToEdgeWrapping,
    THREE.NearestFilter,
    THREE.LinearFilter,
    1,
    // Color space needs to be set to LinearSRGBColorSpace for correct color rendering on custom Shader
    THREE.LinearSRGBColorSpace,
  );
  dataTexture.needsUpdate = true; // ensure initial image data is displayed
  return dataTexture;
}

function createGeometry(
  cameraModel: ICameraModel,
  settings: ImageRenderableSettings,
): THREE.PlaneGeometry {
  const WIDTH_SEGMENTS = 100;
  const HEIGHT_SEGMENTS = 100;

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

async function getErrorImage(width: number, height: number): Promise<ImageBitmap> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw Error("Could not instantiate 2D canvas context");
  }

  canvas.width = width;
  canvas.height = height;

  // Draw outline
  ctx.strokeStyle = "red";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, width, height);

  // Draw X
  ctx.strokeStyle = "red";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(width, height);
  ctx.moveTo(width, 0);
  ctx.lineTo(0, height);
  ctx.stroke();

  // Get the updated image data
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const bitmap = await createImageBitmap(imageData, { resizeWidth: width });

  return bitmap;
}
