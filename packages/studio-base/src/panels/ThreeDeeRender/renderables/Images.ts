// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { MultiMap } from "@foxglove/den/collection";
import {
  PinholeCameraModel,
  decodeYUV,
  decodeRGB8,
  decodeRGBA8,
  decodeBGRA8,
  decodeBGR8,
  decodeFloat1c,
  decodeBayerRGGB8,
  decodeBayerBGGR8,
  decodeBayerGBRG8,
  decodeBayerGRBG8,
  decodeMono8,
  decodeMono16,
  decodeYUYV,
} from "@foxglove/den/image";
import Logger from "@foxglove/log";
import { toNanoSec } from "@foxglove/rostime";
import { CameraCalibration, CompressedImage, RawImage } from "@foxglove/schemas";
import { SettingsTreeAction, SettingsTreeFields } from "@foxglove/studio";
import type { RosValue } from "@foxglove/studio-base/players/types";

import { cameraInfosEqual, normalizeCameraInfo, projectPixel } from "./projections";
import { BaseUserData, Renderable } from "../Renderable";
import type { Renderer } from "../Renderer";
import { PartialMessage, PartialMessageEvent, SceneExtension } from "../SceneExtension";
import { SettingsTreeEntry } from "../SettingsManager";
import { stringToRgba } from "../color";
import {
  CAMERA_CALIBRATION_DATATYPES,
  COMPRESSED_IMAGE_DATATYPES,
  RAW_IMAGE_DATATYPES,
} from "../foxglove";
import { normalizeByteArray, normalizeHeader, normalizeTime } from "../normalizeMessages";
import {
  CameraInfo,
  Image as RosImage,
  CompressedImage as RosCompressedImage,
  IMAGE_DATATYPES as ROS_IMAGE_DATATYPES,
  COMPRESSED_IMAGE_DATATYPES as ROS_COMPRESSED_IMAGE_DATATYPES,
  CAMERA_INFO_DATATYPES,
} from "../ros";
import { BaseSettings, PRECISION_DISTANCE, SelectEntry } from "../settings";
import { topicIsConvertibleToSchema } from "../topicIsConvertibleToSchema";
import { makePose } from "../transforms";

const log = Logger.getLogger(__filename);
void log;

type AnyImage = RosImage | RosCompressedImage | RawImage | CompressedImage;

export type LayerSettingsImage = BaseSettings & {
  cameraInfoTopic: string | undefined;
  distance: number;
  planarProjectionFactor: number;
  color: string;
};

const NO_CAMERA_INFO_ERR = "NoCameraInfo";
const CREATE_BITMAP_ERR = "CreateBitmap";

const DEFAULT_IMAGE_WIDTH = 512;
const DEFAULT_DISTANCE = 1;
const DEFAULT_PLANAR_PROJECTION_FACTOR = 0;

const DEFAULT_SETTINGS: LayerSettingsImage = {
  visible: false,
  frameLocked: true,
  cameraInfoTopic: undefined,
  distance: DEFAULT_DISTANCE,
  planarProjectionFactor: DEFAULT_PLANAR_PROJECTION_FACTOR,
  color: "#ffffff",
};

export type ImageUserData = BaseUserData & {
  topic: string;
  settings: LayerSettingsImage;
  cameraInfo: CameraInfo | undefined;
  cameraModel: PinholeCameraModel | undefined;
  image: AnyImage | undefined;
  texture: THREE.Texture | undefined;
  material: THREE.MeshBasicMaterial | undefined;
  geometry: THREE.PlaneGeometry | undefined;
  mesh: THREE.Mesh | undefined;
};

export class ImageRenderable extends Renderable<ImageUserData> {
  public override dispose(): void {
    this.userData.texture?.dispose();
    this.userData.material?.dispose();
    this.userData.geometry?.dispose();
    super.dispose();
  }

  public override details(): Record<string, RosValue> {
    return { image: this.userData.image, camera_info: this.userData.cameraInfo };
  }
}

export class Images extends SceneExtension<ImageRenderable> {
  /* All of the CameraInfo topics we have received at least one message on. */
  private cameraInfoTopics = new Set<string>();
  /**
   * A bi-directional mapping between cameraInfo topics and image topics. This
   * is used for retrieving an image renderable, which is indexed by image
   * topic, when receiving a camera info message.
   */
  private cameraInfoToImageTopics = new MultiMap<string, string>();

