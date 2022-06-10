// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import Logger from "@foxglove/log";
import { toNanoSec } from "@foxglove/rostime";
import { SettingsTreeFields } from "@foxglove/studio-base/components/SettingsTreeEditor/types";
import PinholeCameraModel from "@foxglove/studio-base/panels/Image/lib/PinholeCameraModel";
import {
  decodeYUV,
  decodeRGB8,
  decodeRGBA8,
  decodeBGR8,
  decodeFloat1c,
  decodeBayerRGGB8,
  decodeBayerBGGR8,
  decodeBayerGBRG8,
  decodeBayerGRBG8,
  decodeMono8,
  decodeMono16,
} from "@foxglove/studio-base/panels/Image/lib/decodings";
import { MutablePoint } from "@foxglove/studio-base/types/Messages";

import { Renderer } from "../Renderer";
import { stringToRgba } from "../color";
import { CameraInfo, Pose, Image, CompressedImage } from "../ros";
import { LayerSettingsImage, LayerType } from "../settings";
import { makePose } from "../transforms/geometry";
import { updatePose } from "../updatePose";
import { missingTransformMessage, MISSING_TRANSFORM } from "./transforms";

const log = Logger.getLogger(__filename);

const CREATE_BITMAP_ERR = "CreateBitmap";

const DEFAULT_DISTANCE = 1;

const DEFAULT_SETTINGS: LayerSettingsImage = {
  visible: true,
  cameraInfoTopic: undefined,
  distance: DEFAULT_DISTANCE,
  color: "#ffffff",
};

type ImageRenderable = Omit<THREE.Object3D, "userData"> & {
  userData: {
    topic: string;
    settings: LayerSettingsImage;
    image: Image | CompressedImage;
    pose: Pose;
    srcTime: bigint;
    texture: THREE.Texture | undefined;
    material: THREE.MeshBasicMaterial | undefined;
    geometry: THREE.PlaneGeometry | undefined;
    mesh: THREE.Mesh | undefined;
  };
};

type RawImageOptions = {
  minValue?: number;
  maxValue?: number;
};

const tempColor = { r: 0, g: 0, b: 0, a: 0 };

export class Images extends THREE.Object3D {
  renderer: Renderer;
  imagesByTopic = new Map<string, ImageRenderable>();
  cameraInfoTopics = new Set<string>();

  constructor(renderer: Renderer) {
    super();
    this.renderer = renderer;

    renderer.setSettingsNodeProvider(LayerType.Image, (topicConfig, topic) => {
      const cur = topicConfig as Partial<LayerSettingsImage>;

      // Build a list of all CameraInfo topics
      const cameraInfoOptions: Array<{ label: string; value: string }> = [];
      for (const cameraInfoTopic of this.cameraInfoTopics) {
        if (cameraInfoTopicMatches(topic.name, cameraInfoTopic)) {
          cameraInfoOptions.push({ label: cameraInfoTopic, value: cameraInfoTopic });
        }
      }

      // prettier-ignore
      const fields: SettingsTreeFields = {
        cameraInfoTopic: { label: "Camera Info", input: "select", options: cameraInfoOptions, value: cur.cameraInfoTopic },
        distance: { label: "Distance", input: "number", value: cur.distance, placeholder: String(DEFAULT_DISTANCE), step: 0.1 },
        color: { label: "Color", input: "rgba", value: cur.color },
      };

      return { icon: "ImageProjection", fields };
    });
  }

  dispose(): void {
    for (const renderable of this.imagesByTopic.values()) {
      renderable.userData.texture?.dispose();
      renderable.userData.material?.dispose();
      renderable.userData.geometry?.dispose();
      renderable.userData.texture = undefined;
      renderable.userData.material = undefined;
      renderable.userData.geometry = undefined;
      renderable.userData.mesh = undefined;
    }
    this.children.length = 0;
    this.imagesByTopic.clear();
  }

