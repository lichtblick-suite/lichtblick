// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import EventEmitter from "eventemitter3";
import i18next from "i18next";
import { produce } from "immer";
import * as THREE from "three";
import { DeepPartial, assert } from "ts-essentials";
import { v4 as uuidv4 } from "uuid";

import Logger from "@foxglove/log";
import { Time, fromNanoSec, isLessThan, toNanoSec } from "@foxglove/rostime";
import type { FrameTransform, FrameTransforms, SceneUpdate } from "@foxglove/schemas";
import {
  DraggedMessagePath,
  Immutable,
  MessageEvent,
  MessagePathDropStatus,
  ParameterValue,
  SettingsIcon,
  SettingsTreeAction,
  SettingsTreeNodeActionItem,
  SettingsTreeNodes,
  Topic,
  VariableValue,
} from "@foxglove/studio";
import { PanelContextMenuItem } from "@foxglove/studio-base/components/PanelContextMenu";
import {
  Asset,
  BuiltinPanelExtensionContext,
} from "@foxglove/studio-base/components/PanelExtensionAdapter";
import { LayerErrors } from "@foxglove/studio-base/panels/ThreeDeeRender/LayerErrors";
import { SceneExtensionConfig } from "@foxglove/studio-base/panels/ThreeDeeRender/SceneExtensionConfig";
import { ICameraHandler } from "@foxglove/studio-base/panels/ThreeDeeRender/renderables/ICameraHandler";
import IAnalytics from "@foxglove/studio-base/services/IAnalytics";
import { dark, light } from "@foxglove/studio-base/theme/palette";
import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";
import { LabelMaterial, LabelPool } from "@foxglove/three-text";

import {
  IRenderer,
  InstancedLineMaterial,
  RendererConfig,
  RendererEvents,
  RendererSubscription,
  TestOptions,
} from "./IRenderer";
import { Input } from "./Input";
import { DEFAULT_MESH_UP_AXIS, ModelCache } from "./ModelCache";
import { PickedRenderable, Picker } from "./Picker";
import type { Renderable } from "./Renderable";
import { SceneExtension } from "./SceneExtension";
import { ScreenOverlay } from "./ScreenOverlay";
import { SettingsManager, SettingsTreeEntry } from "./SettingsManager";
import { SharedGeometry } from "./SharedGeometry";
import { CameraState } from "./camera";
import { DARK_OUTLINE, LIGHT_OUTLINE, stringToRgb } from "./color";
import { FRAME_TRANSFORMS_DATATYPES, FRAME_TRANSFORM_DATATYPES } from "./foxglove";
import { DetailLevel, msaaSamples } from "./lod";
import {
  normalizeFrameTransform,
  normalizeFrameTransforms,
  normalizeTFMessage,
  normalizeTransformStamped,
} from "./normalizeMessages";
import { CameraStateSettings } from "./renderables/CameraStateSettings";
import { ImageMode } from "./renderables/ImageMode/ImageMode";
import { MeasurementTool } from "./renderables/MeasurementTool";
import { PublishClickTool } from "./renderables/PublishClickTool";
import { MarkerPool } from "./renderables/markers/MarkerPool";
import {
  Header,
  MarkerArray,
  Quaternion,
  TFMessage,
  TF_DATATYPES,
  TRANSFORM_STAMPED_DATATYPES,
  TransformStamped,
  Vector3,
} from "./ros";
import { SelectEntry } from "./settings";
import { AddTransformResult, CoordinateFrame, Transform, TransformTree } from "./transforms";
import { InterfaceMode } from "./types";

const log = Logger.getLogger(__filename);

/** Menu item entry and callback for the "Custom Layers" menu */
export type CustomLayerAction = {
  action: SettingsTreeNodeActionItem;
  handler: (instanceId: string) => void;
};

// Maximum number of objects to present as selection options in a single click
const MAX_SELECTIONS = 10;

// NOTE: These do not use .convertSRGBToLinear() since background color is not
// affected by gamma correction
const LIGHT_BACKDROP = new THREE.Color(light.background?.default);
const DARK_BACKDROP = new THREE.Color(dark.background?.default);

// Define rendering layers for multipass rendering used for the selection effect
const LAYER_DEFAULT = 0;
const LAYER_SELECTED = 1;

const FOLLOW_TF_PATH = ["general", "followTf"];
const NO_FRAME_SELECTED = "NO_FRAME_SELECTED";
const TF_OVERFLOW = "TF_OVERFLOW";
const CYCLE_DETECTED = "CYCLE_DETECTED";
const FOLLOW_FRAME_NOT_FOUND = "FOLLOW_FRAME_NOT_FOUND";

// An extensionId for creating the top-level settings nodes such as "Topics" and
// "Custom Layers"
const RENDERER_ID = "foxglove.Renderer";

const tempColor = new THREE.Color();
const tempVec2 = new THREE.Vector2();

// We use a patched version of THREE.js where the internal WebGLShaderCache class has been
// modified to allow caching based on `vertexShaderKey` and/or `fragmentShaderKey` instead of
// using the full shader source as a Map key
Object.defineProperty(LabelMaterial.prototype, "vertexShaderKey", {
  get() {
    return "LabelMaterial-VertexShader";
  },
  enumerable: true,
  configurable: true,
});
Object.defineProperty(LabelMaterial.prototype, "fragmentShaderKey", {
  get() {
    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    return this.picking ? "LabelMaterial-FragmentShader-picking" : "LabelMaterial-FragmentShader";
  },
  enumerable: true,
  configurable: true,
});

/**
 * An extensible 3D renderer attached to a `HTMLCanvasElement`,
 * `WebGLRenderingContext`, and `SettingsTree`.
 */
export class Renderer extends EventEmitter<RendererEvents> implements IRenderer {
  public readonly interfaceMode: InterfaceMode;
  #canvas: HTMLCanvasElement;
  public readonly gl: THREE.WebGLRenderer;
  public maxLod = DetailLevel.High;