  public constructor(renderer: Renderer) {
    super("foxglove.Images", renderer);

    renderer.addSchemaSubscriptions(ROS_IMAGE_DATATYPES, this.handleRosRawImage);
    renderer.addSchemaSubscriptions(ROS_COMPRESSED_IMAGE_DATATYPES, this.handleRosCompressedImage);
    renderer.addSchemaSubscriptions(CAMERA_INFO_DATATYPES, {
      handler: this.handleCameraInfo,
      shouldSubscribe: this.cameraInfoShouldSubscribe,
    });

    renderer.addSchemaSubscriptions(RAW_IMAGE_DATATYPES, this.handleRawImage);
    renderer.addSchemaSubscriptions(COMPRESSED_IMAGE_DATATYPES, this.handleCompressedImage);
    renderer.addSchemaSubscriptions(CAMERA_CALIBRATION_DATATYPES, {
      handler: this.handleCameraInfo,
      shouldSubscribe: this.cameraInfoShouldSubscribe,
    });
  }

  public override settingsNodes(): SettingsTreeEntry[] {
    const configTopics = this.renderer.config.topics;
    const handler = this.handleSettingsAction;
    const entries: SettingsTreeEntry[] = [];
    for (const topic of this.renderer.topics ?? []) {
      if (
        !(
          topicIsConvertibleToSchema(topic, ROS_IMAGE_DATATYPES) ||
          topicIsConvertibleToSchema(topic, ROS_COMPRESSED_IMAGE_DATATYPES) ||
          topicIsConvertibleToSchema(topic, RAW_IMAGE_DATATYPES) ||
          topicIsConvertibleToSchema(topic, COMPRESSED_IMAGE_DATATYPES)
        )
      ) {
        continue;
      }
      const imageTopic = topic.name;
      const config = (configTopics[imageTopic] ?? {}) as Partial<LayerSettingsImage>;

      // Build a list of all matching CameraInfo topics
      const bestCameraInfoOptions: SelectEntry[] = [];
      const otherCameraInfoOptions: SelectEntry[] = [];
      for (const cameraInfoTopic of this.cameraInfoTopics) {
        if (cameraInfoTopicMatches(imageTopic, cameraInfoTopic)) {
          bestCameraInfoOptions.push({ label: cameraInfoTopic, value: cameraInfoTopic });
        } else {
          otherCameraInfoOptions.push({ label: cameraInfoTopic, value: cameraInfoTopic });
        }
      }
      const cameraInfoOptions = [...bestCameraInfoOptions, ...otherCameraInfoOptions];

      // prettier-ignore
      const fields: SettingsTreeFields = {
        cameraInfoTopic: { label: "Camera Info", input: "select", options: cameraInfoOptions, value: config.cameraInfoTopic },
        distance: { label: "Distance", input: "number", placeholder: String(DEFAULT_DISTANCE), step: 0.1, precision: PRECISION_DISTANCE, value: config.distance },
        planarProjectionFactor: { label: "Planar Projection Factor", input: "number", placeholder: String(DEFAULT_PLANAR_PROJECTION_FACTOR), min: 0, max: 1, step: 0.1, precision: 2, value: config.planarProjectionFactor },
        color: { label: "Color", input: "rgba", value: config.color },
      };

      entries.push({
        path: ["topics", imageTopic],
        node: {
          icon: "ImageProjection",
          fields,
          visible: config.visible ?? DEFAULT_SETTINGS.visible,
          order: imageTopic.toLocaleLowerCase(),
          handler,
        },
      });
    }
    return entries;
  }

  public override handleSettingsAction = (action: SettingsTreeAction): void => {
    const path = action.payload.path;
    if (action.action !== "update" || path.length !== 3) {
      return;
    }

    const imageTopic = path[1]!;
    const prevSettings = this.renderer.config.topics[imageTopic] as
      | Partial<LayerSettingsImage>
      | undefined;
    const prevCameraInfoTopic = prevSettings?.cameraInfoTopic;

    this.saveSetting(path, action.payload.value);

    const settings = this.renderer.config.topics[imageTopic] as
      | Partial<LayerSettingsImage>
      | undefined;
    const cameraInfoTopic = settings?.cameraInfoTopic;

    if (prevCameraInfoTopic != undefined && cameraInfoTopic !== prevCameraInfoTopic) {
      // Remove the previous camera_info_topic -> image_topic mapping
      this.cameraInfoToImageTopics.delete(prevCameraInfoTopic, imageTopic);
    }

    // Add this camera_info_topic -> image_topic mapping
    if (cameraInfoTopic != undefined) {
      this.cameraInfoToImageTopics.set(cameraInfoTopic, imageTopic);
    }

    // Update the renderable
    const renderable = this.renderables.get(imageTopic);
    const image = renderable?.userData.image;
    const cameraModel = renderable?.userData.cameraModel;
    if (image && cameraModel) {
      const receiveTime = renderable.userData.receiveTime;

      this._updateImageRenderable(renderable, image, cameraModel, receiveTime, settings);
    }
  };

