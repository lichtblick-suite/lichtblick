// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as _ from "lodash-es";
import * as THREE from "three";
import { Writable } from "ts-essentials";

import { filterMap } from "@foxglove/den/collection";
import { PinholeCameraModel } from "@foxglove/den/image";
import Logger from "@foxglove/log";
import { toNanoSec } from "@foxglove/rostime";
import {
  Immutable,
  MessageEvent,
  SettingsTreeAction,
  SettingsTreeFields,
  Topic,
} from "@foxglove/studio";
import { PanelContextMenuItem } from "@foxglove/studio-base/components/PanelContextMenu";
import { DraggedMessagePath } from "@foxglove/studio-base/components/PanelExtensionAdapter";
import { Path } from "@foxglove/studio-base/panels/ThreeDeeRender/LayerErrors";
import { IMAGE_TOPIC_PATH } from "@foxglove/studio-base/panels/ThreeDeeRender/renderables/ImageMode/constants";
import {
  IMAGE_RENDERABLE_DEFAULT_SETTINGS,
  ImageRenderable,
  ImageRenderableSettings,
  ImageUserData,
} from "@foxglove/studio-base/panels/ThreeDeeRender/renderables/Images/ImageRenderable";
import {
  AnyImage,
  getFrameIdFromImage,
} from "@foxglove/studio-base/panels/ThreeDeeRender/renderables/Images/ImageTypes";
import { IMAGE_DEFAULT_COLOR_MODE_SETTINGS } from "@foxglove/studio-base/panels/ThreeDeeRender/renderables/Images/decodeImage";
import {
  cameraInfosEqual,
  normalizeCameraInfo,
} from "@foxglove/studio-base/panels/ThreeDeeRender/renderables/projections";
import { makePose } from "@foxglove/studio-base/panels/ThreeDeeRender/transforms";
import { AppEvent } from "@foxglove/studio-base/services/IAnalytics";
import { downloadFiles } from "@foxglove/studio-base/util/download";

import { ImageModeCamera } from "./ImageModeCamera";
import { IMessageHandler, MessageHandler, MessageRenderState } from "./MessageHandler";
import { ImageAnnotations } from "./annotations/ImageAnnotations";
import type {
  AnyRendererSubscription,
  IRenderer,
  ImageModeConfig,
  RendererConfig,
} from "../../IRenderer";
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
import { getTopicMatchPrefix, sortPrefixMatchesToFront } from "../Images/topicPrefixMatching";
import { colorModeSettingsFields } from "../colorMode";

const log = Logger.getLogger(__filename);

const CALIBRATION_TOPIC_PATH = ["imageMode", "calibrationTopic"];

const IMAGE_TOPIC_UNAVAILABLE = "IMAGE_TOPIC_UNAVAILABLE";
const CALIBRATION_TOPIC_UNAVAILABLE = "CALIBRATION_TOPIC_UNAVAILABLE";

const MISSING_CAMERA_INFO = "MISSING_CAMERA_INFO";
const IMAGE_TOPIC_DIFFERENT_FRAME = "IMAGE_TOPIC_DIFFERENT_FRAME";

const CAMERA_MODEL = "CameraModel";

const DEFAULT_FOCAL_LENGTH = 500;

const REMOVE_IMAGE_TIMEOUT_MS = 50;

interface ImageModeEventMap extends THREE.Object3DEventMap {
  hasModifiedViewChanged: object;
}