  public debugPicking: boolean;
  public config: Immutable<RendererConfig>;
  public settings: SettingsManager;
  // [{ name, datatype }]
  public topics: ReadonlyArray<Topic> | undefined;
  // topicName -> { name, datatype }
  public topicsByName: ReadonlyMap<string, Topic> | undefined;
  // parameterKey -> parameterValue
  public parameters: ReadonlyMap<string, ParameterValue> | undefined;
  // variableName -> variableValue
  public variables: ReadonlyMap<string, VariableValue> = new Map();
  // extensionId -> SceneExtension
  public sceneExtensions = new Map<string, SceneExtension>();
  // datatype -> RendererSubscription[]
  public schemaHandlers = new Map<string, RendererSubscription[]>();
  // topicName -> RendererSubscription[]
  public topicHandlers = new Map<string, RendererSubscription[]>();
  // layerId -> { action, handler }
  #customLayerActions = new Map<string, CustomLayerAction>();
  #scene: THREE.Scene;
  #dirLight: THREE.DirectionalLight;
  #hemiLight: THREE.HemisphereLight;
  public input: Input;
  public readonly outlineMaterial = new THREE.LineBasicMaterial({ dithering: true });
  public readonly instancedOutlineMaterial = new InstancedLineMaterial({ dithering: true });

  /** only public for testing - prefer to use `getCameraState` instead */
  public cameraHandler: ICameraHandler;

  #imageModeExtension?: ImageMode;

  public measurementTool: MeasurementTool;
  public publishClickTool: PublishClickTool;

  // Are we connected to a ROS data source? Normalize coordinate frames if so by
  // stripping any leading "/" prefix. See `normalizeFrameId()` for details.
  public ros = false;

  #picker: Picker;
  #selectionBackdropScene: THREE.Scene;
  #selectionBackdrop: ScreenOverlay;
  #selectedRenderable: PickedRenderable | undefined;
  public colorScheme: "dark" | "light" = "light";
  public modelCache: ModelCache;
  public transformTree = new TransformTree();
  public coordinateFrameList: SelectEntry[] = [];
  public currentTime = 0n;
  public fixedFrameId: string | undefined;
  public followFrameId: string | undefined;

  public labelPool = new LabelPool({ fontFamily: fonts.MONOSPACE });
  public markerPool = new MarkerPool(this);
  public sharedGeometry = new SharedGeometry();

  #prevResolution = new THREE.Vector2();
  #pickingEnabled = false;
  #rendering = false;
  #animationFrame?: number;
  #cameraSyncError: undefined | string;
  #devicePixelRatioMediaQuery?: MediaQueryList;
  #fetchAsset: BuiltinPanelExtensionContext["unstable_fetchAsset"];

  public readonly displayTemporaryError?: (str: string) => void;
  /** Options passed for local testing and storybook. */
  public readonly testOptions: TestOptions;
  public analytics?: IAnalytics;

  public constructor(args: {
    canvas: HTMLCanvasElement;
    config: Immutable<RendererConfig>;
    interfaceMode: InterfaceMode;
    fetchAsset: BuiltinPanelExtensionContext["unstable_fetchAsset"];
    displayTemporaryError?: (message: string) => void;
    testOptions: TestOptions;
    sceneExtensionConfig: SceneExtensionConfig;
  }) {
    super();
    this.displayTemporaryError = args.displayTemporaryError;
    // NOTE: Global side effect
    THREE.Object3D.DEFAULT_UP = new THREE.Vector3(0, 0, 1);

    const interfaceMode = (this.interfaceMode = args.interfaceMode);
    const canvas = (this.#canvas = args.canvas);
    const config = (this.config = args.config);
    this.#fetchAsset = args.fetchAsset;
    this.testOptions = args.testOptions;
    this.debugPicking = args.testOptions.debugPicking ?? false;

    this.settings = new SettingsManager(baseSettingsTree(this.interfaceMode));
    this.settings.on("update", () => this.emit("settingsTreeChange", this));
    // Add the top-level nodes first so merging happens in the correct order.
    // Another approach would be to modify SettingsManager to allow merging parent
    // nodes in after their children
    this.settings.setNodesForKey(RENDERER_ID, []);
    this.updateCustomLayersCount();

    this.gl = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
    if (!this.gl.capabilities.isWebGL2) {
      throw new Error("WebGL2 is not supported");
    }
    this.gl.toneMapping = THREE.NoToneMapping;
    this.gl.autoClear = false;
    this.gl.info.autoReset = false;
    this.gl.shadowMap.enabled = false;
    this.gl.shadowMap.type = THREE.VSMShadowMap;
    this.gl.sortObjects = true;
    this.gl.setPixelRatio(window.devicePixelRatio);

    let width = canvas.width;
    let height = canvas.height;
    if (canvas.parentElement) {
      width = canvas.parentElement.clientWidth;
      height = canvas.parentElement.clientHeight;
      this.gl.setSize(width, height);
    }

    this.modelCache = new ModelCache({
      ignoreColladaUpAxis: config.scene.ignoreColladaUpAxis ?? false,
      meshUpAxis: config.scene.meshUpAxis ?? DEFAULT_MESH_UP_AXIS,
      edgeMaterial: this.outlineMaterial,
      fetchAsset: this.#fetchAsset,
    });

    this.#scene = new THREE.Scene();

    this.#dirLight = new THREE.DirectionalLight(0xffffff, Math.PI);
    this.#dirLight.position.set(1, 1, 1);
    this.#dirLight.castShadow = true;
    this.#dirLight.layers.enableAll();

    this.#dirLight.shadow.mapSize.width = 2048;
    this.#dirLight.shadow.mapSize.height = 2048;
    this.#dirLight.shadow.camera.near = 0.5;
    this.#dirLight.shadow.camera.far = 500;
    this.#dirLight.shadow.bias = -0.00001;

    this.#hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.5 * Math.PI);
    this.#hemiLight.layers.enableAll();

    this.#scene.add(this.#dirLight);
    this.#scene.add(this.#hemiLight);

    this.input = new Input(canvas, () => this.cameraHandler.getActiveCamera());
    this.input.on("resize", (size) => {
      this.#resizeHandler(size);
    });
    this.input.on("click", (cursorCoords) => {
      this.#clickHandler(cursorCoords);
    });

    this.#picker = new Picker(this.gl, this.#scene);

    this.#selectionBackdrop = new ScreenOverlay(this);
    this.#selectionBackdropScene = new THREE.Scene();
    this.#selectionBackdropScene.add(this.#selectionBackdrop);

    const samples = msaaSamples(this.gl.capabilities);
    const renderSize = this.gl.getDrawingBufferSize(tempVec2);
    log.debug(`Initialized ${renderSize.width}x${renderSize.height} renderer (${samples}x MSAA)`);

    const { reserved } = args.sceneExtensionConfig;

    this.measurementTool = reserved.measurementTool.init(this);
    this.publishClickTool = reserved.publishClickTool.init(this);
    this.#addSceneExtension(this.measurementTool);
    this.#addSceneExtension(this.publishClickTool);

    const aspect = renderSize.width / renderSize.height;
    switch (interfaceMode) {
      case "image": {
        const imageMode = reserved.imageMode.init(this);
        this.#imageModeExtension = imageMode;
        this.cameraHandler = this.#imageModeExtension;
        this.#imageModeExtension.addEventListener("hasModifiedViewChanged", () => {
          this.emit("resetViewChanged", this);
        });
        this.#addSceneExtension(this.#imageModeExtension);
        break;
      }
      case "3d": {
        this.cameraHandler = new CameraStateSettings(this, this.#canvas, aspect);
        this.#addSceneExtension(this.cameraHandler);
        break;
      }
    }

    const { extensionsById } = args.sceneExtensionConfig;
    for (const extensionItem of Object.values(extensionsById)) {
      if (
        extensionItem.supportedInterfaceModes == undefined ||
        extensionItem.supportedInterfaceModes.includes(interfaceMode)
      ) {
        this.#addSceneExtension(extensionItem.init(this));
      }
    }

    log.debug(
      `Renderer initialized with scene extensions ${Array.from(this.sceneExtensions.keys()).join(
        ", ",
      )}`,
    );

    if (interfaceMode === "image" && config.imageMode.calibrationTopic == undefined) {
      this.enableImageOnlySubscriptionMode();
    } else {
      this.#addTransformSubscriptions();
      this.#addSubscriptionsFromSceneExtensions();
    }

    this.#watchDevicePixelRatio();

    this.setCameraState(config.cameraState);
    this.animationFrame();
  }