  addImageMessage(topic: string, image: Image | CompressedImage): void {
    const userSettings = this.renderer.config.topics[topic] as
      | Partial<LayerSettingsImage>
      | undefined;

    // Create an ImageRenderable for this topic if it doesn't already exist
    let renderable = this.imagesByTopic.get(topic);
    if (!renderable) {
      renderable = new THREE.Object3D() as ImageRenderable;
      renderable.name = topic;
      renderable.userData = {
        topic,
        settings: { ...DEFAULT_SETTINGS, ...userSettings },
        image,
        pose: makePose(),
        srcTime: toNanoSec(image.header.stamp),
        texture: undefined,
        material: undefined,
        geometry: undefined,
        mesh: undefined,
      };

      this.add(renderable);
      this.imagesByTopic.set(topic, renderable);
    }

    // Auto-select settings.cameraInfoTopic if it's not already set
    const settings = renderable.userData.settings;
    if (settings.cameraInfoTopic == undefined) {
      autoSelectCameraInfoTopic(settings, topic, this.cameraInfoTopics);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (settings.cameraInfoTopic != undefined) {
        // Update user settings with the newly selected CameraInfo topic
        this.renderer.updateConfig((draft) => {
          const updatedUserSettings = { ...userSettings };
          updatedUserSettings.cameraInfoTopic = settings.cameraInfoTopic;
          draft.topics[topic] = updatedUserSettings;
        });

        this.renderer.emit("settingsTreeChange", { path: ["topics", topic] });
      }
    }

    this._updateImageRenderable(renderable, image, renderable.userData.settings);
  }

  addCameraInfoMessage(topic: string, _cameraInfo: CameraInfo): void {
    const updated = !this.cameraInfoTopics.has(topic);
    this.cameraInfoTopics.add(topic);

    const renderable = this.imagesByTopic.get(topic);
    if (renderable) {
      const { image, settings } = renderable.userData;
      this._updateImageRenderable(renderable, image, settings);
    }

    if (updated) {
      this.renderer.emit("settingsTreeChange", { path: ["topics"] });
    }
  }

  setTopicSettings(topic: string, settings: Partial<LayerSettingsImage>): void {
    const renderable = this.imagesByTopic.get(topic);
    if (renderable) {
      this._updateImageRenderable(renderable, renderable.userData.image, settings);
    }
  }

  startFrame(currentTime: bigint): void {
    const renderFrameId = this.renderer.renderFrameId;
    const fixedFrameId = this.renderer.fixedFrameId;
    if (renderFrameId == undefined || fixedFrameId == undefined) {
      this.visible = false;
      return;
    }
    this.visible = true;

    for (const renderable of this.imagesByTopic.values()) {
      renderable.visible = renderable.userData.settings.visible;
      if (!renderable.visible) {
        this.renderer.layerErrors.clearTopic(renderable.userData.topic);
        continue;
      }

      const srcTime = currentTime;
      const frameId = renderable.userData.image.header.frame_id;
      const updated = updatePose(
        renderable,
        this.renderer.transformTree,
        renderFrameId,
        fixedFrameId,
        frameId,
        currentTime,
        srcTime,
      );
      if (!updated) {
        const message = missingTransformMessage(renderFrameId, fixedFrameId, frameId);
        this.renderer.layerErrors.addToTopic(renderable.userData.topic, MISSING_TRANSFORM, message);
      } else {
        this.renderer.layerErrors.removeFromTopic(renderable.userData.topic, MISSING_TRANSFORM);
      }
    }
  }