export const ALL_SUPPORTED_IMAGE_SCHEMAS = new Set([
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
  ...IMAGE_DEFAULT_COLOR_MODE_SETTINGS,
};

type ConfigWithDefaults = ImageModeConfig & typeof DEFAULT_CONFIG;
export class ImageMode
  extends SceneExtension<ImageRenderable, ImageModeEventMap>
  implements ICameraHandler
{
  public static extensionId = "foxglove.ImageMode";
  #camera: ImageModeCamera;
  #cameraModel:
    | {
        model: PinholeCameraModel;
        info: CameraInfo;
      }
    | undefined;

  readonly #annotations: ImageAnnotations;

  protected imageRenderable: ImageRenderable | undefined;
  #removeImageTimeout: ReturnType<typeof setTimeout> | undefined;

  protected readonly messageHandler: IMessageHandler;

  protected readonly supportedImageSchemas = ALL_SUPPORTED_IMAGE_SCHEMAS;

  #dragStartPanOffset = new THREE.Vector2();
  #dragStartMouseCoords = new THREE.Vector2();
  #hasModifiedView = false;

  public constructor(renderer: IRenderer, name: string = ImageMode.extensionId) {
    super(name, renderer);

    this.#camera = new ImageModeCamera();
    const canvasSize = renderer.input.canvasSize;

    const config = this.getImageModeSettings();

    this.#camera.setCanvasSize(canvasSize.width, canvasSize.height);
    this.#camera.setRotation(config.rotation);
    this.#camera.setFlipHorizontal(config.flipHorizontal);
    this.#camera.setFlipVertical(config.flipVertical);

    this.messageHandler = this.initMessageHandler(config);
    this.messageHandler.addListener(this.#updateFromMessageState);

    renderer.settings.errors.on("update", this.#handleErrorChange);
    renderer.settings.errors.on("clear", this.#handleErrorChange);
    renderer.settings.errors.on("remove", this.#handleErrorChange);
    this.#annotations = new ImageAnnotations({
      initialScale: this.#camera.getEffectiveScale(),
      initialCanvasWidth: canvasSize.width,
      initialCanvasHeight: canvasSize.height,
      initialPixelRatio: renderer.getPixelRatio(),
      topics: () => renderer.topics ?? [],
      config: () => this.getImageModeSettings(),
      updateConfig: (updateHandler) => {
        renderer.updateConfig((draft) => {
          updateHandler(draft.imageMode);
        });
      },
      updateSettingsTree: () => {
        this.updateSettingsTree();
      },
      labelPool: renderer.labelPool,
      messageHandler: this.messageHandler,
      addSettingsError(path: Path, errorId: string, errorMessage: string) {
        renderer.settings.errors.add(path, errorId, errorMessage);
      },
      removeSettingsError(path: Path, errorId: string) {
        renderer.settings.errors.remove(path, errorId);
      },
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

  protected initMessageHandler(config: Immutable<ConfigWithDefaults>): IMessageHandler {
    return new MessageHandler(config);
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
          handler: this.messageHandler.handleCameraInfo,
          shouldSubscribe: this.#cameraInfoShouldSubscribe,
        },
      },
      {
        type: "schema",
        schemaNames: ROS_IMAGE_DATATYPES,
        subscription: {
          handler: this.messageHandler.handleRosRawImage,
          shouldSubscribe: this.imageShouldSubscribe,
          filterQueue: this.#filterMessageQueue.bind(this),
        },
      },
      {
        type: "schema",
        schemaNames: ROS_COMPRESSED_IMAGE_DATATYPES,
        subscription: {
          handler: this.messageHandler.handleRosCompressedImage,
          shouldSubscribe: this.imageShouldSubscribe,
          filterQueue: this.#filterMessageQueue.bind(this),
        },
      },
      {
        type: "schema",
        schemaNames: RAW_IMAGE_DATATYPES,
        subscription: {
          handler: this.messageHandler.handleRawImage,
          shouldSubscribe: this.imageShouldSubscribe,
          filterQueue: this.#filterMessageQueue.bind(this),
        },
      },
      {
        type: "schema",
        schemaNames: COMPRESSED_IMAGE_DATATYPES,
        subscription: {
          handler: this.messageHandler.handleCompressedImage,
          shouldSubscribe: this.imageShouldSubscribe,
          filterQueue: this.#filterMessageQueue.bind(this),
        },
      },
    ];
    return subscriptions.concat(this.#annotations.getSubscriptions());
  }

  #filterMessageQueue<T>(msgs: MessageEvent<T>[]): MessageEvent<T>[] {
    // only take multiple images in if synchronization is enabled
    if (!this.getImageModeSettings().synchronize) {
      return msgs.slice(msgs.length - 1);
    }
    return msgs;
  }

  public override dispose(): void {
    this.renderer.settings.errors.off("update", this.#handleErrorChange);
    this.renderer.settings.errors.off("clear", this.#handleErrorChange);
    this.renderer.settings.errors.off("remove", this.#handleErrorChange);
    this.renderer.off("topicsChanged", this.#handleTopicsChanged);
    this.#annotations.dispose();
    this.imageRenderable?.dispose();
    super.dispose();
  }

  public override removeAllRenderables(): void {
    // To avoid flickering while seeking or changing subscriptions, we avoid clearing the
    // ImageRenderable for a short timeout. When a new image message arrives, we cancel the timeout,
    // so the old image will continue displaying until the new one has been decoded.
    if (this.#removeImageTimeout == undefined) {
      this.#removeImageTimeout = setTimeout(() => {
        this.#removeImageTimeout = undefined;
        this.#removeImageRenderable();
        this.renderer.queueAnimationFrame();
      }, REMOVE_IMAGE_TIMEOUT_MS);
    }
    this.#clearCameraModel();
    this.#annotations.removeAllRenderables();
    this.messageHandler.clear();
    super.removeAllRenderables();
  }

  #removeImageRenderable(): void {
    this.imageRenderable?.dispose();
    this.imageRenderable?.removeFromParent();
    this.imageRenderable = undefined;
  }

  /**
   * If no image topic is selected, automatically select the first available one from `renderer.topics`.
   * Also auto-select a new calibration topic to match the new image topic.
   */
  #handleTopicsChanged = () => {
    if (this.getImageModeSettings().imageTopic != undefined) {
      return;
    }

    const imageTopic = this.renderer.topics?.find((topic) =>
      topicIsConvertibleToSchema(topic, this.supportedImageSchemas),
    );
    if (imageTopic == undefined) {
      return;
    }

    this.setImageTopic(imageTopic);
  };

  /** Sets specified image topic on the config and updates calibration topic if a match is found.
   *  Does not check that image topic is different
   **/
  protected setImageTopic(imageTopic: Topic): void {
    const matchingCalibrationTopic = this.#getMatchingCalibrationTopic(imageTopic.name);
    // don't want renderables shared across topics to ensure clean state for new topic
    this.#removeImageRenderable();

    this.renderer.updateConfig((draft) => {
      draft.imageMode.imageTopic = imageTopic.name;
      if (matchingCalibrationTopic != undefined) {
        if (draft.imageMode.calibrationTopic !== matchingCalibrationTopic.name) {
          this.#clearCameraModel();
        }
        draft.imageMode.calibrationTopic = matchingCalibrationTopic.name;
      }
    });
    if (matchingCalibrationTopic) {
      this.renderer.disableImageOnlySubscriptionMode();
    }
  }

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

    const settings = this.getImageModeSettings();

    const { imageTopic, calibrationTopic, synchronize, flipHorizontal, flipVertical, rotation } =
      settings;

    const imageTopics = filterMap(this.renderer.topics ?? [], (topic) => {
      if (!topicIsConvertibleToSchema(topic, this.supportedImageSchemas)) {
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

    const imageTopicError = this.renderer.settings.errors.errors.errorAtPath(IMAGE_TOPIC_PATH);
    const calibrationTopicError =
      this.renderer.settings.errors.errors.errorAtPath(CALIBRATION_TOPIC_PATH);

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

    const colorModeFields = colorModeSettingsFields({
      config: settings as ImageModeConfig,

      defaults: {
        gradient: DEFAULT_CONFIG.gradient,
      },
      modifiers: {
        supportsPackedRgbModes: false,
        supportsRgbaFieldsMode: false,
        hideFlatColor: true,
        hideExplicitAlpha: true,
      },
    });

    Object.assign(fields, colorModeFields);

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
      const prevImageModeConfig = this.getImageModeSettings();
      this.saveSetting(path, value);
      const config = this.getImageModeSettings();
      const calibrationTopicChanged =
        config.calibrationTopic !== prevImageModeConfig.calibrationTopic;
      if (calibrationTopicChanged) {
        const changingToUnselectedCalibration = config.calibrationTopic == undefined;
        if (changingToUnselectedCalibration) {
          this.renderer.enableImageOnlySubscriptionMode();
        }

        const changingFromUnselectedCalibration = prevImageModeConfig.calibrationTopic == undefined;
        if (changingFromUnselectedCalibration) {
          this.renderer.disableImageOnlySubscriptionMode();
        }
      }
      const imageTopicChanged = config.imageTopic !== prevImageModeConfig.imageTopic;
      if (imageTopicChanged && config.imageTopic != undefined) {
        const imageTopic = this.renderer.topics?.find((topic) => topic.name === config.imageTopic);
        if (imageTopic) {
          this.setImageTopic(imageTopic);
        }
      }

      if (config.rotation !== prevImageModeConfig.rotation) {
        this.#camera.setRotation(config.rotation);
      }
      if (config.flipHorizontal !== prevImageModeConfig.flipHorizontal) {
        this.#camera.setFlipHorizontal(config.flipHorizontal);
      }
      if (config.flipVertical !== prevImageModeConfig.flipVertical) {
        this.#camera.setFlipVertical(config.flipVertical);
      }
      this.imageRenderable?.setSettings({
        ...this.imageRenderable.userData.settings,
        colorMode: config.colorMode,
        flatColor: config.flatColor,
        gradient: config.gradient as [string, string],
        colorMap: config.colorMap,
        explicitAlpha: config.explicitAlpha,
        minValue: config.minValue,
        maxValue: config.maxValue,
      });
      if (config.synchronize !== prevImageModeConfig.synchronize) {
        this.removeAllRenderables();
      }
      this.messageHandler.setConfig(config);

      this.#updateViewAndRenderables();
    } else {
      return;
    }

    // Update the settings sidebar
    this.updateSettingsTree();
  };

  public override getDropEffectForPath = (
    path: DraggedMessagePath,
  ): "add" | "replace" | undefined => {
    if (!path.isTopic || path.rootSchemaName == undefined) {
      return undefined;
    }
    if (this.supportedImageSchemas.has(path.rootSchemaName)) {
      return "replace";
    } else if (this.#annotations.supportedAnnotationSchemas.has(path.rootSchemaName)) {
      return "add";
    }
    return undefined;
  };

  public override updateConfigForDropPath = (
    draft: Writable<RendererConfig>,
    path: DraggedMessagePath,
  ): void => {
    if (path.rootSchemaName == undefined) {
      return;
    }
    if (this.supportedImageSchemas.has(path.rootSchemaName)) {
      draft.imageMode.imageTopic = path.path;
    } else if (this.#annotations.supportedAnnotationSchemas.has(path.rootSchemaName)) {
      draft.imageMode.annotations ??= {};
      draft.imageMode.annotations[path.path] = { visible: true };
    }
  };

  #cameraInfoShouldSubscribe = (topic: string): boolean => {
    return this.getImageModeSettings().calibrationTopic === topic;
  };

  protected imageShouldSubscribe = (topic: string): boolean => {
    return this.getImageModeSettings().imageTopic === topic;
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

    if (this.#removeImageTimeout != undefined) {
      clearTimeout(this.#removeImageTimeout);
      this.#removeImageTimeout = undefined;
    }

    const renderable = this.#getImageRenderable(topic, receiveTime, image, frameId);

    if (this.#cameraModel) {
      renderable.userData.cameraInfo = this.#cameraModel.info;
      renderable.setCameraModel(this.#cameraModel.model);
    }

    renderable.userData.receiveTime = receiveTime;
    renderable.setImage(image, /*resizeWidth=*/ undefined, (size) => {
      if (this.#fallbackCameraModelActive()) {
        this.#updateFallbackCameraModel(size, getFrameIdFromImage(image));
      }
    });
  };

  #updateFallbackCameraModel = (size: { width: number; height: number }, frameId: string): void => {
    const cameraInfo = createFallbackCameraInfoForImage({
      frameId,
      height: size.height,
      width: size.width,
      focalLength: DEFAULT_FOCAL_LENGTH,
    });
    this.#updateCameraModel(cameraInfo);
    this.#updateViewAndRenderables();
  };

  #fallbackCameraModelActive = (): boolean => {
    // Don't use #getImageModeSettings here for performance reasons
    return this.renderer.config.imageMode.calibrationTopic == undefined;
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
    let renderable = this.imageRenderable;
    if (renderable) {
      return renderable;
    }
    const config = this.getImageModeSettings();

    const userSettings: ImageRenderableSettings = {
      ...IMAGE_RENDERABLE_DEFAULT_SETTINGS,
      colorMode: config.colorMode,
      gradient: config.gradient as [string, string],
      colorMap: config.colorMap,
      minValue: config.minValue,
      maxValue: config.maxValue,
      // planarProjectionFactor must be 1 to avoid imprecise projection due to small number of grid subdivisions
      planarProjectionFactor: 1,
    };
    renderable = this.initRenderable(topicName, {
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
    this.imageRenderable = renderable;
    renderable.setRenderBehindScene();
    renderable.visible = true;
    return renderable;
  }

  protected initRenderable(topicName: string, userData: ImageUserData): ImageRenderable {
    return new ImageRenderable(topicName, this.renderer, userData);
  }

  /** Gets frame from active info or image message if info does not have one*/
  #getCurrentFrameId(): string | undefined {
    const { imageMode } = this.renderer.config;
    const { calibrationTopic, imageTopic } = imageMode;

    if (calibrationTopic == undefined && imageTopic == undefined) {
      return undefined;
    }

    const selectedCameraInfo = this.#cameraModel?.info;
    const selectedImage = this.imageRenderable?.userData.image;

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

  protected getImageModeSettings(): Immutable<ConfigWithDefaults> {
    const config = { ...this.renderer.config.imageMode };

    const colorMode =
      config.colorMode === "rgba-fields"
        ? DEFAULT_CONFIG.colorMode
        : config.colorMode ?? DEFAULT_CONFIG.colorMode;

    // Ensures that no required fields are left undefined
    // rightmost values are applied last and have the most precedence
    return _.merge({}, DEFAULT_CONFIG, { colorMode }, config);
  }

  /**
   * Updates renderable, frame, and camera to be in sync with current camera model
   */
  #updateViewAndRenderables(): void {
    const cameraInfo = this.#cameraModel?.info;
    if (!this.#fallbackCameraModelActive() && !cameraInfo) {
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
      const imageRenderable = this.imageRenderable;
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

  #getDownloadImageCallback = (): (() => Promise<void>) => {
    return async () => {
      if (!this.imageRenderable) {
        return;
      }
      const currentImage = this.imageRenderable.getDecodedImage();
      if (!currentImage) {
        return;
      }

      const { topic, image: imageMessage } = this.imageRenderable.userData;
      if (!imageMessage) {
        return;
      }
      const settings = this.getImageModeSettings();
      const { rotation, flipHorizontal, flipVertical } = settings;
      const stamp = "header" in imageMessage ? imageMessage.header.stamp : imageMessage.timestamp;
      try {
        const width =
          rotation === 90 || rotation === 270 ? currentImage.height : currentImage.width;
        const height =
          rotation === 90 || rotation === 270 ? currentImage.width : currentImage.height;

        // re-render the image onto a new canvas to download the original image
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          throw new Error("Unable to create rendering context for image download");
        }
        // Need to transform ImageData to bitmap because ctx.putImageData does not support canvas transformations
        const bitmap =
          currentImage instanceof ImageData ? await createImageBitmap(currentImage) : currentImage;

        // Draw the image in the selected orientation so it aligns with the canvas viewport
        ctx.translate(width / 2, height / 2);
        ctx.scale(flipHorizontal ? -1 : 1, flipVertical ? -1 : 1);
        ctx.rotate((rotation / 180) * Math.PI);
        ctx.translate(-currentImage.width / 2, -currentImage.height / 2);
        ctx.drawImage(bitmap, 0, 0);

        // read the canvas data as an image (png)
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((result) => {
            if (result) {
              resolve(result);
            } else {
              reject(`Failed to create an image from ${width}x${height} canvas`);
            }
          }, "image/png");
        });
        // name the image the same name as the topic
        // note: the / characters in the file name will be replaced with _ by the browser
        // remove any leading / so the image name doesn't start with _
        const topicName = topic.replace(/^\/+/, "");
        const fileName = `${topicName}-${stamp.sec}-${stamp.nsec}`;
        void this.renderer.analytics?.logEvent(AppEvent.IMAGE_DOWNLOAD);
        if (this.renderer.testOptions.onDownloadImage) {
          this.renderer.testOptions.onDownloadImage(blob, fileName);
        } else {
          downloadFiles([{ blob, fileName }]);
        }
      } catch (error) {
        log.error(error);
        if (this.renderer.displayTemporaryError) {
          this.renderer.displayTemporaryError((error as Error).toString());
        }
      }
    };
  };

  public override getContextMenuItems(): PanelContextMenuItem[] {
    return [
      {
        type: "item",
        label: "Download image",
        onclick: this.#getDownloadImageCallback(),
        disabled: this.imageRenderable?.getDecodedImage() == undefined,
      },
    ];
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
