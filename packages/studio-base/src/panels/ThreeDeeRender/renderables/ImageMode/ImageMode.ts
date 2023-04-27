// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { filterMap } from "@foxglove/den/collection";
import { PinholeCameraModel } from "@foxglove/den/image";
import { toNanoSec } from "@foxglove/rostime";
import { CameraCalibration, CompressedImage, RawImage } from "@foxglove/schemas";
import { SettingsTreeAction } from "@foxglove/studio";
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
import {
  cameraInfosEqual,
  normalizeCameraInfo,
} from "@foxglove/studio-base/panels/ThreeDeeRender/renderables/projections";
import { makePose } from "@foxglove/studio-base/panels/ThreeDeeRender/transforms";

import { ImageModeCamera } from "./ImageModeCamera";
import { ImageAnnotations } from "./annotations/ImageAnnotations";
import type { IRenderer } from "../../IRenderer";
import { PartialMessageEvent, SceneExtension } from "../../SceneExtension";
import { SettingsTreeEntry } from "../../SettingsManager";
import {
  CAMERA_CALIBRATION_DATATYPES,
  COMPRESSED_IMAGE_DATATYPES,
  RAW_IMAGE_DATATYPES,
} from "../../foxglove";
import {
  IMAGE_DATATYPES as ROS_IMAGE_DATATYPES,
  COMPRESSED_IMAGE_DATATYPES as ROS_COMPRESSED_IMAGE_DATATYPES,
  CAMERA_INFO_DATATYPES,
  CompressedImage as RosCompressedImage,
  Image as RosImage,
  CameraInfo,
} from "../../ros";
import { topicIsConvertibleToSchema } from "../../topicIsConvertibleToSchema";
import { ICameraHandler } from "../ICameraHandler";

const IMAGE_TOPIC_PATH = ["imageMode", "imageTopic"];
const CALIBRATION_TOPIC_PATH = ["imageMode", "calibrationTopic"];

const IMAGE_TOPIC_UNAVAILABLE = "IMAGE_TOPIC_UNAVAILABLE";
const CALIBRATION_TOPIC_UNAVAILABLE = "CALIBRATION_TOPIC_UNAVAILABLE";
const MISSING_CAMERA_INFO = "MISSING_CAMERA_INFO";
const IMAGE_TOPIC_DIFFERENT_FRAME = "IMAGE_TOPIC_DIFFERENT_FRAME";

const CAMERA_MODEL = "CameraModel";

export class ImageMode extends SceneExtension<ImageRenderable> implements ICameraHandler {
  private camera: ImageModeCamera;
  private cameraModel:
    | {
        model: PinholeCameraModel;
        info: CameraInfo;
      }
    | undefined;

  #annotations: ImageAnnotations;

  #imageRenderable: ImageRenderable | undefined;

