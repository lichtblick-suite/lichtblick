// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Immutable } from "immer";
import * as THREE from "three";

import { filterMap } from "@foxglove/den/collection";
import { PinholeCameraModel } from "@foxglove/den/image";
import { toNanoSec } from "@foxglove/rostime";
import { SettingsTreeAction, SettingsTreeFields, Topic } from "@foxglove/studio";
import {
  CREATE_BITMAP_ERR_KEY,
  IMAGE_RENDERABLE_DEFAULT_SETTINGS,
  ImageRenderable,
} from "@foxglove/studio-base/panels/ThreeDeeRender/renderables/Images/ImageRenderable";
import {
  AnyImage,
  DownloadImageInfo,
  getFrameIdFromImage,
} from "@foxglove/studio-base/panels/ThreeDeeRender/renderables/Images/ImageTypes";
import {
  cameraInfosEqual,
  normalizeCameraInfo,
} from "@foxglove/studio-base/panels/ThreeDeeRender/renderables/projections";
import { makePose } from "@foxglove/studio-base/panels/ThreeDeeRender/transforms";

import { ImageModeCamera } from "./ImageModeCamera";
import { MessageHandler, MessageRenderState } from "./MessageHandler";
import { ImageAnnotations } from "./annotations/ImageAnnotations";
import type { AnyRendererSubscription, IRenderer, ImageModeConfig } from "../../IRenderer";
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
  CameraInfo,
} from "../../ros";
import { topicIsConvertibleToSchema } from "../../topicIsConvertibleToSchema";
import { ICameraHandler } from "../ICameraHandler";
import { decodeCompressedImageToBitmap } from "../Images/decodeImage";
import { getTopicMatchPrefix, sortPrefixMatchesToFront } from "../Images/topicPrefixMatching";

const IMAGE_TOPIC_PATH = ["imageMode", "imageTopic"];
const CALIBRATION_TOPIC_PATH = ["imageMode", "calibrationTopic"];

const IMAGE_TOPIC_UNAVAILABLE = "IMAGE_TOPIC_UNAVAILABLE";
const CALIBRATION_TOPIC_UNAVAILABLE = "CALIBRATION_TOPIC_UNAVAILABLE";
const FALLBACK_CALIBRATION_ACTIVE_ALERT_KEY = "FALLBACK_CALIBRATION_ACTIVE";

const MISSING_CAMERA_INFO = "MISSING_CAMERA_INFO";
const IMAGE_TOPIC_DIFFERENT_FRAME = "IMAGE_TOPIC_DIFFERENT_FRAME";

const CAMERA_MODEL = "CameraModel";

const DEFAULT_FOCAL_LENGTH = 500;
const DEFAULT_IMAGE_WIDTH = 512;

type ImageModeEvent = { type: "hasModifiedViewChanged" };

const ALL_SUPPORTED_IMAGE_SCHEMAS = new Set([
  ...ROS_IMAGE_DATATYPES,
  ...ROS_COMPRESSED_IMAGE_DATATYPES,
  ...RAW_IMAGE_DATATYPES,
  ...COMPRESSED_IMAGE_DATATYPES,
]);

const ALL_SUPPORTED_CALIBRATION_SCHEMAS = new Set([
  ...CAMERA_INFO_DATATYPES,
  ...CAMERA_CALIBRATION_DATATYPES,
]);

const DEFAULT_CONFIG = {
  synchronize: false,
  flipHorizontal: false,
  flipVertical: false,
  rotation: 0 as 0 | 90 | 180 | 270,
};

