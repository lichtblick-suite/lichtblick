// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { assert } from "ts-essentials";

import { MultiMap } from "@foxglove/den/collection";
import { PinholeCameraModel } from "@foxglove/den/image";
import Logger from "@foxglove/log";
import { toNanoSec } from "@foxglove/rostime";
import { CameraCalibration, CompressedImage, RawImage } from "@foxglove/schemas";
import { SettingsTreeAction, SettingsTreeFields, Topic } from "@foxglove/studio";
import {
  IMAGE_RENDERABLE_DEFAULT_SETTINGS,
  ImageRenderable,
} from "@foxglove/studio-base/panels/ThreeDeeRender/renderables/Images/ImageRenderable";
import { AnyImage } from "@foxglove/studio-base/panels/ThreeDeeRender/renderables/Images/ImageTypes";
import {
  normalizeCompressedImage,
  normalizeRawImage,
  normalizeRosCompressedImage,
  normalizeRosImage,
} from "@foxglove/studio-base/panels/ThreeDeeRender/renderables/Images/imageNormalizers";

import { cameraInfosEqual, normalizeCameraInfo } from "./projections";
import type { IRenderer } from "../IRenderer";
import { PartialMessageEvent, SceneExtension } from "../SceneExtension";
import { SettingsTreeEntry } from "../SettingsManager";
import {
  CAMERA_CALIBRATION_DATATYPES,
  COMPRESSED_IMAGE_DATATYPES,
  RAW_IMAGE_DATATYPES,
} from "../foxglove";
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

export type LayerSettingsImage = BaseSettings & {
  cameraInfoTopic: string | undefined;
  distance: number;
  planarProjectionFactor: number;
  color: string;
};

const NO_CAMERA_INFO_ERR = "NoCameraInfo";
const CAMERA_MODEL = "CameraModel";

export class Images extends SceneExtension<ImageRenderable> {
  /* All known camera info topics */
  #cameraInfoTopics = new Set<string>();

  /**
   * A bi-directional mapping between cameraInfo topics and image topics. This
   * is used for retrieving an image renderable, which is indexed by image
   * topic, when receiving a camera info message.
   */
  #cameraInfoToImageTopics = new MultiMap<string, string>();

  /**
   * Map of camera info topic name -> normalized CameraInfo message
   *
   * This stores the last camera info message on each topic so it can be applied when rendering the image
   */
  #cameraInfoByTopic = new Map<string, CameraInfo>();

  #lastTopics: readonly Topic[] | undefined = undefined;