  /**
   * @param canvasSize Canvas size in CSS pixels
   */
  public constructor(renderer: IRenderer, canvasSize: THREE.Vector2) {
    super("foxglove.ImageMode", renderer);

    this.camera = new ImageModeCamera();

    /**
     * By default the camera is facing down the -y axis with -z up,
     * where the image is on the +y axis with +z up.
     * To correct this we rotate the camera 180 degrees around the x axis.
     */
    this.camera.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
    this.camera.setCanvasSize(canvasSize.width, canvasSize.height);

    renderer.settings.errors.on("update", this.handleErrorChange);
    renderer.settings.errors.on("clear", this.handleErrorChange);
    renderer.settings.errors.on("remove", this.handleErrorChange);

    renderer.addSchemaSubscriptions(CAMERA_INFO_DATATYPES, {
      handler: this.handleCameraInfo,
      shouldSubscribe: this.cameraInfoShouldSubscribe,
    });
    renderer.addSchemaSubscriptions(CAMERA_CALIBRATION_DATATYPES, {
      handler: this.handleCameraInfo,
      shouldSubscribe: this.cameraInfoShouldSubscribe,
    });

    renderer.addSchemaSubscriptions(ROS_IMAGE_DATATYPES, {
      handler: this.handleRosRawImage,
      shouldSubscribe: this.imageShouldSubscribe,
    });
    renderer.addSchemaSubscriptions(ROS_COMPRESSED_IMAGE_DATATYPES, {
      handler: this.handleRosCompressedImage,
      shouldSubscribe: this.imageShouldSubscribe,
    });

    renderer.addSchemaSubscriptions(RAW_IMAGE_DATATYPES, {
      handler: this.handleRawImage,
      shouldSubscribe: this.imageShouldSubscribe,
    });
    renderer.addSchemaSubscriptions(COMPRESSED_IMAGE_DATATYPES, {
      handler: this.handleCompressedImage,
      shouldSubscribe: this.imageShouldSubscribe,
    });

    this.#annotations = new ImageAnnotations({
      initialScale: this.camera.getEffectiveScale(),
      initialCanvasWidth: canvasSize.width,
      initialCanvasHeight: canvasSize.height,
      initialPixelRatio: renderer.getPixelRatio(),
      topics: () => renderer.topics ?? [],
      config: () => renderer.config.imageMode,
      updateConfig: (updateHandler) => {
        renderer.updateConfig((draft) => updateHandler(draft.imageMode));
      },
      updateSettingsTree: () => {
        this.updateSettingsTree();
      },
      addSchemaSubscriptions: (schemaNames, handler) => {
        renderer.addSchemaSubscriptions(schemaNames, handler);
      },
    });
    this.add(this.#annotations);
  }

  public override dispose(): void {
    this.renderer.settings.errors.off("update", this.handleErrorChange);
    this.renderer.settings.errors.off("clear", this.handleErrorChange);
    this.renderer.settings.errors.off("remove", this.handleErrorChange);
    this.#annotations.dispose();
    super.dispose();
  }

  public override removeAllRenderables(): void {
    this.#annotations.removeAllRenderables();
    super.removeAllRenderables();
  }

  public override settingsNodes(): SettingsTreeEntry[] {
    const config = this.renderer.config;
    const handler = this.handleSettingsAction;

    const { imageTopic, calibrationTopic } = config.imageMode;

    const imageTopics = filterMap(this.renderer.topics ?? [], (topic) => {
      if (
        !(
          topicIsConvertibleToSchema(topic, ROS_IMAGE_DATATYPES) ||
          topicIsConvertibleToSchema(topic, ROS_COMPRESSED_IMAGE_DATATYPES) ||
          topicIsConvertibleToSchema(topic, RAW_IMAGE_DATATYPES) ||
          topicIsConvertibleToSchema(topic, COMPRESSED_IMAGE_DATATYPES)
        )
      ) {
        return;
      }
      return { label: topic.name, value: topic.name };
    });

    const calibrationTopics = filterMap(this.renderer.topics ?? [], (topic) => {
      if (
        !(
          topicIsConvertibleToSchema(topic, CAMERA_INFO_DATATYPES) ||
          topicIsConvertibleToSchema(topic, CAMERA_CALIBRATION_DATATYPES)
        )
      ) {
        return;
      }
      return { label: topic.name, value: topic.name };
    });

    if (imageTopic && !imageTopics.some((topic) => topic.value === imageTopic)) {
      this.renderer.settings.errors.add(
        IMAGE_TOPIC_PATH,
        IMAGE_TOPIC_UNAVAILABLE,
        `${imageTopic} is not available`,
      );
    } else {
      this.renderer.settings.errors.remove(IMAGE_TOPIC_PATH, IMAGE_TOPIC_UNAVAILABLE);
    }

    if (calibrationTopic && !calibrationTopics.some((topic) => topic.value === calibrationTopic)) {
      this.renderer.settings.errors.add(
        CALIBRATION_TOPIC_PATH,
        CALIBRATION_TOPIC_UNAVAILABLE,
        `${calibrationTopic} is not available`,
      );
    } else {
      this.renderer.settings.errors.remove(CALIBRATION_TOPIC_PATH, CALIBRATION_TOPIC_UNAVAILABLE);
    }

    const imageTopicError = this.renderer.settings.errors.errors.errorAtPath(IMAGE_TOPIC_PATH);
    const calibrationTopicError =
      this.renderer.settings.errors.errors.errorAtPath(CALIBRATION_TOPIC_PATH);

    // Not yet implemented
    const transformMarkers: boolean = false;
    const synchronize: boolean = false;
    const smooth: boolean = false;
    const flipHorizontal: boolean = false;
    const flipVertical: boolean = false;
    const rotation = 0;
    const minValue: number | undefined = undefined;
    const maxValue: number | undefined = undefined;

    return [
      {
        path: ["imageMode"],
        node: {
          label: "General",
          defaultExpansionState: "expanded",
          handler,
          fields: {
            imageTopic: {
              label: "Topic",
              input: "select",
              value: imageTopic,
              options: imageTopics,
              error: imageTopicError,
            },
            calibrationTopic: {
              label: "Calibration",
              input: "select",
              value: config.imageMode.calibrationTopic,
              options: calibrationTopics,
              error: calibrationTopicError,
            },
            TODO_transformMarkers: {
              readonly: true, // not yet implemented
              input: "boolean",
              label: "🚧 Transform markers",
              value: transformMarkers,
              help: (transformMarkers as boolean)
                ? "Markers are being transformed by Foxglove Studio based on the camera model. Click to turn it off."
                : `Markers can be transformed by Foxglove Studio based on the camera model. Click to turn it on.`,
            },
            TODO_synchronize: {
              readonly: true, // not yet implemented
              input: "boolean",
              label: "🚧 Synchronize timestamps",
              value: synchronize,
            },
            TODO_smooth: {
              readonly: true, // not yet implemented
              input: "boolean",
              label: "🚧 Bilinear smoothing",
              value: smooth,
            },
            TODO_flipHorizontal: {
              readonly: true, // not yet implemented
              input: "boolean",
              label: "🚧 Flip horizontal",
              value: flipHorizontal,
            },
            TODO_flipVertical: {
              readonly: true, // not yet implemented
              input: "boolean",
              label: "🚧 Flip vertical",
              value: flipVertical,
            },
            TODO_rotation: {
              readonly: true, // not yet implemented
              input: "select",
              label: "🚧 Rotation",
              value: rotation,
              options: [
                { label: "0°", value: 0 },
                { label: "90°", value: 90 },
                { label: "180°", value: 180 },
                { label: "270°", value: 270 },
              ],
            },
            TODO_minValue: {
              readonly: true, // not yet implemented
              input: "number",
              label: "🚧 Min (depth images)",
              placeholder: "0",
              value: minValue,
            },
            TODO_maxValue: {
              readonly: true, // not yet implemented
              input: "number",
              label: "🚧 Max (depth images)",
              placeholder: "10000",
              value: maxValue,
            },
          },
        },
      },
      ...this.#annotations.settingsNodes(),
    ];
  }

  public override handleSettingsAction = (action: SettingsTreeAction): void => {
    if (action.action !== "update" || action.payload.path.length === 0) {
      return;
    }

    const path = action.payload.path;
    const category = path[0]!;
    const value = action.payload.value;
    if (category === "imageMode") {
      this.saveSetting(path, value);
      this.updateViewAndRenderables();
    } else {
      return;
    }

    // Update the settings sidebar
    this.updateSettingsTree();
  };

  private cameraInfoShouldSubscribe = (topic: string): boolean => {
    return this.getImageModeSettings().calibrationTopic === topic;
  };

  private imageShouldSubscribe = (topic: string): boolean => {
    return this.getImageModeSettings().imageTopic === topic;
  };

  /** Processes camera info messages and updates state */
  private handleCameraInfo = (
    messageEvent: PartialMessageEvent<CameraInfo> & PartialMessageEvent<CameraCalibration>,
  ): void => {
    // Store the last camera info on each topic, when processing an image message we'll look up
    // the camera info by the info topic configured for the image
    const cameraInfo = normalizeCameraInfo(messageEvent.message);
    this.updateCameraModel(cameraInfo);
    this.updateViewAndRenderables();
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
    const topic = messageEvent.topic;
    const receiveTime = toNanoSec(messageEvent.receiveTime);
    const frameId = "header" in image ? image.header.frame_id : image.frame_id;

    const renderable = this.#getImageRenderable(topic, receiveTime, image, frameId);

    if (this.cameraModel) {
      renderable.userData.cameraInfo = this.cameraModel.info;
      renderable.setCameraModel(this.cameraModel.model);
    }
    renderable.name = topic;
    renderable.setImage(image);
    renderable.update();
  };

  #getImageRenderable(
    topicName: string,
    receiveTime: bigint,
    image: AnyImage | undefined,
    frameId: string,
  ): ImageRenderable {
    let renderable = this.#imageRenderable;
    if (renderable) {
      return renderable;
    }

    // we don't have settings for images yet
    const userSettings = { ...IMAGE_RENDERABLE_DEFAULT_SETTINGS };

    renderable = new ImageRenderable(topicName, this.renderer, {
      receiveTime,
      messageTime: image ? toNanoSec("header" in image ? image.header.stamp : image.timestamp) : 0n,
      frameId: this.renderer.normalizeFrameId(frameId),
      pose: makePose(),
      settingsPath: IMAGE_TOPIC_PATH,
      topic: topicName,
      settings: userSettings,
      cameraInfo: undefined,
      cameraModel: undefined,
      image,
      texture: undefined,
      material: undefined,
      geometry: undefined,
      mesh: undefined,
    });

    this.add(renderable);
    this.#imageRenderable = renderable;
    renderable.setRenderBehindScene();
    renderable.visible = true;
    return renderable;
  }

  /** Gets frame from active info or image message if info does not have one*/
  private getCurrentFrameId(): string | undefined {
    const { imageMode } = this.renderer.config;
    const { calibrationTopic, imageTopic } = imageMode;

    if (calibrationTopic == undefined && imageTopic == undefined) {
      return undefined;
    }

    const selectedCameraInfo = this.cameraModel?.info;
    const selectedImage = this.#imageRenderable?.userData.image;

    const cameraInfoFrameId = selectedCameraInfo?.header.frame_id;

    const imageFrameId =
      selectedImage && "header" in selectedImage
        ? selectedImage.header.frame_id
        : selectedImage?.frame_id;

    if (imageFrameId != undefined) {
      if (imageFrameId !== cameraInfoFrameId) {
        this.renderer.settings.errors.add(
          IMAGE_TOPIC_PATH,
          IMAGE_TOPIC_DIFFERENT_FRAME,
          `Image topic's frame id (${imageFrameId}) does not match camera info's frame id (${cameraInfoFrameId})`,
        );
      } else {
        this.renderer.settings.errors.remove(IMAGE_TOPIC_PATH, IMAGE_TOPIC_DIFFERENT_FRAME);
      }
    }

    // use camera info's frame id if available, otherwise use image topic's frame id
    return cameraInfoFrameId ?? imageFrameId;
  }

  private getImageModeSettings(): {
    readonly calibrationTopic?: string;
    readonly imageTopic?: string;
  } {
    return this.renderer.config.imageMode;
  }

  /**
   * Updates renderable, frame, and camera to be in sync with current camera model
   */
  private updateViewAndRenderables(): void {
    const cameraInfo = this.cameraModel?.info;
    if (!cameraInfo) {
      this.renderer.settings.errors.add(
        CALIBRATION_TOPIC_PATH,
        MISSING_CAMERA_INFO,
        "Missing camera info for topic",
      );
      return;
    } else {
      this.renderer.settings.errors.remove(CALIBRATION_TOPIC_PATH, MISSING_CAMERA_INFO);
    }

    // set the render frame id to the camera info's frame id
    this.renderer.followFrameId = this.getCurrentFrameId();
    if (this.cameraModel?.model) {
      this.camera.updateCamera(this.cameraModel.model);
      this.#annotations.updateScale(
        this.camera.getEffectiveScale(),
        this.renderer.input.canvasSize.width,
        this.renderer.input.canvasSize.height,
        this.renderer.getPixelRatio(),
      );
      const imageRenderable = this.#imageRenderable;
      if (imageRenderable) {
        imageRenderable.userData.cameraInfo = this.cameraModel.info;
        imageRenderable.setCameraModel(this.cameraModel.model);
        imageRenderable.update();
      }
    }
  }

  /**
   * update this.cameraModel with a new model if the camera info has changed
   */
  private updateCameraModel(newCameraInfo: CameraInfo) {
    // If the camera info has not changed, we don't need to make a new model and can return the existing one
    const currentCameraInfo = this.cameraModel?.info;
    const dataEqual = cameraInfosEqual(currentCameraInfo, newCameraInfo);
    if (dataEqual && currentCameraInfo != undefined) {
      return;
    }

    const model = this.getPinholeCameraModel(newCameraInfo);
    if (model) {
      this.cameraModel = {
        model,
        info: newCameraInfo,
      };
      this.#annotations.updateCameraModel(model);
    }
  }

  /**
   * Returns PinholeCameraModel for given CameraInfo
   * This function will set a topic error on the image topic if the camera model creation fails.
   * @param cameraInfo - CameraInfo to create model from
   */
  private getPinholeCameraModel(cameraInfo: CameraInfo): PinholeCameraModel | undefined {
    let model = undefined;
    try {
      model = new PinholeCameraModel(cameraInfo);
      this.renderer.settings.errors.remove(CALIBRATION_TOPIC_PATH, CAMERA_MODEL);
    } catch (errUnk) {
      this.cameraModel = undefined;
      const err = errUnk as Error;
      this.renderer.settings.errors.add(CALIBRATION_TOPIC_PATH, CAMERA_MODEL, err.message);
    }
    return model;
  }

  public getActiveCamera(): THREE.PerspectiveCamera | THREE.OrthographicCamera {
    return this.camera;
  }

  public handleResize(width: number, height: number, pixelRatio: number): void {
    this.camera.setCanvasSize(width, height);
    this.#annotations.updateScale(this.camera.getEffectiveScale(), width, height, pixelRatio);
  }

  public setCameraState(): void {
    this.updateViewAndRenderables();
  }

  public getCameraState(): undefined {
    return undefined;
  }

  private handleErrorChange = (): void => {
    this.updateSettingsTree();
  };
}