  private cameraInfoShouldSubscribe = (cameraInfoTopic: string): boolean => {
    // Iterate over each configured topic and check if it has a `cameraInfoTopic` setting
    // that matches the given CameraInfo topic name
    for (const topicConfig of Object.values(this.renderer.config.topics)) {
      const maybeImageConfig = topicConfig as Partial<LayerSettingsImage>;
      if (maybeImageConfig.cameraInfoTopic === cameraInfoTopic) {
        return maybeImageConfig.visible ?? false;
      }
    }
    return false;
  };

  private handleRosRawImage = (messageEvent: PartialMessageEvent<RosImage>): void => {
    this.handleImage(messageEvent, normalizeRosImage(messageEvent.message));
  };

  private handleRosCompressedImage = (
    messageEvent: PartialMessageEvent<RosCompressedImage>,
  ): void => {
    this.handleImage(messageEvent, normalizeRosCompressedImage(messageEvent.message));
  };

  private handleRawImage = (messageEvent: PartialMessageEvent<RawImage>): void => {
    this.handleImage(messageEvent, normalizeRawImage(messageEvent.message));
  };

  private handleCompressedImage = (messageEvent: PartialMessageEvent<CompressedImage>): void => {
    this.handleImage(messageEvent, normalizeCompressedImage(messageEvent.message));
  };

  private handleImage = (messageEvent: PartialMessageEvent<AnyImage>, image: AnyImage): void => {
    const imageTopic = messageEvent.topic;
    const receiveTime = toNanoSec(messageEvent.receiveTime);
    const frameId = "header" in image ? image.header.frame_id : image.frame_id;
    const userSettings = this.renderer.config.topics[imageTopic] as
      | Partial<LayerSettingsImage>
      | undefined;

    // Create an ImageRenderable for this topic if it doesn't already exist
    const renderable = this._getImageRenderable(
      imageTopic,
      receiveTime,
      image,
      frameId,
      userSettings,
    );

    // Auto-select settings.cameraInfoTopic if it's not already set
    const settings = renderable.userData.settings;
    if (settings.cameraInfoTopic == undefined) {
      autoSelectCameraInfoTopic(settings, imageTopic, this.cameraInfoTopics);
      const newCameraInfoTopic = settings.cameraInfoTopic as string | undefined;
      if (newCameraInfoTopic != undefined) {
        this.cameraInfoToImageTopics.set(newCameraInfoTopic, imageTopic);
        // Update user settings with the newly selected CameraInfo topic
        this.renderer.updateConfig((draft) => {
          const updatedUserSettings = { ...userSettings };
          updatedUserSettings.cameraInfoTopic = newCameraInfoTopic;
          draft.topics[imageTopic] = updatedUserSettings;
        });
        this.updateSettingsTree();
      } else {
        this.renderer.settings.errors.addToTopic(
          imageTopic,
          NO_CAMERA_INFO_ERR,
          "No CameraInfo topic found",
        );
      }
    }

    const cameraModel = renderable.userData.cameraModel;
    if (cameraModel) {
      this._updateImageRenderable(renderable, image, cameraModel, receiveTime, settings);
    }
  };

  private handleCameraInfo = (
    messageEvent: PartialMessageEvent<CameraInfo> & PartialMessageEvent<CameraCalibration>,
  ): void => {
    const cameraInfoTopic = messageEvent.topic;
    const receiveTime = toNanoSec(messageEvent.receiveTime);

    const topicsUpdated = !this.cameraInfoTopics.has(cameraInfoTopic);
    if (topicsUpdated) {
      this.cameraInfoTopics.add(cameraInfoTopic);
    }
    const cameraInfo = normalizeCameraInfo(messageEvent.message);
    const frameId = cameraInfo.header.frame_id;
    const userSettings = this.renderer.config.topics[cameraInfoTopic] as
      | Partial<LayerSettingsImage>
      | undefined;

    // Check if we have a mapping from this CameraInfo topic to an Image topic
    const imageTopics = this.cameraInfoToImageTopics.get(cameraInfoTopic);
    if (imageTopics && imageTopics.length > 0) {
      for (const imageTopic of imageTopics) {
        // Get the ImageRenderable for the image topic
        const renderable = this._getImageRenderable(
          imageTopic,
          receiveTime,
          undefined,
          frameId,
          userSettings,
        );

        const dataEqual = cameraInfosEqual(renderable.userData.cameraInfo, cameraInfo);
        if (!dataEqual) {
          const cameraModel = new PinholeCameraModel(cameraInfo);
          renderable.userData.cameraModel = cameraModel;
          if (renderable.userData.image) {
            const { image, settings } = renderable.userData;
            this._updateImageRenderable(renderable, image, cameraModel, receiveTime, settings);
          }
        }
      }
    }

    if (topicsUpdated) {
      this.updateSettingsTree();
    }
  };