  public constructor(renderer: IRenderer) {
    super("foxglove.Images", renderer);

    renderer.addSchemaSubscriptions(ROS_IMAGE_DATATYPES, this.#handleRosRawImage);
    renderer.addSchemaSubscriptions(ROS_COMPRESSED_IMAGE_DATATYPES, this.#handleRosCompressedImage);
    renderer.addSchemaSubscriptions(CAMERA_INFO_DATATYPES, {
      handler: this.#handleCameraInfo,
      shouldSubscribe: this.#cameraInfoShouldSubscribe,
    });

    renderer.addSchemaSubscriptions(RAW_IMAGE_DATATYPES, this.#handleRawImage);
    renderer.addSchemaSubscriptions(COMPRESSED_IMAGE_DATATYPES, this.#handleCompressedImage);
    renderer.addSchemaSubscriptions(CAMERA_CALIBRATION_DATATYPES, {
      handler: this.#handleCameraInfo,
      shouldSubscribe: this.#cameraInfoShouldSubscribe,
    });

    this.#updateCameraInfoTopics();
  }

  /**
   * Update cameraInfoTopics cache with latest set of camera info messages
   */
  #updateCameraInfoTopics() {
    if (this.renderer.topics === this.#lastTopics) {
      return;
    }

    this.#lastTopics = this.renderer.topics;

    this.#cameraInfoTopics = new Set();
    for (const topic of this.renderer.topics ?? []) {
      if (
        topicIsConvertibleToSchema(topic, CAMERA_INFO_DATATYPES) ||
        topicIsConvertibleToSchema(topic, CAMERA_CALIBRATION_DATATYPES)
      ) {
        this.#cameraInfoTopics.add(topic.name);
      }
    }
  }

  public override settingsNodes(): SettingsTreeEntry[] {
    this.#updateCameraInfoTopics();
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
      for (const cameraInfoTopic of this.#cameraInfoTopics) {
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
        distance: { label: "Distance", input: "number", placeholder: String(IMAGE_RENDERABLE_DEFAULT_SETTINGS.distance), step: 0.1, precision: PRECISION_DISTANCE, value: config.distance },
        planarProjectionFactor: { label: "Planar Projection Factor", input: "number", placeholder: String(IMAGE_RENDERABLE_DEFAULT_SETTINGS.planarProjectionFactor), min: 0, max: 1, step: 0.1, precision: 2, value: config.planarProjectionFactor },
        color: { label: "Color", input: "rgba", value: config.color },
      };

      entries.push({
        path: ["topics", imageTopic],
        node: {
          icon: "ImageProjection",
          fields,
          visible: config.visible ?? IMAGE_RENDERABLE_DEFAULT_SETTINGS.visible,
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

    // Add this camera_info_topic -> image_topic mapping
    if (cameraInfoTopic !== prevCameraInfoTopic && cameraInfoTopic != undefined) {
      this.#cameraInfoToImageTopics.set(cameraInfoTopic, imageTopic);
    }

    const renderable = this.renderables.get(imageTopic);
    if (!renderable) {
      return;
    }

    renderable.setSettings({ ...IMAGE_RENDERABLE_DEFAULT_SETTINGS, ...settings });

    // The camera info topic changed for our renderable
    // Remove the previous camera_info_topic -> image_topic mapping
    if (prevCameraInfoTopic != undefined) {
      this.#cameraInfoToImageTopics.delete(prevCameraInfoTopic, imageTopic);
    }

    // apply camera info to new renderable
    if (!cameraInfoTopic) {
      return;
    }

    // Look up the camera info for our image topic
    const cameraInfo = this.#cameraInfoByTopic.get(cameraInfoTopic);
    if (!cameraInfo) {
      this.renderer.settings.errors.addToTopic(
        imageTopic,
        NO_CAMERA_INFO_ERR,
        `No CameraInfo received on ${cameraInfoTopic}`,
      );
      return;
    }
    this.#recomputeCameraModel(renderable, cameraInfo);
    renderable.update();
  };

  #cameraInfoShouldSubscribe = (cameraInfoTopic: string): boolean => {
    // Iterate over each topic config and check if it has a cameraInfoTopic setting that matches
    // the cameraInfoTopic we might want to turn on. If it does and the topic is visible, return
    // true so we know to subscribe.
    for (const topicConfig of Object.values(this.renderer.config.topics)) {
      const maybeImageConfig = topicConfig as Partial<LayerSettingsImage>;
      if (
        maybeImageConfig.cameraInfoTopic === cameraInfoTopic &&
        maybeImageConfig.visible === true
      ) {
        return true;
      }
    }

    return false;
  };

  #handleRosRawImage = (messageEvent: PartialMessageEvent<RosImage>): void => {
    this.#handleImage(messageEvent, normalizeRosImage(messageEvent.message));
  };

  #handleRosCompressedImage = (messageEvent: PartialMessageEvent<RosCompressedImage>): void => {
    this.#handleImage(messageEvent, normalizeRosCompressedImage(messageEvent.message));
  };

  #handleRawImage = (messageEvent: PartialMessageEvent<RawImage>): void => {
    this.#handleImage(messageEvent, normalizeRawImage(messageEvent.message));
  };

  #handleCompressedImage = (messageEvent: PartialMessageEvent<CompressedImage>): void => {
    this.#handleImage(messageEvent, normalizeCompressedImage(messageEvent.message));
  };

  #handleImage = (messageEvent: PartialMessageEvent<AnyImage>, image: AnyImage): void => {
    // Ensure the latest list of camera info topics is up to date for autoSelectCameraInfoTopic call below
    this.#updateCameraInfoTopics();

    const imageTopic = messageEvent.topic;
    const receiveTime = toNanoSec(messageEvent.receiveTime);
    const frameId = "header" in image ? image.header.frame_id : image.frame_id;

    const renderable = this.#getImageRenderable(imageTopic, receiveTime, image, frameId);

    renderable.setImage(image);
    renderable.userData.receiveTime = receiveTime;
    // Auto-select settings.cameraInfoTopic if it's not already set
    const settings = renderable.userData.settings;
    if (settings.cameraInfoTopic == undefined) {
      const newCameraInfoTopic = autoSelectCameraInfoTopic(imageTopic, this.#cameraInfoTopics);
      settings.cameraInfoTopic = newCameraInfoTopic;
      renderable.setSettings(settings);

      // With no selected camera info topic, we show a topic error and bail
      // There's no way to render without camera info
      if (newCameraInfoTopic == undefined) {
        this.renderer.settings.errors.addToTopic(
          imageTopic,
          NO_CAMERA_INFO_ERR,
          "No CameraInfo topic found",
        );
        return;
      }

      // We auto-selected a camera info topic for this image topic so we need to add the lookup.
      // Without this lookup, the handleCameraInfo won't know what image topics to update when
      // camera info messages arrive after image messages.

      // Update user settings with the newly selected CameraInfo topic
      this.renderer.updateConfig((draft) => {
        const updatedUserSettings = { ...settings };
        updatedUserSettings.cameraInfoTopic = newCameraInfoTopic;
        draft.topics[imageTopic] = updatedUserSettings;
      });
      this.updateSettingsTree();
    }

    assert(settings.cameraInfoTopic != undefined);
    this.#cameraInfoToImageTopics.set(settings.cameraInfoTopic, imageTopic);

    // Look up the camera info for our renderable
    const cameraInfo = this.#cameraInfoByTopic.get(settings.cameraInfoTopic);
    if (!cameraInfo) {
      this.renderer.settings.errors.addToTopic(
        imageTopic,
        NO_CAMERA_INFO_ERR,
        `No CameraInfo received on ${settings.cameraInfoTopic}`,
      );
      return;
    }

    this.#recomputeCameraModel(renderable, cameraInfo);
    renderable.update();
  };

  #handleCameraInfo = (
    messageEvent: PartialMessageEvent<CameraInfo> & PartialMessageEvent<CameraCalibration>,
  ): void => {
    // Store the last camera info on each topic, when processing an image message we'll look up
    // the camera info by the info topic configured for the image
    const cameraInfo = normalizeCameraInfo(messageEvent.message);
    this.#cameraInfoByTopic.set(messageEvent.topic, cameraInfo);

    // Look up any image topics assigned to our camera info topic and determine if we need to update
    // those renderables since we now have a camera info whereas we may not have previously
    const imageTopics = this.#cameraInfoToImageTopics.get(messageEvent.topic) ?? [];
    for (const imageTopic of imageTopics) {
      const renderable = this.renderables.get(imageTopic);
      if (!renderable) {
        continue;
      }

      // If there's no camera info topic assigned then we don't need to do update this renderable
      const settings = renderable.userData.settings;
      if (!settings.cameraInfoTopic || settings.cameraInfoTopic !== messageEvent.topic) {
        continue;
      }
      this.renderer.settings.errors.removeFromTopic(imageTopic, NO_CAMERA_INFO_ERR);

      this.#recomputeCameraModel(renderable, cameraInfo);
      renderable.update();
    }
  };