type ConfigWithDefaults = ImageModeConfig & typeof DEFAULT_CONFIG;
export class ImageMode
  extends SceneExtension<ImageRenderable, ImageModeEvent>
  implements ICameraHandler
{
  #camera: ImageModeCamera;
  #cameraModel:
    | {
        model: PinholeCameraModel;
        info: CameraInfo;
      }
    | undefined;

  readonly #annotations: ImageAnnotations;

  #imageRenderable: ImageRenderable | undefined;

  readonly #messageHandler: MessageHandler;

  #dragStartPanOffset = new THREE.Vector2();
  #dragStartMouseCoords = new THREE.Vector2();
  #hasModifiedView = false;

  // Will need to change when synchronization is implemented (FG-2686)
  #latestImage: { topic: string; image: AnyImage } | undefined;

  // eslint-disable-next-line @foxglove/no-boolean-parameters
  #setHasCalibrationTopic: (hasCalibrationTopic: boolean) => void;

  /**
   * @param canvasSize Canvas size in CSS pixels
   */
  public constructor(
    renderer: IRenderer,
    {
      canvasSize,
      setHasCalibrationTopic,
    }: {
      canvasSize: THREE.Vector2;

      // eslint-disable-next-line @foxglove/no-boolean-parameters
      setHasCalibrationTopic: (hasCalibrationTopic: boolean) => void;
    },
  ) {
    super("foxglove.ImageMode", renderer);

    this.#setHasCalibrationTopic = setHasCalibrationTopic;

    this.#camera = new ImageModeCamera();

    const config = this.#getImageModeSettings();

    this.#camera.setCanvasSize(canvasSize.width, canvasSize.height);
    this.#camera.setRotation(config.rotation);
    this.#camera.setFlipHorizontal(config.flipHorizontal);
    this.#camera.setFlipVertical(config.flipVertical);

    this.#messageHandler = new MessageHandler(config);
    this.#messageHandler.addListener(this.#updateFromMessageState);

    renderer.settings.errors.on("update", this.#handleErrorChange);
    renderer.settings.errors.on("clear", this.#handleErrorChange);
    renderer.settings.errors.on("remove", this.#handleErrorChange);
    this.#annotations = new ImageAnnotations({
      initialScale: this.#camera.getEffectiveScale(),
      initialCanvasWidth: canvasSize.width,
      initialCanvasHeight: canvasSize.height,
      initialPixelRatio: renderer.getPixelRatio(),
      topics: () => renderer.topics ?? [],
      config: () => this.#getImageModeSettings(),
      updateConfig: (updateHandler) => {
        renderer.updateConfig((draft) => updateHandler(draft.imageMode));
      },
      updateSettingsTree: () => {
        this.updateSettingsTree();
      },
      labelPool: renderer.labelPool,
      messageHandler: this.#messageHandler,
    });
    this.add(this.#annotations);

    renderer.input.on("mousedown", (mouseDownCursorCoords) => {
      this.#camera.getPanOffset(this.#dragStartPanOffset);
      this.#dragStartMouseCoords.copy(mouseDownCursorCoords);

      renderer.input.trackDrag((mouseMoveCursorCoords) => {
        this.#camera.setPanOffset(
          mouseMoveCursorCoords
            .clone()
            .sub(this.#dragStartMouseCoords)
            .add(this.#dragStartPanOffset),
        );
        this.#hasModifiedView = true;
        this.dispatchEvent({ type: "hasModifiedViewChanged" });
        this.renderer.queueAnimationFrame();
      });
    });

    renderer.input.on("wheel", (cursorCoords, _worldSpaceCursorCoords, event) => {
      this.#camera.updateZoomFromWheel(
        // Clamp wheel deltas which can vary wildly across different operating systems, browsers, and input devices.
        1 - 0.01 * THREE.MathUtils.clamp(event.deltaY, -30, 30),
        cursorCoords,
      );
      this.#updateAnnotationsScale();
      this.#hasModifiedView = true;
      this.dispatchEvent({ type: "hasModifiedViewChanged" });
      this.renderer.queueAnimationFrame();
    });

    this.renderer.on("topicsChanged", this.#handleTopicsChanged);
    this.#handleTopicsChanged();
  }

  public hasModifiedView(): boolean {
    return this.#hasModifiedView;
  }

  public resetViewModifications(): void {
    this.#hasModifiedView = false;
    this.#camera.resetModifications();
    this.#updateAnnotationsScale();
    this.dispatchEvent({ type: "hasModifiedViewChanged" });
  }

  public override getSubscriptions(): readonly AnyRendererSubscription[] {
    const subscriptions: AnyRendererSubscription[] = [
      {
        type: "schema",
        schemaNames: ALL_SUPPORTED_CALIBRATION_SCHEMAS,
        subscription: {
          handler: this.#messageHandler.handleCameraInfo,
          shouldSubscribe: this.#cameraInfoShouldSubscribe,
        },
      },
      {
        type: "schema",
        schemaNames: ROS_IMAGE_DATATYPES,
        subscription: {
          handler: this.#messageHandler.handleRosRawImage,
          shouldSubscribe: this.#imageShouldSubscribe,
        },
      },
      {
        type: "schema",
        schemaNames: ROS_COMPRESSED_IMAGE_DATATYPES,
        subscription: {
          handler: this.#messageHandler.handleRosCompressedImage,
          shouldSubscribe: this.#imageShouldSubscribe,
        },
      },
      {
        type: "schema",
        schemaNames: RAW_IMAGE_DATATYPES,
        subscription: {
          handler: this.#messageHandler.handleRawImage,
          shouldSubscribe: this.#imageShouldSubscribe,
        },
      },
      {
        type: "schema",
        schemaNames: COMPRESSED_IMAGE_DATATYPES,
        subscription: {
          handler: this.#messageHandler.handleCompressedImage,
          shouldSubscribe: this.#imageShouldSubscribe,
        },
      },
    ];
    return subscriptions.concat(this.#annotations.getSubscriptions());
  }

  public override dispose(): void {
    this.renderer.settings.errors.off("update", this.#handleErrorChange);
    this.renderer.settings.errors.off("clear", this.#handleErrorChange);
    this.renderer.settings.errors.off("remove", this.#handleErrorChange);
    this.renderer.off("topicsChanged", this.#handleTopicsChanged);
    this.#annotations.dispose();
    this.#imageRenderable?.dispose();
    super.dispose();
  }

  public override removeAllRenderables(): void {
    this.#annotations.removeAllRenderables();
    this.#imageRenderable?.dispose();
    this.#imageRenderable?.removeFromParent();
    this.#imageRenderable = undefined;
    this.#messageHandler.clear();
    this.#latestImage = undefined;
    this.#clearCameraModel();
    super.removeAllRenderables();
  }

  /**
   * If no image topic is selected, automatically select the first available one from `renderer.topics`.
   * Also auto-select a new calibration topic to match the new image topic.
   */
  #handleTopicsChanged = () => {
    if (this.#getImageModeSettings().imageTopic != undefined) {
      return;
    }

    const imageTopic = this.renderer.topics?.find((topic) =>
      topicIsConvertibleToSchema(topic, ALL_SUPPORTED_IMAGE_SCHEMAS),
    );
    if (imageTopic == undefined) {
      return;
    }

    const matchingCalibrationTopic = this.#getMatchingCalibrationTopic(imageTopic.name);

    this.renderer.updateConfig((draft) => {
      draft.imageMode.imageTopic = imageTopic.name;
      if (matchingCalibrationTopic != undefined) {
        draft.imageMode.calibrationTopic = matchingCalibrationTopic.name;
      }
    });
    if (matchingCalibrationTopic) {
      this.#setHasCalibrationTopic(true);
    }
  };

  /** Choose a calibration topic that best matches the given `imageTopic`. */
  #getMatchingCalibrationTopic(imageTopic: string): Topic | undefined {
    const prefix = getTopicMatchPrefix(imageTopic);
    if (prefix == undefined) {
      return undefined;
    }
    return this.renderer.topics?.find(
      (topic) =>
        topicIsConvertibleToSchema(topic, ALL_SUPPORTED_CALIBRATION_SCHEMAS) &&
        topic.name.startsWith(prefix),
    );
  }

  public override settingsNodes(): SettingsTreeEntry[] {
    const handler = this.handleSettingsAction;

    const { imageTopic, calibrationTopic, synchronize, flipHorizontal, flipVertical, rotation } =
      this.#getImageModeSettings();

    const imageTopics = filterMap(this.renderer.topics ?? [], (topic) => {
      if (!topicIsConvertibleToSchema(topic, ALL_SUPPORTED_IMAGE_SCHEMAS)) {
        return;
      }
      return { label: topic.name, value: topic.name };
    });

    const calibrationTopics: { label: string; value: string | undefined }[] = filterMap(
      this.renderer.topics ?? [],
      (topic) => {
        if (!topicIsConvertibleToSchema(topic, ALL_SUPPORTED_CALIBRATION_SCHEMAS)) {
          return;
        }
        return { label: topic.name, value: topic.name };
      },
    );

    // Sort calibration topics with prefixes matching the image topic to the top.
    if (imageTopic) {
      sortPrefixMatchesToFront(calibrationTopics, imageTopic, (option) => option.label);
    }

    // add unselected camera calibration option
    calibrationTopics.unshift({ label: "None", value: undefined });

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

    if (this.#fallbackCameraModelActive()) {
      this.renderer.settings.errors.add(
        CALIBRATION_TOPIC_PATH,
        FALLBACK_CALIBRATION_ACTIVE_ALERT_KEY,
        `This mode uses a fallback camera model based on the image. 3D Topics and transforms will not be available.`,
      );
    } else {
      this.renderer.settings.errors.remove(
        CALIBRATION_TOPIC_PATH,
        FALLBACK_CALIBRATION_ACTIVE_ALERT_KEY,
      );
    }
    const imageTopicError = this.renderer.settings.errors.errors.errorAtPath(IMAGE_TOPIC_PATH);
    const calibrationTopicError =
      this.renderer.settings.errors.errors.errorAtPath(CALIBRATION_TOPIC_PATH);

    // Not yet implemented
    // const minValue: number | undefined = undefined;
    // const maxValue: number | undefined = undefined;

    const fields: SettingsTreeFields = {};
    fields.imageTopic = {
      label: "Topic",
      input: "select",
      value: imageTopic,
      options: imageTopics,
      error: imageTopicError,
    };
    fields.calibrationTopic = {
      label: "Calibration",
      input: "select",
      value: calibrationTopic,
      options: calibrationTopics,
      error: calibrationTopicError,
    };
    fields.synchronize = {
      input: "boolean",
      label: "Sync annotations",
      value: synchronize,
    };
    fields.flipHorizontal = {
      input: "boolean",
      label: "Flip horizontal",
      value: flipHorizontal,
    };
    fields.flipVertical = {
      input: "boolean",
      label: "Flip vertical",
      value: flipVertical,
    };
    fields.rotation = {
      input: "toggle",
      label: "Rotation",
      value: rotation,
      options: [
        { label: "0°", value: 0 },
        { label: "90°", value: 90 },
        { label: "180°", value: 180 },
        { label: "270°", value: 270 },
      ],
    };
    // fields.TODO_minValue = {
    //   readonly: true,
    //   input: "number",
    //   label: "🚧 Min (depth images)",
    //   placeholder: "0",
    //   value: minValue,
    // };
    // fields.TODO_maxValue = {
    //   readonly: true,
    //   input: "number",
    //   label: "🚧 Max (depth images)",
    //   placeholder: "10000",
    //   value: maxValue,
    // };
    return [
      {
        path: ["imageMode"],
        node: {
          label: "General",
          defaultExpansionState: "expanded",
          handler,
          fields,
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
      const prevImageModeConfig = this.#getImageModeSettings();
      this.saveSetting(path, value);
      const config = this.#getImageModeSettings();
      const calibrationTopicChanged =
        config.calibrationTopic !== prevImageModeConfig.calibrationTopic;
      if (calibrationTopicChanged) {
        const changingToUnselectedCalibration = config.calibrationTopic == undefined;
        if (changingToUnselectedCalibration) {
          this.#setHasCalibrationTopic(false);
        }

        const changingFromUnselectedCalibration = prevImageModeConfig.calibrationTopic == undefined;
        if (changingFromUnselectedCalibration) {
          this.#setHasCalibrationTopic(true);
        }
      }
      const imageTopicChanged = config.imageTopic !== prevImageModeConfig.imageTopic;
      if (imageTopicChanged && config.imageTopic != undefined) {
        const calibrationTopic = this.#getMatchingCalibrationTopic(config.imageTopic);
        if (calibrationTopic) {
          this.renderer.updateConfig((draft) => {
            draft.imageMode.calibrationTopic = calibrationTopic.name;
          });
          this.#setHasCalibrationTopic(true);
        }
      }

      if (config.rotation !== prevImageModeConfig.rotation) {
        this.#imageRenderable?.setRotation(config.rotation);
        this.#camera.setRotation(config.rotation);
      }

      if (config.flipHorizontal !== prevImageModeConfig.flipHorizontal) {
        this.#imageRenderable?.setFlipHorizontal(config.flipHorizontal);
        this.#camera.setFlipHorizontal(config.flipHorizontal);
      }

      if (config.flipVertical !== prevImageModeConfig.flipVertical) {
        this.#imageRenderable?.setFlipVertical(config.flipVertical);
        this.#camera.setFlipVertical(config.flipVertical);
      }
      if (config.synchronize !== prevImageModeConfig.synchronize) {
        this.removeAllRenderables();
      }
      this.#messageHandler.setConfig(config);

      this.#updateViewAndRenderables();
    } else {
      return;
    }

    // Update the settings sidebar
    this.updateSettingsTree();
  };

  #cameraInfoShouldSubscribe = (topic: string): boolean => {
    return this.#getImageModeSettings().calibrationTopic === topic;
  };

  #imageShouldSubscribe = (topic: string): boolean => {
    return this.#getImageModeSettings().imageTopic === topic;
  };

  #updateFromMessageState = (
    newState: MessageRenderState,
    oldState: MessageRenderState | undefined,
  ): void => {
    if (newState.image != undefined && newState.image !== oldState?.image) {
      this.#handleImageChange(newState.image, newState.image.message);
    }
    if (newState.cameraInfo != undefined && newState.cameraInfo !== oldState?.cameraInfo) {
      this.#handleCameraInfoChange(newState.cameraInfo);
    }
  };

  /** Processes camera info messages and updates state */
  #handleCameraInfoChange = (cameraInfo: CameraInfo): void => {
    // Store the last camera info on each topic, when processing an image message we'll look up
    // the camera info by the info topic configured for the image
    this.#updateCameraModel(cameraInfo);
    this.#updateViewAndRenderables();
  };

  #handleImageChange = (messageEvent: PartialMessageEvent<AnyImage>, image: AnyImage): void => {
    const topic = messageEvent.topic;
    const receiveTime = toNanoSec(messageEvent.receiveTime);
    const frameId = "header" in image ? image.header.frame_id : image.frame_id;

    const renderable = this.#getImageRenderable(topic, receiveTime, image, frameId);

    this.#latestImage = { topic: messageEvent.topic, image };

    if (this.#cameraModel) {
      renderable.userData.cameraInfo = this.#cameraModel.info;
      renderable.setCameraModel(this.#cameraModel.model);
    }

    renderable.name = topic;
    renderable.setImage(image);
    const isCompressedImage = "format" in image;

    if (!isCompressedImage) {
      // Raw Images don't need to be decoded asynchronously
      if (this.#fallbackCameraModelActive()) {
        this.#updateFallbackCameraModel(image, getFrameIdFromImage(image));
      }
      renderable.update();
      return;
    }

    const resizeBitmapWidth = !this.#fallbackCameraModelActive() ? DEFAULT_IMAGE_WIDTH : undefined;
    decodeCompressedImageToBitmap(image, resizeBitmapWidth)
      .then((maybeBitmap) => {
        const prevRenderable = renderable;
        const currentRenderable = this.#imageRenderable;
        // prevent setting and updating disposed renderables
        if (currentRenderable !== prevRenderable) {
          return;
        }
        this.renderer.settings.errors.removeFromTopic(topic, CREATE_BITMAP_ERR_KEY);
        renderable.setBitmap(maybeBitmap);
        if (this.#fallbackCameraModelActive()) {
          this.#updateFallbackCameraModel(maybeBitmap, getFrameIdFromImage(image));
        }

        renderable.update();
        this.renderer.queueAnimationFrame();
      })
      .catch((err) => {
        const prevRenderable = renderable;
        const currentRenderable = this.#imageRenderable;
        if (currentRenderable !== prevRenderable) {
          return;
        }
        this.renderer.settings.errors.addToTopic(
          topic,
          CREATE_BITMAP_ERR_KEY,
          `Error creating bitmap: ${err.message}`,
        );
      });
  };

  #updateFallbackCameraModel = (
    image: { width: number; height: number },
    frameId: string,
  ): void => {
    const cameraInfo = createFallbackCameraInfoForImage({
      frameId,
      height: image.height,
      width: image.width,
      focalLength: DEFAULT_FOCAL_LENGTH,
    });
    this.#updateCameraModel(cameraInfo);
    this.#updateViewAndRenderables();
  };

  #fallbackCameraModelActive = (): boolean => {
    return this.#getImageModeSettings().calibrationTopic == undefined;
  };

  #clearCameraModel = (): void => {
    this.#cameraModel = undefined;
    this.#camera.updateCamera(undefined);
    this.#camera.updateProjectionMatrix();
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

    const config = this.#getImageModeSettings();
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
      rotation: config.rotation,
      flipHorizontal: config.flipHorizontal,
      flipVertical: config.flipVertical,
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
  #getCurrentFrameId(): string | undefined {
    const { imageMode } = this.renderer.config;
    const { calibrationTopic, imageTopic } = imageMode;

    if (calibrationTopic == undefined && imageTopic == undefined) {
      return undefined;
    }

    const selectedCameraInfo = this.#cameraModel?.info;
    const selectedImage = this.#imageRenderable?.userData.image;

    const cameraInfoFrameId = selectedCameraInfo?.header.frame_id;

    const imageFrameId = selectedImage && getFrameIdFromImage(selectedImage);

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

    return cameraInfoFrameId ?? imageFrameId;
  }

  #getImageModeSettings(): Immutable<ConfigWithDefaults> {
    const config = { ...this.renderer.config.imageMode };
    config.synchronize ??= DEFAULT_CONFIG.synchronize;
    config.rotation ??= DEFAULT_CONFIG.rotation;
    config.flipHorizontal ??= DEFAULT_CONFIG.flipHorizontal;
    config.flipVertical ??= DEFAULT_CONFIG.flipVertical;

    return config as ConfigWithDefaults;
  }

  /**
   * Updates renderable, frame, and camera to be in sync with current camera model
   */
  #updateViewAndRenderables(): void {
    const cameraInfo = this.#cameraModel?.info;
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
    this.renderer.setFollowFrameId(this.#getCurrentFrameId());
    if (this.#cameraModel?.model) {
      this.#camera.updateCamera(this.#cameraModel.model);
      this.#updateAnnotationsScale();
      const imageRenderable = this.#imageRenderable;
      if (imageRenderable) {
        imageRenderable.userData.cameraInfo = this.#cameraModel.info;
        imageRenderable.setCameraModel(this.#cameraModel.model);
        imageRenderable.update();
      }
    }
  }

  /**
   * update this.cameraModel with a new model if the camera info has changed
   */
  #updateCameraModel(newCameraInfo: CameraInfo) {
    // If the camera info has not changed, we don't need to make a new model and can return the existing one
    const currentCameraInfo = this.#cameraModel?.info;
    const dataEqual = cameraInfosEqual(currentCameraInfo, newCameraInfo);
    if (dataEqual && currentCameraInfo != undefined) {
      return;
    }

    const model = this.#getPinholeCameraModel(newCameraInfo);
    if (model) {
      this.#cameraModel = {
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
  #getPinholeCameraModel(cameraInfo: CameraInfo): PinholeCameraModel | undefined {
    let model = undefined;
    try {
      model = new PinholeCameraModel(cameraInfo);
      this.renderer.settings.errors.remove(CALIBRATION_TOPIC_PATH, CAMERA_MODEL);
    } catch (errUnk) {
      this.#cameraModel = undefined;
      const err = errUnk as Error;
      this.renderer.settings.errors.add(CALIBRATION_TOPIC_PATH, CAMERA_MODEL, err.message);
    }
    return model;
  }

  public getActiveCamera(): THREE.PerspectiveCamera | THREE.OrthographicCamera {
    return this.#camera;
  }

  public handleResize(width: number, height: number, _pixelRatio: number): void {
    this.#camera.setCanvasSize(width, height);
    this.#updateAnnotationsScale();
  }

  #updateAnnotationsScale(): void {
    this.#annotations.updateScale(
      this.#camera.getEffectiveScale(),
      this.renderer.input.canvasSize.width,
      this.renderer.input.canvasSize.height,
      this.renderer.getPixelRatio(),
    );
  }

  public setCameraState(): void {
    this.#updateViewAndRenderables();
  }

  public getCameraState(): undefined {
    return undefined;
  }

  #handleErrorChange = (): void => {
    this.updateSettingsTree();
  };

  public getLatestImage(): DownloadImageInfo | undefined {
    if (!this.#latestImage) {
      return undefined;
    }
    const settings = this.#getImageModeSettings();
    return {
      ...this.#latestImage,
      rotation: settings.rotation,
      flipHorizontal: settings.flipHorizontal,
      flipVertical: settings.flipVertical,
    };
  }
}

const createFallbackCameraInfoForImage = (options: {
  // should be over ~50 for a fallback at least, otherwise warping can occur in the center
  focalLength: number;
  frameId: string;
  width: number;
  height: number;
}): CameraInfo => {
  const { width, height, focalLength, frameId } = options;
  const cx = width / 2;
  const cy = height / 2;
  const fx = focalLength;
  const fy = focalLength;
  const cameraInfo = normalizeCameraInfo({
    header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: frameId },
    height,
    width,
    distortion_model: "",
    R: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    D: [],
    // prettier-ignore
    K: [
      fx, 0, cx,
      0, fy, cy,
      0, 0, 1,
    ],
    // prettier-ignore
    P: [
      fx, 0, cx, 0,
      0, fy, cy, 0,
      0, 0, 1, 0,
    ],
  });
  return cameraInfo;
};