  #onDevicePixelRatioChange = () => {
    log.debug(`devicePixelRatio changed to ${window.devicePixelRatio}`);
    this.#resizeHandler(this.input.canvasSize);
    this.#watchDevicePixelRatio();
  };

  #watchDevicePixelRatio() {
    this.#devicePixelRatioMediaQuery = window.matchMedia(
      `(resolution: ${window.devicePixelRatio}dppx)`,
    );
    this.#devicePixelRatioMediaQuery.addEventListener("change", this.#onDevicePixelRatioChange, {
      once: true,
    });
  }

  public dispose(): void {
    log.warn(`Disposing renderer`);
    this.#devicePixelRatioMediaQuery?.removeEventListener("change", this.#onDevicePixelRatioChange);
    this.removeAllListeners();

    this.settings.removeAllListeners();
    this.input.removeAllListeners();

    for (const extension of this.sceneExtensions.values()) {
      extension.dispose();
    }
    this.sceneExtensions.clear();
    this.sharedGeometry.dispose();
    this.modelCache.dispose();

    this.labelPool.dispose();
    this.markerPool.dispose();
    this.#picker.dispose();
    this.input.dispose();
    this.gl.dispose();
  }

  public cameraSyncError(): undefined | string {
    return this.#cameraSyncError;
  }

  public setCameraSyncError(error: undefined | string): void {
    this.#cameraSyncError = error;
    // Updates the settings tree for camera state settings to account for any changes in the config.
    this.cameraHandler.updateSettingsTree();
  }

  public getPixelRatio(): number {
    return this.gl.getPixelRatio();
  }

  /**
   *
   * @param currentTime what renderer.currentTime will be set to
   */
  public setCurrentTime(newTimeNs: bigint): void {
    this.currentTime = newTimeNs;
  }
  /**
   * Updates renderer state according to seek delta. Handles clearing of future state and resetting of allFrames cursor if seeked backwards
   * Should be called after `setCurrentTime` as been called
   * @param oldTime used to determine if seeked backwards
   */
  public handleSeek(oldTimeNs: bigint): void {
    const movedBack = this.currentTime < oldTimeNs;
    // want to clear transforms and reset the cursor if we seek backwards
    this.clear({ clearTransforms: movedBack, resetAllFramesCursor: movedBack });
  }

  /**
   * Clears:
   *  - Rendered objects (a backfill is performed to ensure that they are regenerated with new messages from current frame)
   *  - Errors in settings. Messages that caused errors in the past are cleared, but will be re-added if they are still causing errors when read in.
   *  - [Optional] Transform tree. This should be set to true when a seek to a previous time is performed in order to flush potential future state to the newly set time.
   *  - [Optional] allFramesCursor. This is the cursor that iterates through allFrames up to currentTime. It should be reset when seeking backwards to avoid keeping future state.
   * @param {Object} params - modifiers to the clear operation
   * @param {boolean} params.clearTransforms - whether to clear the transform tree. This should be set to true when a seek to a previous time is performed in order
   * order to flush potential future state to the newly set time.
   * @param {boolean} params.resetAllFramesCursor - whether to reset the cursor for the allFrames array.
   */
  public clear(
    {
      clearTransforms,
      resetAllFramesCursor,
    }: { clearTransforms?: boolean; resetAllFramesCursor?: boolean } = {
      clearTransforms: false,
      resetAllFramesCursor: false,
    },
  ): void {
    if (clearTransforms === true) {
      this.#clearTransformTree();
    }
    if (resetAllFramesCursor === true) {
      this.#resetAllFramesCursor();
    }
    this.settings.errors.clear();

    for (const extension of this.sceneExtensions.values()) {
      extension.removeAllRenderables();
    }
    this.queueAnimationFrame();
  }

  #allFramesCursor: {
    // index represents where the last read message is in allFrames
    index: number;
    lastReadMessage: MessageEvent | undefined;
    cursorTimeReached?: Time;
  } = {
    index: -1,
    lastReadMessage: undefined,
    cursorTimeReached: undefined,
  };

  #resetAllFramesCursor() {
    this.#allFramesCursor = {
      index: -1,
      lastReadMessage: undefined,
      cursorTimeReached: undefined,
    };
    this.emit("resetAllFramesCursor", this);
  }

  /**
   * Iterates through allFrames and handles messages with a receiveTime <= currentTime
   * @param allFrames - sorted array of all preloaded messages
   * @returns {boolean} - whether the allFramesCursor has been updated and new messages were read in
   */
  public handleAllFramesMessages(allFrames?: readonly MessageEvent[]): boolean {
    if (!allFrames || allFrames.length === 0) {
      return false;
    }

    const currentTime = fromNanoSec(this.currentTime);

    /**
     * Assumptions about allFrames needed by allFramesCursor:
     *  - always sorted by receiveTime
     *  - allFrame chunks are only ever loaded from beginning to end and does not have any eviction
     */

    const messageAtCursor = allFrames[this.#allFramesCursor.index];

    // reset cursor if lastReadMessage no longer is the same as the message at the cursor
    // This means that messages were added or removed from the array and need to be re-read
    if (
      this.#allFramesCursor.lastReadMessage != undefined &&
      messageAtCursor != undefined &&
      this.#allFramesCursor.lastReadMessage !== messageAtCursor
    ) {
      this.#resetAllFramesCursor();
    }

    let cursor = this.#allFramesCursor.index;
    let cursorTimeReached = this.#allFramesCursor.cursorTimeReached;
    let lastReadMessage = this.#allFramesCursor.lastReadMessage;

    // cursor should never be over allFramesLength, if it some how is, it means the cursor was at the end of `allFrames` prior to eviction and eviction shortened allframes
    // in this case we should set the cursor to the end of allFrames
    cursor = Math.min(cursor, allFrames.length - 1);

    let message;

    let hasAddedMessageEvents = false;
    // load preloaded messages up to current time
    while (cursor < allFrames.length - 1) {
      cursor++;
      message = allFrames[cursor]!;
      // read messages until we reach the current time
      if (isLessThan(currentTime, message.receiveTime)) {
        cursorTimeReached = currentTime;
        // reset cursor to last read message index
        cursor--;
        break;
      }
      if (!hasAddedMessageEvents) {
        hasAddedMessageEvents = true;
      }

      this.addMessageEvent(message);
      lastReadMessage = message;
      if (cursor === allFrames.length - 1) {
        cursorTimeReached = message.receiveTime;
      }
    }

    // want to avoid setting anything if nothing has changed
    if (!hasAddedMessageEvents) {
      return false;
    }

    this.#allFramesCursor = { index: cursor, cursorTimeReached, lastReadMessage };
    return true;
  }

  #addSceneExtension(extension: SceneExtension): void {
    if (this.sceneExtensions.has(extension.extensionId)) {
      throw new Error(`Attempted to add duplicate extensionId "${extension.extensionId}"`);
    }
    this.sceneExtensions.set(extension.extensionId, extension);
    this.#scene.add(extension);
  }

  public updateConfig(updateHandler: (draft: RendererConfig) => void): void {
    this.config = produce(this.config, updateHandler);
    this.emit("configChange", this);
  }

  #addTransformSubscriptions(): void {
    const config = this.config;
    const preloadTransforms = config.scene.transforms?.enablePreloading ?? true;
    // Internal handlers for TF messages to update the transform tree
    this.#addSchemaSubscriptions(FRAME_TRANSFORM_DATATYPES, {
      handler: this.#handleFrameTransform,
      shouldSubscribe: () => true,
      preload: preloadTransforms,
    });
    this.#addSchemaSubscriptions(FRAME_TRANSFORMS_DATATYPES, {
      handler: this.#handleFrameTransforms,
      shouldSubscribe: () => true,
      preload: preloadTransforms,
    });
    this.#addSchemaSubscriptions(TF_DATATYPES, {
      handler: this.#handleTFMessage,
      shouldSubscribe: () => true,
      preload: preloadTransforms,
    });
    this.#addSchemaSubscriptions(TRANSFORM_STAMPED_DATATYPES, {
      handler: this.#handleTransformStamped,
      shouldSubscribe: () => true,
      preload: preloadTransforms,
    });
    this.off("resetAllFramesCursor", this.#clearTransformTree);
    if (preloadTransforms) {
      this.on("resetAllFramesCursor", this.#clearTransformTree);
    }
  }

  #clearTransformTree = () => {
    this.transformTree.clear();
  };

  // Call on scene extensions to add subscriptions to the renderer
  #addSubscriptionsFromSceneExtensions(filterFn?: (extension: SceneExtension) => boolean): void {
    const filteredExtensions = filterFn
      ? Array.from(this.sceneExtensions.values()).filter(filterFn)
      : this.sceneExtensions.values();
    for (const extension of filteredExtensions) {
      const subscriptions = extension.getSubscriptions();
      for (const subscription of subscriptions) {
        switch (subscription.type) {
          case "schema":
            this.#addSchemaSubscriptions(subscription.schemaNames, subscription.subscription);
            break;
          case "topic":
            this.#addTopicSubscription(subscription.topicName, subscription.subscription);
            break;
        }
      }
    }
  }

  // Clear topic and schema subscriptions and emit change events for both
  #clearSubscriptions(): void {
    this.topicHandlers.clear();
    this.schemaHandlers.clear();
    this.emit("topicHandlersChanged", this);
    this.emit("schemaHandlersChanged", this);
  }

  #addSchemaSubscriptions<T>(
    schemaNames: Iterable<string>,
    subscription: RendererSubscription<T>,
  ): void {
    for (const schemaName of schemaNames) {
      let handlers = this.schemaHandlers.get(schemaName);
      if (!handlers) {
        handlers = [];
        this.schemaHandlers.set(schemaName, handlers);
      }
      handlers.push(subscription as RendererSubscription);
    }
    this.emit("schemaHandlersChanged", this);
  }

  #addTopicSubscription<T>(topic: string, subscription: RendererSubscription<T>): void {
    let handlers = this.topicHandlers.get(topic);
    if (!handlers) {
      handlers = [];
      this.topicHandlers.set(topic, handlers);
    }
    handlers.push(subscription as RendererSubscription);
    this.emit("topicHandlersChanged", this);
  }

  /**
   * Image Only mode disables all subscriptions for non-ImageMode scene extensions and clears all transform subscriptions.
   * This mode should only be enabled in ImageMode when there is no calibration topic selected. Disabling these subscriptions
   * prevents the 3D aspects of the scene from being rendered from an insufficient camera info.
   */
  public enableImageOnlySubscriptionMode = (): void => {
    assert(
      this.#imageModeExtension,
      "Image mode extension should be defined when calling enable Image only mode",
    );
    this.clear({ clearTransforms: true, resetAllFramesCursor: true });
    this.#clearSubscriptions();
    this.#addSubscriptionsFromSceneExtensions(
      (extension) => extension === this.#imageModeExtension,
    );
    this.settings.addNodeValidator(this.#imageOnlyModeTopicSettingsValidator);
  };

  public disableImageOnlySubscriptionMode = (): void => {
    // .clear() will clean up remaining errors on topics
    this.settings.removeNodeValidator(this.#imageOnlyModeTopicSettingsValidator);
    this.clear({ clearTransforms: true, resetAllFramesCursor: true });
    this.#clearSubscriptions();
    this.#addSubscriptionsFromSceneExtensions();
    this.#addTransformSubscriptions();
  };

  /** Adds errors to visible topic nodes when calibration is undefined */
  #imageOnlyModeTopicSettingsValidator = (entry: SettingsTreeEntry, errors: LayerErrors) => {
    const { path, node } = entry;
    if (path[0] === "topics") {
      if (node.visible === true) {
        errors.addToTopic(
          path[1]!,
          "IMAGE_ONLY_TOPIC",
          "Camera calibration information is required to display 3D topics",
        );
      } else {
        errors.removeFromTopic(path[1]!, "IMAGE_ONLY_TOPIC");
      }
    }
  };

  public addCustomLayerAction(options: {
    layerId: string;
    label: string;
    icon?: SettingsIcon;
    handler: (instanceId: string) => void;
  }): void {
    const handler = options.handler;
    // A unique id is assigned to each action to deduplicate selection events
    // The layerId is used to map selection events back to their handlers
    const instanceId = uuidv4();
    const action: SettingsTreeNodeActionItem = {
      type: "action",
      id: `${options.layerId}-${instanceId}`,
      label: options.label,
      icon: options.icon,
    };
    this.#customLayerActions.set(options.layerId, { action, handler });
    this.#updateTopicsAndCustomLayerSettingsNodes();
  }

  #updateTopicsAndCustomLayerSettingsNodes(): void {
    this.settings.setNodesForKey(RENDERER_ID, [
      this.#getTopicsSettingsEntry(),
      this.#getCustomLayersSettingsEntry(),
    ]);
  }

  #getTopicsSettingsEntry(): SettingsTreeEntry {
    // "Topics" settings tree node
    const topics: SettingsTreeEntry = {
      path: ["topics"],
      node: {
        enableVisibilityFilter: true,
        label: i18next.t("threeDee:topics"),
        defaultExpansionState: "expanded",
        actions: [
          { id: "show-all", type: "action", label: i18next.t("threeDee:showAll") },
          { id: "hide-all", type: "action", label: i18next.t("threeDee:hideAll") },
        ],
        children: this.settings.tree()["topics"]?.children,
        handler: this.#handleTopicsAction,
      },
    };
    return topics;
  }

  #getCustomLayersSettingsEntry(): SettingsTreeEntry {
    const layerCount = Object.keys(this.config.layers).length;
    const customLayers: SettingsTreeEntry = {
      path: ["layers"],
      node: {
        label: `${i18next.t("threeDee:customLayers")}${layerCount > 0 ? ` (${layerCount})` : ""}`,
        children: this.settings.tree()["layers"]?.children,
        actions: Array.from(this.#customLayerActions.values()).map((entry) => entry.action),
        handler: this.#handleCustomLayersAction,
      },
    };
    return customLayers;
  }

  /** Enable or disable object selection mode */
  // eslint-disable-next-line @foxglove/no-boolean-parameters
  public setPickingEnabled(enabled: boolean): void {
    this.#pickingEnabled = enabled;
    if (!enabled) {
      this.setSelectedRenderable(undefined);
    }
  }

  /** Update the color scheme and background color, rebuilding any materials as necessary */
  public setColorScheme(colorScheme: "dark" | "light", backgroundColor: string | undefined): void {
    this.colorScheme = colorScheme;

    const bgColor = backgroundColor
      ? stringToRgb(tempColor, backgroundColor).convertSRGBToLinear()
      : undefined;

    for (const extension of this.sceneExtensions.values()) {
      extension.setColorScheme(colorScheme, bgColor);
    }

    if (colorScheme === "dark") {
      this.gl.setClearColor(bgColor ?? DARK_BACKDROP);
      this.outlineMaterial.color.set(DARK_OUTLINE);
      this.outlineMaterial.needsUpdate = true;
      this.instancedOutlineMaterial.color.set(DARK_OUTLINE);
      this.instancedOutlineMaterial.needsUpdate = true;
      this.#selectionBackdrop.setColor(DARK_BACKDROP, 0.8);
    } else {
      this.gl.setClearColor(bgColor ?? LIGHT_BACKDROP);
      this.outlineMaterial.color.set(LIGHT_OUTLINE);
      this.outlineMaterial.needsUpdate = true;
      this.instancedOutlineMaterial.color.set(LIGHT_OUTLINE);
      this.instancedOutlineMaterial.needsUpdate = true;
      this.#selectionBackdrop.setColor(LIGHT_BACKDROP, 0.8);
    }
  }

  /** Update the list of topics and rebuild all settings nodes when the identity
   * of the topics list changes */
  public setTopics(topics: ReadonlyArray<Topic> | undefined): void {
    if (this.topics === topics) {
      return;
    }
    this.topics = topics;

    // Rebuild topicsByName
    this.topicsByName = topics ? new Map(topics.map((topic) => [topic.name, topic])) : undefined;

    this.emit("topicsChanged", this);

    // Rebuild the settings nodes for all scene extensions
    for (const extension of this.sceneExtensions.values()) {
      this.settings.setNodesForKey(extension.extensionId, extension.settingsNodes());
    }
  }

  public setParameters(parameters: ReadonlyMap<string, ParameterValue> | undefined): void {
    const changed = this.parameters !== parameters;
    this.parameters = parameters;
    if (changed) {
      this.emit("parametersChange", parameters, this);
    }
  }

  public updateCustomLayersCount(): void {
    const layerCount = Object.keys(this.config.layers).length;
    const label = `Custom Layers${layerCount > 0 ? ` (${layerCount})` : ""}`;
    this.settings.setLabel(["layers"], label);
  }

  public setCameraState(cameraState: CameraState): void {
    this.cameraHandler.setCameraState(cameraState);
  }

  public getCameraState(): CameraState | undefined {
    return this.cameraHandler.getCameraState();
  }

  public canResetView(): boolean {
    return this.#imageModeExtension?.hasModifiedView() ?? false;
  }

  public resetView(): void {
    this.#imageModeExtension?.resetViewModifications();
    this.queueAnimationFrame();
  }

  public setSelectedRenderable(selection: PickedRenderable | undefined): void {
    if (this.#selectedRenderable === selection) {
      return;
    }

    const prevSelected = this.#selectedRenderable;
    if (prevSelected) {
      // Deselect the previously selected renderable
      deselectObject(prevSelected.renderable);
      log.debug(`Deselected ${prevSelected.renderable.id} (${prevSelected.renderable.name})`);
    }

    this.#selectedRenderable = selection;

    if (selection) {
      // Select the newly selected renderable
      selectObject(selection.renderable);
      log.debug(
        `Selected ${selection.renderable.id} (${selection.renderable.name}) (instance=${selection.instanceIndex})`,
        selection.renderable,
      );
    }

    this.emit("selectedRenderable", selection, this);

    if (!this.debugPicking) {
      this.animationFrame();
    }
  }

  public addMessageEvent(messageEvent: Readonly<MessageEvent>): void {
    const { message } = messageEvent;

    const maybeHasHeader = message as DeepPartial<{ header: Header }>;
    const maybeHasMarkers = message as DeepPartial<MarkerArray>;
    const maybeHasEntities = message as DeepPartial<SceneUpdate>;
    const maybeHasFrameId = message as DeepPartial<Header>;

    // Extract coordinate frame IDs from all incoming messages
    if (maybeHasHeader.header) {
      // If this message has a Header, scrape the frame_id from it
      const frameId = maybeHasHeader.header.frame_id ?? "";
      this.addCoordinateFrame(frameId);
    } else if (Array.isArray(maybeHasMarkers.markers)) {
      // If this message has an array called markers, scrape frame_id from all markers
      for (const marker of maybeHasMarkers.markers) {
        if (marker) {
          const frameId = marker.header?.frame_id ?? "";
          this.addCoordinateFrame(frameId);
        }
      }
    } else if (Array.isArray(maybeHasEntities.entities)) {
      // If this message has an array called entities, scrape frame_id from all entities
      for (const entity of maybeHasEntities.entities) {
        if (entity) {
          const frameId = entity.frame_id ?? "";
          this.addCoordinateFrame(frameId);
        }
      }
    } else if (typeof maybeHasFrameId.frame_id === "string") {
      // If this message has a top-level frame_id, scrape it
      this.addCoordinateFrame(maybeHasFrameId.frame_id);
    }

    handleMessage(messageEvent, this.topicHandlers.get(messageEvent.topic));
    handleMessage(messageEvent, this.schemaHandlers.get(messageEvent.schemaName));
  }

  /** Match the behavior of `tf::Transformer` by stripping leading slashes from
   * frame_ids. This preserves compatibility with earlier versions of ROS while
   * not breaking any current versions where:
   * > tf2 does not accept frame_ids starting with "/"
   * Source: <http://wiki.ros.org/tf2/Migration#tf_prefix_backwards_compatibility>
   */
  public normalizeFrameId(frameId: string): string {
    if (!this.ros || !frameId.startsWith("/")) {
      return frameId;
    }
    return frameId.slice(1);
  }

  public addCoordinateFrame(frameId: string): void {
    const normalizedFrameId = this.normalizeFrameId(frameId);
    if (!this.transformTree.hasFrame(normalizedFrameId)) {
      this.transformTree.getOrCreateFrame(normalizedFrameId);
      this.coordinateFrameList = this.transformTree.frameList();
      // log.debug(`Added coordinate frame "${normalizedFrameId}"`);
      this.emit("transformTreeUpdated", this);
    }
  }

  #addFrameTransform(transform: FrameTransform): void {
    const parentId = transform.parent_frame_id;
    const childId = transform.child_frame_id;
    const stamp = toNanoSec(transform.timestamp);
    const t = transform.translation;
    const q = transform.rotation;

    this.addTransform(parentId, childId, stamp, t, q);
  }

  #addTransformMessage(tf: TransformStamped): void {
    const normalizedParentId = this.normalizeFrameId(tf.header.frame_id);
    const normalizedChildId = this.normalizeFrameId(tf.child_frame_id);
    const stamp = toNanoSec(tf.header.stamp);
    const t = tf.transform.translation;
    const q = tf.transform.rotation;

    this.addTransform(normalizedParentId, normalizedChildId, stamp, t, q);
  }

  // Create a new transform and add it to the renderer's TransformTree
  public addTransform(
    parentFrameId: string,
    childFrameId: string,
    stamp: bigint,
    translation: Vector3,
    rotation: Quaternion,
    errorSettingsPath?: string[],
  ): void {
    const t = translation;
    const q = rotation;

    const transform = new Transform([t.x, t.y, t.z], [q.x, q.y, q.z, q.w]);
    const status = this.transformTree.addTransform(childFrameId, parentFrameId, stamp, transform);

    if (status === AddTransformResult.UPDATED) {
      this.coordinateFrameList = this.transformTree.frameList();
      this.emit("transformTreeUpdated", this);
    }

    if (status === AddTransformResult.CYCLE_DETECTED) {
      this.settings.errors.add(
        ["transforms", `frame:${childFrameId}`],
        CYCLE_DETECTED,
        `Transform tree cycle detected: Received transform with parent "${parentFrameId}" and child "${childFrameId}", but "${childFrameId}" is already an ancestor of "${parentFrameId}". Transform message dropped.`,
      );
      if (errorSettingsPath) {
        this.settings.errors.add(
          errorSettingsPath,
          CYCLE_DETECTED,
          `Attempted to add cyclical transform: Frame "${parentFrameId}" cannot be the parent of frame "${childFrameId}". Transform message dropped.`,
        );
      }
    }

    // Check if the transform history for this frame is at capacity and show an error if so. This
    // error can't be cleared until the scene is reloaded
    const frame = this.transformTree.getOrCreateFrame(childFrameId);
    if (frame.transformsSize() === frame.maxCapacity) {
      this.settings.errors.add(
        ["transforms", `frame:${childFrameId}`],
        TF_OVERFLOW,
        `[Warning] Transform history is at capacity (${frame.maxCapacity}), old TFs will be dropped`,
      );
    }
  }

  public removeTransform(childFrameId: string, parentFrameId: string, stamp: bigint): void {
    this.transformTree.removeTransform(childFrameId, parentFrameId, stamp);
    this.coordinateFrameList = this.transformTree.frameList();
    this.emit("transformTreeUpdated", this);
  }

  // Callback handlers

  public animationFrame = (): void => {
    this.#animationFrame = undefined;
    if (!this.#rendering) {
      this.#frameHandler(this.currentTime);
      this.#rendering = false;
    }
  };

  public queueAnimationFrame(): void {
    if (this.#animationFrame == undefined) {
      this.#animationFrame = requestAnimationFrame(this.animationFrame);
    }
  }

  public setFollowFrameId(frameId: string | undefined): void {
    if (this.followFrameId !== frameId) {
      log.debug(`Setting followFrameId to ${frameId}`);
    }
    this.followFrameId = frameId;
  }

  public async fetchAsset(uri: string, options?: { signal: AbortSignal }): Promise<Asset> {
    return await this.#fetchAsset(uri, options);
  }

  #frameHandler = (currentTime: bigint): void => {
    this.#rendering = true;
    this.currentTime = currentTime;
    this.#updateFrameErrors();
    this.#updateFixedFrameId();
    this.#updateResolution();

    this.gl.clear();
    this.emit("startFrame", currentTime, this);

    const camera = this.cameraHandler.getActiveCamera();
    camera.layers.set(LAYER_DEFAULT);

    // use the FALLBACK_FRAME_ID if renderFrame is undefined and there are no options for transforms
    const renderFrameId =
      this.followFrameId && this.transformTree.frame(this.followFrameId)
        ? this.followFrameId
        : CoordinateFrame.FALLBACK_FRAME_ID;
    const fixedFrameId = this.fixedFrameId ?? CoordinateFrame.FALLBACK_FRAME_ID;

    for (const sceneExtension of this.sceneExtensions.values()) {
      sceneExtension.startFrame(currentTime, renderFrameId, fixedFrameId);
    }

    this.gl.render(this.#scene, camera);

    if (this.#selectedRenderable) {
      this.gl.render(this.#selectionBackdropScene, camera);
      this.gl.clearDepth();
      camera.layers.set(LAYER_SELECTED);
      this.gl.render(this.#scene, camera);
    }

    this.emit("endFrame", currentTime, this);

    this.gl.info.reset();
  };

  #updateFixedFrameId(): void {
    const frame =
      this.followFrameId != undefined ? this.transformTree.frame(this.followFrameId) : undefined;

    if (frame == undefined) {
      this.fixedFrameId = undefined;
      return;
    }
    const fixedFrame = frame.root();
    const fixedFrameId = fixedFrame.id;
    if (this.fixedFrameId !== fixedFrameId) {
      if (this.fixedFrameId == undefined) {
        log.debug(`Setting fixed frame to ${fixedFrameId}`);
      } else {
        log.debug(`Changing fixed frame from "${this.fixedFrameId}" to "${fixedFrameId}"`);
      }
      this.fixedFrameId = fixedFrameId;
    }
  }

  #resizeHandler = (size: THREE.Vector2): void => {
    this.gl.setPixelRatio(window.devicePixelRatio);
    this.gl.setSize(size.width, size.height);
    this.cameraHandler.handleResize(size.width, size.height, window.devicePixelRatio);

    const renderSize = this.gl.getDrawingBufferSize(tempVec2);
    log.debug(`Resized renderer to ${renderSize.width}x${renderSize.height}`);
    this.animationFrame();
  };

  #clickHandler = (cursorCoords: THREE.Vector2): void => {
    if (!this.#pickingEnabled) {
      this.setSelectedRenderable(undefined);
      return;
    }

    // Disable picking while a tool is active
    if (this.measurementTool.state !== "idle" || this.publishClickTool.state !== "idle") {
      return;
    }

    // Deselect the currently selected object, if one is selected and re-render
    // the scene to update the render lists
    this.setSelectedRenderable(undefined);

    // Pick a single renderable, hide it, re-render, and run picking again until
    // the backdrop is hit or we exceed MAX_SELECTIONS
    const camera = this.cameraHandler.getActiveCamera();
    const selections: PickedRenderable[] = [];
    let curSelection: PickedRenderable | undefined;
    while (
      (curSelection = this.#pickSingleObject(cursorCoords)) &&
      selections.length < MAX_SELECTIONS
    ) {
      selections.push(curSelection);
      // If debugPicking is on, we don't want to overwrite the hitmap by doing more iterations
      if (this.debugPicking) {
        break;
      }
      curSelection.renderable.visible = false;
      this.gl.render(this.#scene, camera);
    }

    // Put everything back to normal and render one last frame
    for (const selection of selections) {
      selection.renderable.visible = true;
    }
    if (!this.debugPicking) {
      this.animationFrame();
    }

    log.debug(`Clicked ${selections.length} renderable(s)`);
    this.emit("renderablesClicked", selections, cursorCoords, this);
  };

  #handleFrameTransform = ({ message }: MessageEvent<DeepPartial<FrameTransform>>): void => {
    // foxglove.FrameTransform - Ingest this single transform into our TF tree
    const transform = normalizeFrameTransform(message);
    this.#addFrameTransform(transform);
  };

  #handleFrameTransforms = ({ message }: MessageEvent<DeepPartial<FrameTransforms>>): void => {
    // foxglove.FrameTransforms - Ingest the list of transforms into our TF tree
    const frameTransforms = normalizeFrameTransforms(message);
    for (const transform of frameTransforms.transforms) {
      this.#addFrameTransform(transform);
    }
  };

  #handleTFMessage = ({ message }: MessageEvent<DeepPartial<TFMessage>>): void => {
    // tf2_msgs/TFMessage - Ingest the list of transforms into our TF tree
    const tfMessage = normalizeTFMessage(message);
    for (const tf of tfMessage.transforms) {
      this.#addTransformMessage(tf);
    }
  };

  #handleTransformStamped = ({ message }: MessageEvent<DeepPartial<TransformStamped>>): void => {
    // geometry_msgs/TransformStamped - Ingest this single transform into our TF tree
    const tf = normalizeTransformStamped(message);
    this.#addTransformMessage(tf);
  };

  #handleTopicsAction = (action: SettingsTreeAction): void => {
    const path = action.payload.path;
    if (action.action !== "perform-node-action" || path.length !== 1 || path[0] !== "topics") {
      return;
    }
    log.debug(`handleTopicsAction(${action.payload.id})`);

    // eslint-disable-next-line @foxglove/no-boolean-parameters
    const toggleTopicVisibility = (value: boolean) => {
      for (const extension of this.sceneExtensions.values()) {
        for (const node of extension.settingsNodes()) {
          if (node.path[0] === "topics") {
            extension.handleSettingsAction({
              action: "update",
              payload: { path: [...node.path, "visible"], input: "boolean", value },
            });
          }
        }
      }
    };

    if (action.payload.id === "show-all") {
      // Show all topics
      toggleTopicVisibility(true);
    } else if (action.payload.id === "hide-all") {
      // Hide all topics
      toggleTopicVisibility(false);
    }
  };

  #handleCustomLayersAction = (action: SettingsTreeAction): void => {
    const path = action.payload.path;
    if (action.action !== "perform-node-action" || path.length !== 1 || path[0] !== "layers") {
      return;
    }
    log.debug(`handleCustomLayersAction(${action.payload.id})`);

    // Remove `-{uuid}` from the actionId to get the layerId
    const actionId = action.payload.id;
    const layerId = actionId.slice(0, -37);
    const instanceId = actionId.slice(-36);

    const entry = this.#customLayerActions.get(layerId);
    if (!entry) {
      throw new Error(`No custom layer action found for "${layerId}"`);
    }

    // Regenerate the action menu entry with a new instanceId. The unique instanceId is generated
    // here so we can deduplicate multiple callbacks for the same menu click event
    const { label, icon } = entry.action;
    this.addCustomLayerAction({ layerId, label, icon, handler: entry.handler });

    // Trigger the add custom layer action handler
    entry.handler(instanceId);

    // Update the Custom Layers node label with the number of custom layers
    this.updateCustomLayersCount();
  };

  #pickSingleObject(cursorCoords: THREE.Vector2): PickedRenderable | undefined {
    // Render a single pixel using a fragment shader that writes object IDs as
    // colors, then read the value of that single pixel back
    const objectId = this.#picker.pick(
      cursorCoords.x,
      cursorCoords.y,
      this.cameraHandler.getActiveCamera(),
      { debug: this.debugPicking, disableSetViewOffset: this.interfaceMode === "image" },
    );
    if (objectId === -1) {
      log.debug("Picking did not return an object");
      return undefined;
    }

    // Traverse the scene looking for this objectId
    const pickedObject = this.#scene.getObjectById(objectId);

    // Find the highest ancestor of the picked object that is a Renderable
    let renderable: Renderable | undefined;
    let maybeRenderable = pickedObject as Partial<Renderable> | undefined;
    while (maybeRenderable) {
      if (maybeRenderable.pickable === true) {
        renderable = maybeRenderable as Renderable;
      }
      maybeRenderable = (maybeRenderable.parent ?? undefined) as Partial<Renderable> | undefined;
    }

    if (!renderable) {
      log.warn(
        `No Renderable found for objectId ${objectId} (name="${pickedObject?.name}" uuid=${pickedObject?.uuid})`,
      );
      return undefined;
    }

    log.debug(`Picking pass returned ${renderable.id} (${renderable.name})`, renderable);

    let instanceIndex: number | undefined;
    if (renderable.pickableInstances) {
      instanceIndex = this.#picker.pickInstance(
        cursorCoords.x,
        cursorCoords.y,
        this.cameraHandler.getActiveCamera(),
        renderable,
        { debug: this.debugPicking, disableSetViewOffset: this.interfaceMode === "image" },
      );
      instanceIndex = instanceIndex === -1 ? undefined : instanceIndex;
      log.debug("Instance picking pass on", renderable, "returned", instanceIndex);
    }

    return { renderable, instanceIndex };
  }

  #updateFrameErrors(): void {
    if (this.followFrameId == undefined) {
      // No frames available
      this.settings.errors.add(
        FOLLOW_TF_PATH,
        NO_FRAME_SELECTED,
        i18next.t("threeDee:noCoordinateFramesFound"),
      );
      return;
    }

    this.settings.errors.remove(FOLLOW_TF_PATH, NO_FRAME_SELECTED);

    const frame = this.transformTree.frame(this.followFrameId);

    // The follow frame id should be chosen from a frameId that exists, but
    // we still need to watch out for the case that the transform tree was
    // cleared before that could be updated
    if (!frame) {
      this.settings.errors.add(
        FOLLOW_TF_PATH,
        FOLLOW_FRAME_NOT_FOUND,
        i18next.t("threeDee:frameNotFound", {
          frameId: this.followFrameId,
        }),
      );
      return;
    }

    this.settings.errors.remove(FOLLOW_TF_PATH, FOLLOW_FRAME_NOT_FOUND);
  }
  public getContextMenuItems = (): PanelContextMenuItem[] => {
    return Array.from(this.sceneExtensions.values()).flatMap((extension) =>
      extension.getContextMenuItems(),
    );
  };

  #updateResolution(): void {
    const resolution = this.input.canvasSize;
    if (this.#prevResolution.equals(resolution)) {
      return;
    }
    this.#prevResolution.copy(resolution);

    this.#scene.traverse((object) => {
      if ((object as Partial<THREE.Mesh>).material) {
        const mesh = object as THREE.Mesh;
        const material = mesh.material as Partial<THREE.ShaderMaterial>;

        // Update render resolution uniforms
        if (material.uniforms?.resolution) {
          material.uniforms.resolution.value.copy(resolution);
          material.uniformsNeedUpdate = true;
        }
      }
    });
  }

  public getDropStatus = (paths: readonly DraggedMessagePath[]): MessagePathDropStatus => {
    const effects: ("add" | "replace")[] = [];
    for (const path of paths) {
      let effect;
      for (const extension of this.sceneExtensions.values()) {
        const maybeEffect = extension.getDropEffectForPath(path);
        if (maybeEffect) {
          effect = maybeEffect;
          break;
        }
      }
      // if a single path does not have a drop effect, all paths are not droppable
      if (effect == undefined) {
        return { canDrop: false };
      }
      effects.push(effect);
    }
    // prioritize replace effect over add
    const finalEffect = effects.includes("replace") ? "replace" : "add";

    return {
      canDrop: true,
      effect: finalEffect,
    };
  };

  public handleDrop = (paths: readonly DraggedMessagePath[]): void => {
    this.updateConfig((draft) => {
      for (const path of paths) {
        for (const extension of this.sceneExtensions.values()) {
          extension.updateConfigForDropPath(draft, path);
        }
      }
    });
  };

  public setAnalytics(analytics: IAnalytics): void {
    this.analytics = analytics;
  }
}