  private _updateImageRenderable(
    renderable: ImageRenderable,
    image: AnyImage,
    cameraModel: PinholeCameraModel,
    receiveTime: bigint,
    settings: Partial<LayerSettingsImage> | undefined,
  ): void {
    const prevSettings = renderable.userData.settings;
    const newSettings = { ...DEFAULT_SETTINGS, ...settings };
    const geometrySettingsEqual =
      newSettings.cameraInfoTopic === prevSettings.cameraInfoTopic &&
      newSettings.distance === prevSettings.distance &&
      newSettings.planarProjectionFactor === prevSettings.planarProjectionFactor;
    const materialSettingsEqual = newSettings.color === prevSettings.color;
    const topic = renderable.userData.topic;

    renderable.userData.image = image;
    renderable.userData.cameraModel = cameraModel;
    renderable.userData.frameId = this.renderer.normalizeFrameId(
      "header" in image ? image.header.frame_id : image.frame_id,
    );
    renderable.userData.receiveTime = receiveTime;
    renderable.userData.messageTime = toNanoSec(
      "header" in image ? image.header.stamp : image.timestamp,
    );
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

    const hasCameraInfo = settings?.cameraInfoTopic != undefined;
    if (hasCameraInfo) {
      this.renderer.settings.errors.removeFromTopic(topic, NO_CAMERA_INFO_ERR);
    }

    // Create the plane geometry if needed
    if (hasCameraInfo && renderable.userData.geometry == undefined) {
      const geometry = createGeometry(cameraModel, renderable.userData.settings);
      renderable.userData.geometry = geometry;
      if (renderable.userData.mesh) {
        renderable.remove(renderable.userData.mesh);
        renderable.userData.mesh = undefined;
      }
    }

    // Create or update the bitmap texture
    if ("format" in image) {
      const bitmapData = new Blob([image.data], { type: `image/${image.format}` });
      self
        .createImageBitmap(bitmapData, { resizeWidth: DEFAULT_IMAGE_WIDTH })
        .then((bitmap) => {
          if (renderable.userData.texture == undefined) {
            renderable.userData.texture = createCanvasTexture(bitmap);
            rebuildMaterial(renderable);
            tryCreateMesh(renderable, this.renderer);
          } else {
            renderable.userData.texture.image.close();
            renderable.userData.texture.image = bitmap;
            renderable.userData.texture.needsUpdate = true;
          }

          this.renderer.settings.errors.removeFromTopic(topic, CREATE_BITMAP_ERR);
        })
        .catch((err) => {
          this.renderer.settings.errors.addToTopic(
            topic,
            CREATE_BITMAP_ERR,
            `createBitmap failed: ${err.message}`,
          );
        });
    } else {
      const { width, height } = image;
      const prevTexture = renderable.userData.texture as THREE.DataTexture | undefined;
      if (
        prevTexture == undefined ||
        prevTexture.image.width !== width ||
        prevTexture.image.height !== height
      ) {
        prevTexture?.dispose();
        renderable.userData.texture = createDataTexture(width, height);
        rebuildMaterial(renderable);
        tryCreateMesh(renderable, this.renderer);
      }

      const texture = renderable.userData.texture as THREE.DataTexture;
      rawImageToDataTexture(image, {}, texture);
      texture.needsUpdate = true;
    }

    // Create or update the material if needed
    if (!renderable.userData.material || !materialSettingsEqual) {
      rebuildMaterial(renderable);
    }

    // Create/recreate the mesh if needed
    tryCreateMesh(renderable, this.renderer);
  }