  _updateImageRenderable(
    renderable: ImageRenderable,
    image: Image | CompressedImage,
    settings: Partial<LayerSettingsImage>,
  ): void {
    const prevSettings = renderable.userData.settings;
    const newSettings = { ...prevSettings, ...settings };
    const geometrySettingsEqual =
      newSettings.cameraInfoTopic === prevSettings.cameraInfoTopic &&
      newSettings.distance === prevSettings.distance;
    const materialSettingsEqual = newSettings.color === prevSettings.color;
    const topic = renderable.userData.topic;

    renderable.userData.image = image;
    renderable.userData.srcTime = toNanoSec(image.header.stamp);
    renderable.userData.settings = newSettings;

    // Dispose of the current geometry if the settings have changed
    if (!geometrySettingsEqual) {
      renderable.userData.geometry?.dispose();
      renderable.userData.geometry = undefined;
      if (renderable.userData.mesh) {
        renderable.remove(renderable.userData.mesh);
        renderable.userData.mesh = undefined;
      }
    }

    // Create the plane geometry if needed
    if (settings.cameraInfoTopic != undefined && renderable.userData.geometry == undefined) {
      const cameraRenderable = this.renderer.cameras.camerasByTopic.get(settings.cameraInfoTopic);
      const cameraModel = cameraRenderable?.userData.cameraModel;
      if (cameraModel) {
        log.debug(
          `Constructing geometry for ${cameraModel.width}x${cameraModel.height} camera image on "${topic}"`,
        );
        const distance = renderable.userData.settings.distance;
        const geometry = createGeometry(cameraModel, distance);
        renderable.userData.geometry = geometry;
        if (renderable.userData.mesh) {
          renderable.remove(renderable.userData.mesh);
          renderable.userData.mesh = undefined;
        }
      }
    }

    // Create or update the bitmap texture
    if ((image as Partial<CompressedImage>).format) {
      const compressed = image as CompressedImage;
      const bitmapData = new Blob([image.data], { type: `image/${compressed.format}` });
      self
        .createImageBitmap(bitmapData)
        .then((bitmap) => {
          if (renderable.userData.texture == undefined) {
            log.debug(
              `Creating texture for ${bitmap.width}x${bitmap.height} "${compressed.format}" camera image on "${topic}"`,
            );
            renderable.userData.texture = createCanvasTexture(bitmap);
            rebuildMaterial(renderable);
            tryCreateMesh(renderable, this.renderer);
          } else {
            renderable.userData.texture.image.close();
            renderable.userData.texture.image = bitmap;
            renderable.userData.texture.needsUpdate = true;
          }

          this.renderer.layerErrors.removeFromTopic(topic, CREATE_BITMAP_ERR);
        })
        .catch((err) => {
          this.renderer.layerErrors.addToTopic(
            topic,
            CREATE_BITMAP_ERR,
            `createBitmap failed: ${err.message}`,
          );
        });
    } else {
      const raw = image as Image;
      const { width, height } = raw;
      const prevTexture = renderable.userData.texture as THREE.DataTexture | undefined;
      if (
        prevTexture == undefined ||
        prevTexture.image.width !== width ||
        prevTexture.image.height !== height
      ) {
        prevTexture?.dispose();
        log.debug(
          `Creating data texture for ${width}x${height} "${raw.encoding}" camera image on "${topic}"`,
        );
        renderable.userData.texture = createDataTexture(width, height);
        rebuildMaterial(renderable);
        tryCreateMesh(renderable, this.renderer);
      }

      const texture = renderable.userData.texture as THREE.DataTexture;
      rawImageToDataTexture(raw, {}, texture);
      texture.needsUpdate = true;
    }

    // Create or update the material if needed
    if (!renderable.userData.material || !materialSettingsEqual) {
      rebuildMaterial(renderable);
    }

    // Create/recreate the mesh if needed
    tryCreateMesh(renderable, this.renderer);
  }
}

function tryCreateMesh(renderable: ImageRenderable, renderer: Renderer): void {
  const { topic, mesh, geometry, material } = renderable.userData;
  if (!mesh && geometry && material) {
    log.debug(`Building mesh for camera image on "${topic}"`);
    renderable.userData.mesh = new THREE.Mesh(geometry, renderable.userData.material);
    renderable.add(renderable.userData.mesh);
    renderer.animationFrame();
  }
}