function handleMessage(
  messageEvent: Readonly<MessageEvent>,
  subscriptions: RendererSubscription[] | undefined,
): void {
  if (subscriptions) {
    for (const subscription of subscriptions) {
      subscription.handler(messageEvent);
    }
  }
}

function selectObject(object: THREE.Object3D) {
  object.layers.set(LAYER_SELECTED);
  object.traverse((child) => {
    child.layers.set(LAYER_SELECTED);
  });
}

function deselectObject(object: THREE.Object3D) {
  object.layers.set(LAYER_DEFAULT);
  object.traverse((child) => {
    child.layers.set(LAYER_DEFAULT);
  });
}

/**
 * Creates a skeleton settings tree. The tree contents are filled in by scene extensions.
 * This dictates the order in which groups appear in the settings editor.
 */
function baseSettingsTree(interfaceMode: InterfaceMode): SettingsTreeNodes {
  const keys: string[] = [];
  keys.push(interfaceMode === "image" ? "imageMode" : "general", "scene");
  if (interfaceMode === "image") {
    keys.push("imageAnnotations");
  }
  if (interfaceMode === "3d") {
    keys.push("cameraState");
  }
  keys.push("transforms", "topics", "layers");
  if (interfaceMode === "3d") {
    keys.push("publish");
  }
  return Object.fromEntries(keys.map((key) => [key, {}]));
}