  private _getImageRenderable(
    imageTopic: string,
    receiveTime: bigint,
    image: AnyImage | undefined,
    frameId: string,
    userSettings: Partial<LayerSettingsImage> | undefined,
  ): ImageRenderable {
    let renderable = this.renderables.get(imageTopic);
    if (renderable) {
      return renderable;
    }

    renderable = new ImageRenderable(imageTopic, this.renderer, {
      receiveTime,
      messageTime: image ? toNanoSec("header" in image ? image.header.stamp : image.timestamp) : 0n,
      frameId: this.renderer.normalizeFrameId(frameId),
      pose: makePose(),
      settingsPath: ["topics", imageTopic],
      topic: imageTopic,
      settings: { ...DEFAULT_SETTINGS, ...userSettings },
      cameraInfo: undefined,
      cameraModel: undefined,
      image,
      texture: undefined,
      material: undefined,
      geometry: undefined,
      mesh: undefined,
    });

    this.add(renderable);
    this.renderables.set(imageTopic, renderable);
    return renderable;
  }
}

type RawImageOptions = {
  minValue?: number;
  maxValue?: number;
};

const tempColor = { r: 0, g: 0, b: 0, a: 0 };

function tryCreateMesh(renderable: ImageRenderable, renderer: Renderer): void {
  const { mesh, geometry, material } = renderable.userData;
  if (!mesh && geometry && material) {
    renderable.userData.mesh = new THREE.Mesh(geometry, renderable.userData.material);
    renderable.add(renderable.userData.mesh);
    renderer.queueAnimationFrame();
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

function createGeometry(
  cameraModel: PinholeCameraModel,
  settings: LayerSettingsImage,
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

export function cameraInfoTopicMatches(imageTopic: string, cameraInfoTopic: string): boolean {
  const imageParts = imageTopic.split("/");
  const infoParts = cameraInfoTopic.split("/");

  for (let i = 0; i < imageParts.length - 1 && i < infoParts.length - 1; i++) {
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
  image: RosImage | RawImage,
  options: RawImageOptions,
  output: THREE.DataTexture,
): void {
  const { encoding, width, height } = image;
  const is_bigendian = "is_bigendian" in image ? image.is_bigendian : false;
  const rawData = image.data as Uint8Array;
  switch (encoding) {
    case "yuv422":
      decodeYUV(image.data as Int8Array, width, height, output.image.data);
      break;
    // same thing as yuv422, but a distinct decoding from yuv422 and yuyv
    case "uyuv":
      decodeYUV(image.data as Int8Array, width, height, output.image.data);
      break;
    // change name in the future
    case "yuyv":
      decodeYUYV(image.data as Int8Array, width, height, output.image.data);
      break;
    case "rgb8":
      decodeRGB8(rawData, width, height, output.image.data);
      break;
    case "rgba8":
      decodeRGBA8(rawData, width, height, output.image.data);
      break;
    case "bgra8":
      decodeBGRA8(rawData, width, height, output.image.data);
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

function normalizeImageData(data: Int8Array): Int8Array;
function normalizeImageData(data: PartialMessage<Uint8Array> | undefined): Uint8Array;
function normalizeImageData(data: unknown): Int8Array | Uint8Array;
function normalizeImageData(data: unknown): Int8Array | Uint8Array {
  if (data == undefined) {
    return new Uint8Array(0);
  } else if (data instanceof Int8Array || data instanceof Uint8Array) {
    return data;
  } else {
    return new Uint8Array(0);
  }
}

function normalizeRosImage(message: PartialMessage<RosImage>): RosImage {
  return {
    header: normalizeHeader(message.header),
    height: message.height ?? 0,
    width: message.width ?? 0,
    encoding: message.encoding ?? "",
    is_bigendian: message.is_bigendian ?? false,
    step: message.step ?? 0,
    data: normalizeImageData(message.data),
  };
}

function normalizeRosCompressedImage(
  message: PartialMessage<RosCompressedImage>,
): RosCompressedImage {
  return {
    header: normalizeHeader(message.header),
    format: message.format ?? "",
    data: normalizeByteArray(message.data),
  };
}

function normalizeRawImage(message: PartialMessage<RawImage>): RawImage {
  return {
    timestamp: normalizeTime(message.timestamp),
    frame_id: message.frame_id ?? "",
    height: message.height ?? 0,
    width: message.width ?? 0,
    encoding: message.encoding ?? "",
    step: message.step ?? 0,
    data: normalizeImageData(message.data),
  };
}

function normalizeCompressedImage(message: PartialMessage<CompressedImage>): CompressedImage {
  return {
    timestamp: normalizeTime(message.timestamp),
    frame_id: message.frame_id ?? "",
    format: message.format ?? "",
    data: normalizeByteArray(message.data),
  };
}