function rebuildMaterial(renderable: ImageRenderable): void {
  const texture = renderable.userData.texture;

  renderable.userData.material?.dispose();
  renderable.userData.material = texture ? createMaterial(texture, renderable) : undefined;

  // Destroy the mesh, it needs to be rebuilt
  if (renderable.userData.mesh) {
    renderable.remove(renderable.userData.mesh);
    renderable.userData.mesh = undefined;
  }
}

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

function createMaterial(
  texture: THREE.Texture,
  renderable: ImageRenderable,
): THREE.MeshBasicMaterial {
  stringToRgba(tempColor, renderable.userData.settings.color);
  const transparent = tempColor.a < 1;
  const color = new THREE.Color(tempColor.r, tempColor.g, tempColor.b);
  return new THREE.MeshBasicMaterial({
    name: `${renderable.userData.topic}:Material`,
    color,
    map: texture,
    side: THREE.DoubleSide,
    opacity: tempColor.a,
    transparent,
    depthWrite: !transparent,
  });
}

function createGeometry(cameraModel: PinholeCameraModel, depth: number): THREE.PlaneGeometry {
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
  // proejcting each pixel space x/y coordinate into a 3D ray and casting out by
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
      cameraModel.projectPixelTo3dRay(p, cameraModel.rectifyPixel(pixel, pixel));
      multiplyScalar(p, depth);

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

function multiplyScalar(vec: MutablePoint, scalar: number): void {
  vec.x *= scalar;
  vec.y *= scalar;
  vec.z *= scalar;
}

function cameraInfoTopicMatches(topic: string, cameraInfoTopic: string): boolean {
  const imageParts = topic.split("/");
  const infoParts = cameraInfoTopic.split("/");
  if (imageParts.length !== infoParts.length) {
    return false;
  }

  for (let i = 0; i < imageParts.length - 1; i++) {
    if (imageParts[i] !== infoParts[i]) {
      return false;
    }
  }

  return true;
}

function autoSelectCameraInfoTopic(
  output: LayerSettingsImage,
  imageTopic: string,
  cameraInfoTopics: Set<string>,
): void {
  const candidates: string[] = [];
  for (const cameraInfoTopic of cameraInfoTopics) {
    if (cameraInfoTopicMatches(imageTopic, cameraInfoTopic)) {
      candidates.push(cameraInfoTopic);
    }
  }
  candidates.sort();
  output.cameraInfoTopic = candidates[0];
}

function rawImageToDataTexture(
  image: Image,
  options: RawImageOptions,
  output: THREE.DataTexture,
): void {
  const { encoding, width, height, is_bigendian } = image;
  const rawData = image.data as Uint8Array;
  switch (encoding) {
    case "yuv422":
      decodeYUV(image.data as Int8Array, width, height, output.image.data);
      break;
    case "rgb8":
      decodeRGB8(rawData, width, height, output.image.data);
      break;
    case "rgba8":
      decodeRGBA8(rawData, width, height, output.image.data);
      break;
    case "bgr8":
    case "8UC3":
      decodeBGR8(rawData, width, height, output.image.data);
      break;
    case "32FC1":
      decodeFloat1c(rawData, width, height, is_bigendian, output.image.data);
      break;
    case "bayer_rggb8":
      decodeBayerRGGB8(rawData, width, height, output.image.data);
      break;
    case "bayer_bggr8":
      decodeBayerBGGR8(rawData, width, height, output.image.data);
      break;
    case "bayer_gbrg8":
      decodeBayerGBRG8(rawData, width, height, output.image.data);
      break;
    case "bayer_grbg8":
      decodeBayerGRBG8(rawData, width, height, output.image.data);
      break;
    case "mono8":
    case "8UC1":
      decodeMono8(rawData, width, height, output.image.data);
      break;
    case "mono16":
    case "16UC1":
      decodeMono16(rawData, width, height, is_bigendian, output.image.data, options);
      break;
    default:
      throw new Error(`Unsupported encoding ${encoding}`);
  }
}