  /**
   * Recompute a new camera model if the newCameraInfo differs from the current renderable info. If
   * the info is unchanged then the existing camera model is returned.
   *
   * If a camera model could not be created this returns undefined.
   *
   * This function will set a topic error on the image topic if the camera model creation fails.
   */
  #recomputeCameraModel(renderable: ImageRenderable, newCameraInfo: CameraInfo) {
    // If the camera info has not changed, we don't need to make a new model and can return the existing one
    const dataEqual = cameraInfosEqual(renderable.userData.cameraInfo, newCameraInfo);
    if (dataEqual && renderable.userData.cameraModel != undefined) {
      return;
    }

    const imageTopic = renderable.userData.topic;

    try {
      renderable.setCameraModel(new PinholeCameraModel(newCameraInfo));
      renderable.userData.cameraInfo = newCameraInfo;
      this.renderer.settings.errors.removeFromTopic(imageTopic, CAMERA_MODEL);
    } catch (errUnk) {
      const err = errUnk as Error;
      this.renderer.settings.errors.addToTopic(imageTopic, CAMERA_MODEL, err.message);
    }
  }

  // Get or create an image renderable for the imageTopic
  #getImageRenderable(
    imageTopic: string,
    receiveTime: bigint,
    image: AnyImage | undefined,
    frameId: string,
  ): ImageRenderable {
    let renderable = this.renderables.get(imageTopic);
    if (renderable) {
      return renderable;
    }

    // Look up any existing settings for the image topic to save as user data with the renderable
    const userSettings = this.renderer.config.topics[imageTopic] as
      | Partial<LayerSettingsImage>
      | undefined;

    renderable = new ImageRenderable(imageTopic, this.renderer, {
      receiveTime,
      messageTime: image ? toNanoSec("header" in image ? image.header.stamp : image.timestamp) : 0n,
      frameId: this.renderer.normalizeFrameId(frameId),
      pose: makePose(),
      settingsPath: ["topics", imageTopic],
      topic: imageTopic,
      settings: { ...IMAGE_RENDERABLE_DEFAULT_SETTINGS, ...userSettings },
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

/**
 * Look up a matching camera info topic for the image topic.
 *
 * Return a candidate camera info topic.
 */
function autoSelectCameraInfoTopic(
  imageTopic: string,
  cameraInfoTopics: Set<string>,
): string | undefined {
  const candidates: string[] = [];
  for (const cameraInfoTopic of cameraInfoTopics) {
    if (cameraInfoTopicMatches(imageTopic, cameraInfoTopic)) {
      candidates.push(cameraInfoTopic);
    }
  }
  candidates.sort();
  return candidates[0];
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
