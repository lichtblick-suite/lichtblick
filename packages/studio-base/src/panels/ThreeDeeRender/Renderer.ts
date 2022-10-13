// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import EventEmitter from "eventemitter3";
import { Immutable, produce } from "immer";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { DeepPartial } from "ts-essentials";
import { v4 as uuidv4 } from "uuid";

import Logger from "@foxglove/log";
import { toNanoSec } from "@foxglove/rostime";
import type { FrameTransform, SceneUpdate } from "@foxglove/schemas";
import {
  MessageEvent,
  ParameterValue,
  SettingsIcon,
  SettingsTreeAction,
  SettingsTreeNodeActionItem,
  SettingsTreeNodes,
  Topic,
  VariableValue,
} from "@foxglove/studio";
import { FoxgloveGrid } from "@foxglove/studio-base/panels/ThreeDeeRender/renderables/FoxgloveGrid";
import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";
import { LabelMaterial, LabelPool } from "@foxglove/three-text";

import { Input } from "./Input";
import { LineMaterial } from "./LineMaterial";
import { ModelCache, MeshUpAxis, DEFAULT_MESH_UP_AXIS } from "./ModelCache";
import { PickedRenderable, Picker } from "./Picker";
import type { Renderable } from "./Renderable";
import { SceneExtension } from "./SceneExtension";
import { ScreenOverlay } from "./ScreenOverlay";
import { SettingsManager, SettingsTreeEntry } from "./SettingsManager";
import { CameraState } from "./camera";
import { DARK_OUTLINE, LIGHT_OUTLINE, stringToRgb } from "./color";
import { FRAME_TRANSFORM_DATATYPES } from "./foxglove";
import { DetailLevel, msaaSamples } from "./lod";
import {
  normalizeFrameTransform,
  normalizeTFMessage,
  normalizeTransformStamped,
} from "./normalizeMessages";
import { Cameras } from "./renderables/Cameras";
import { CoreSettings } from "./renderables/CoreSettings";
import { FrameAxes, LayerSettingsTransform } from "./renderables/FrameAxes";
import { Grids } from "./renderables/Grids";
import { Images } from "./renderables/Images";
import { Markers } from "./renderables/Markers";
import { MeasurementTool } from "./renderables/MeasurementTool";
import { OccupancyGrids } from "./renderables/OccupancyGrids";
import { PointCloudsAndLaserScans } from "./renderables/PointCloudsAndLaserScans";
import { Polygons } from "./renderables/Polygons";
import { PoseArrays } from "./renderables/PoseArrays";
import { Poses } from "./renderables/Poses";
import { PublishClickTool, PublishClickType } from "./renderables/PublishClickTool";
import { FoxgloveSceneEntities } from "./renderables/SceneEntities";
import { Urdfs } from "./renderables/Urdfs";
import { VelodyneScans } from "./renderables/VelodyneScans";
import { MarkerPool } from "./renderables/markers/MarkerPool";
import {
  Header,
  MarkerArray,
  Quaternion,
  TFMessage,
  TF_DATATYPES,
  TransformStamped,
  TRANSFORM_STAMPED_DATATYPES,
  Vector3,
} from "./ros";
import { BaseSettings, CustomLayerSettings, SelectEntry } from "./settings";
import { makePose, Pose, Transform, TransformTree } from "./transforms";

const log = Logger.getLogger(__filename);

export type RendererEvents = {
  startFrame: (currentTime: bigint, renderer: Renderer) => void;
  endFrame: (currentTime: bigint, renderer: Renderer) => void;
  cameraMove: (renderer: Renderer) => void;
  renderablesClicked: (
    selections: PickedRenderable[],
    cursorCoords: { x: number; y: number },
    renderer: Renderer,
  ) => void;
  selectedRenderable: (selection: PickedRenderable | undefined, renderer: Renderer) => void;
  parametersChange: (
    parameters: ReadonlyMap<string, ParameterValue> | undefined,
    renderer: Renderer,
  ) => void;
  variablesChange: (
    variables: ReadonlyMap<string, VariableValue> | undefined,
    renderer: Renderer,
  ) => void;
  transformTreeUpdated: (renderer: Renderer) => void;
  settingsTreeChange: (renderer: Renderer) => void;
  configChange: (renderer: Renderer) => void;
  datatypeHandlersChanged: (renderer: Renderer) => void;
  topicHandlersChanged: (renderer: Renderer) => void;
};

export type FollowMode = "follow-pose" | "follow-position" | "follow-none";

export type RendererConfig = {
  /** Camera settings for the currently rendering scene */
  cameraState: CameraState;
  /** Coordinate frameId of the rendering frame */
  followTf: string | undefined;
  /** Camera follow mode */
  followMode: FollowMode;
  scene: {
    /** Show rendering metrics in a DOM overlay */
    enableStats?: boolean;
    /** Background color override for the scene, sent to `glClearColor()` */
    backgroundColor?: string;
    /* Scale factor to apply to all labels */
    labelScaleFactor?: number;
    /** Ignore the <up_axis> tag in COLLADA files (matching rviz behavior) */
    ignoreColladaUpAxis?: boolean;
    meshUpAxis?: MeshUpAxis;
    transforms?: {
      /** Toggles translation and rotation offset controls for frames */
      editable?: boolean;
      /** Toggles visibility of frame axis labels */
      showLabel?: boolean;
      /** Size of frame axis labels */
      labelSize?: number;
      /** Size of coordinate frame axes */
      axisScale?: number;
      /** Width of the connecting line between child and parent frames */
      lineWidth?: number;
      /** Color of the connecting line between child and parent frames */
      lineColor?: string;
      /** Enable transform preloading */
      enablePreloading?: boolean;
    };
    /** Toggles visibility of all topics */
    topicsVisible?: boolean;
  };
  publish: {
    /** The type of message to publish when clicking in the scene */
    type: PublishClickType;
    /** The topic on which to publish poses */
    poseTopic: string;
    /** The topic on which to publish points */
    pointTopic: string;
    /** The topic on which to publish pose estimates */
    poseEstimateTopic: string;
    /** The X standard deviation to publish with poses */
    poseEstimateXDeviation: number;
    /** The Y standard deviation to publish with poses */
    poseEstimateYDeviation: number;
    /** The theta standard deviation to publish with poses */
    poseEstimateThetaDeviation: number;
  };
  /** frameId -> settings */
  transforms: Record<string, Partial<LayerSettingsTransform> | undefined>;
  /** topicName -> settings */
  topics: Record<string, Partial<BaseSettings> | undefined>;
  /** instanceId -> settings */
  layers: Record<string, Partial<CustomLayerSettings> | undefined>;
};

/** Callback for handling a message received on a topic */
export type MessageHandler<T = unknown> = (messageEvent: MessageEvent<T>) => void;

export type RendererSubscription<T = unknown> = {
  /** Preload the full history of topic messages as a best effort */
  preload?: boolean;
  /**
   * By default, topic subscriptions are only created when the topic visibility
   * has been toggled on by the user in the settings sidebar. Enabling forced
   * will unconditionally create the topic subscription(s)
   */
  forced?: boolean;
  /** Callback that will be fired for each matching incoming message */
  handler: MessageHandler<T>;
};

/** Menu item entry and callback for the "Custom Layers" menu */
export type CustomLayerAction = {
  action: SettingsTreeNodeActionItem;
  handler: (instanceId: string) => void;
};

// Enable this to render the hitmap to the screen after clicking
const DEBUG_PICKING: boolean = false;

// Maximum number of objects to present as selection options in a single click
const MAX_SELECTIONS = 10;

// NOTE: These do not use .convertSRGBToLinear() since background color is not
// affected by gamma correction
const LIGHT_BACKDROP = new THREE.Color(0xececec);
const DARK_BACKDROP = new THREE.Color(0x121217);

// Define rendering layers for multipass rendering used for the selection effect
const LAYER_DEFAULT = 0;
const LAYER_SELECTED = 1;

const UNIT_X = new THREE.Vector3(1, 0, 0);
const UNIT_Z = new THREE.Vector3(0, 0, 1);
const PI_2 = Math.PI / 2;

// Coordinate frames named in [REP-105](https://www.ros.org/reps/rep-0105.html)
const DEFAULT_FRAME_IDS = ["base_link", "odom", "map", "earth"];

const FOLLOW_TF_PATH = ["general", "followTf"];
const NO_FRAME_SELECTED = "NO_FRAME_SELECTED";
const FRAME_NOT_FOUND = "FRAME_NOT_FOUND";
const TF_OVERFLOW = "TF_OVERFLOW";

// An extensionId for creating the top-level settings nodes such as "Topics" and
// "Custom Layers"
const RENDERER_ID = "foxglove.Renderer";

const tempColor = new THREE.Color();
const tempVec3 = new THREE.Vector3();
const tempVec2 = new THREE.Vector2();
const tempSpherical = new THREE.Spherical();
const tempEuler = new THREE.Euler();

// used for holding unfollowPoseSnapshot in render frame every new frame
const snapshotInRenderFrame = makePose();

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

class InstancedLineMaterial extends THREE.LineBasicMaterial {
  public constructor(...args: ConstructorParameters<typeof THREE.LineBasicMaterial>) {
    super(...args);
    this.defines ??= {};
    this.defines.USE_INSTANCING = true;
  }
}

/**
 * An extensible 3D renderer attached to a `HTMLCanvasElement`,
 * `WebGLRenderingContext`, and `SettingsTree`.
 */
export class Renderer extends EventEmitter<RendererEvents> {
  private canvas: HTMLCanvasElement;
  public readonly gl: THREE.WebGLRenderer;
  public maxLod = DetailLevel.High;
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
  public datatypeHandlers = new Map<string, RendererSubscription[]>();
  // topicName -> RendererSubscription[]
  public topicHandlers = new Map<string, RendererSubscription[]>();
  // layerId -> { action, handler }
  private customLayerActions = new Map<string, CustomLayerAction>();
  private scene: THREE.Scene;
  private dirLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  public input: Input;
  public readonly outlineMaterial = new THREE.LineBasicMaterial({ dithering: true });
  public readonly instancedOutlineMaterial = new InstancedLineMaterial({ dithering: true });

  private coreSettings: CoreSettings;
  public measurementTool: MeasurementTool;
  public publishClickTool: PublishClickTool;

  private perspectiveCamera: THREE.PerspectiveCamera;
  private orthographicCamera: THREE.OrthographicCamera;
  // This group is used to transform the cameras based on the Frame follow mode
  // quaternion is affected in stationary and position-only follow modes
  // both position and quaternion of the group are affected in stationary mode
  private cameraGroup: THREE.Group;
  private aspect: number;
  private controls: OrbitControls;
  public followMode: FollowMode;
  // The pose of the render frame in the fixed frame when following was disabled
  private unfollowPoseSnapshot: Pose | undefined;

  // Are we connected to a ROS data source? Normalize coordinate frames if so by
  // stripping any leading "/" prefix. See `normalizeFrameId()` for details.
  public ros = false;

  private picker: Picker;
  private selectionBackdrop: ScreenOverlay;
  private selectedRenderable: PickedRenderable | undefined;
  public colorScheme: "dark" | "light" = "light";
  public modelCache: ModelCache;
  public transformTree = new TransformTree();
  public coordinateFrameList: SelectEntry[] = [];
  public currentTime = 0n;
  public fixedFrameId: string | undefined;
  public renderFrameId: string | undefined;
  public followFrameId: string | undefined;

  public labelPool = new LabelPool({ fontFamily: fonts.MONOSPACE });
  public markerPool = new MarkerPool(this);

  private _prevResolution = new THREE.Vector2();
  private _pickingEnabled = false;
  private _isUpdatingCameraState = false;
  private _animationFrame?: number;

  public constructor(canvas: HTMLCanvasElement, config: RendererConfig) {
    super();

    // NOTE: Global side effect
    THREE.Object3D.DefaultUp = new THREE.Vector3(0, 0, 1);

    this.canvas = canvas;
    this.config = config;

    this.settings = new SettingsManager(baseSettingsTree());
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
    this.gl.outputEncoding = THREE.sRGBEncoding;
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
    });

    this.scene = new THREE.Scene();

    this.dirLight = new THREE.DirectionalLight();
    this.dirLight.position.set(1, 1, 1);
    this.dirLight.castShadow = true;
    this.dirLight.layers.enableAll();

    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 500;
    this.dirLight.shadow.bias = -0.00001;

    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.5);
    this.hemiLight.layers.enableAll();

    this.scene.add(this.dirLight);
    this.scene.add(this.hemiLight);

    this.perspectiveCamera = new THREE.PerspectiveCamera();
    this.orthographicCamera = new THREE.OrthographicCamera();
    this.cameraGroup = new THREE.Group();

    this.cameraGroup.add(this.perspectiveCamera);
    this.cameraGroup.add(this.orthographicCamera);
    this.scene.add(this.cameraGroup);

    this.controls = new OrbitControls(this.perspectiveCamera, this.canvas);
    this.controls.screenSpacePanning = false; // only allow panning in the XY plane
    this.controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
    this.controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
    this.controls.touches.ONE = THREE.TOUCH.PAN;
    this.controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
    this.controls.addEventListener("change", () => {
      if (!this._isUpdatingCameraState) {
        this.emit("cameraMove", this);
      }
    });

    // Make the canvas able to receive keyboard events and setup WASD controls
    canvas.tabIndex = 1000;
    this.controls.keys = { LEFT: "KeyA", RIGHT: "KeyD", UP: "KeyW", BOTTOM: "KeyS" };
    this.controls.listenToKeyEvents(canvas);

    this.input = new Input(canvas, () => this.activeCamera());
    this.input.on("resize", (size) => this.resizeHandler(size));
    this.input.on("click", (cursorCoords) => this.clickHandler(cursorCoords));

    this.picker = new Picker(this.gl, this.scene, { debug: DEBUG_PICKING });

    this.selectionBackdrop = new ScreenOverlay();
    this.selectionBackdrop.visible = false;
    this.scene.add(this.selectionBackdrop);

    this.followFrameId = config.followTf;
    this.followMode = config.followMode;

    const samples = msaaSamples(this.gl.capabilities);
    const renderSize = this.gl.getDrawingBufferSize(tempVec2);
    this.aspect = renderSize.width / renderSize.height;
    log.debug(`Initialized ${renderSize.width}x${renderSize.height} renderer (${samples}x MSAA)`);

    this.measurementTool = new MeasurementTool(this);
    this.publishClickTool = new PublishClickTool(this);
    this.coreSettings = new CoreSettings(this);

    // Internal handlers for TF messages to update the transform tree
    this.addDatatypeSubscriptions(FRAME_TRANSFORM_DATATYPES, {
      handler: this.handleFrameTransform,
      forced: true,
      preload: config.scene.transforms?.enablePreloading ?? true,
    });
    this.addDatatypeSubscriptions(TF_DATATYPES, {
      handler: this.handleTFMessage,
      forced: true,
      preload: config.scene.transforms?.enablePreloading ?? true,
    });
    this.addDatatypeSubscriptions(TRANSFORM_STAMPED_DATATYPES, {
      handler: this.handleTransformStamped,
      forced: true,
      preload: config.scene.transforms?.enablePreloading ?? true,
    });

    this.addSceneExtension(this.coreSettings);
    this.addSceneExtension(new Cameras(this));
    this.addSceneExtension(new FrameAxes(this));
    this.addSceneExtension(new Grids(this));
    this.addSceneExtension(new Images(this));
    this.addSceneExtension(new Markers(this));
    this.addSceneExtension(new FoxgloveSceneEntities(this));
    this.addSceneExtension(new FoxgloveGrid(this));
    this.addSceneExtension(new OccupancyGrids(this));
    this.addSceneExtension(new PointCloudsAndLaserScans(this));
    this.addSceneExtension(new VelodyneScans(this));
    this.addSceneExtension(new Polygons(this));
    this.addSceneExtension(new Poses(this));
    this.addSceneExtension(new PoseArrays(this));
    this.addSceneExtension(new Urdfs(this));
    this.addSceneExtension(this.measurementTool);
    this.addSceneExtension(this.publishClickTool);

    this._watchDevicePixelRatio();

    this._updateCameras(config.cameraState);
    this.animationFrame();
  }

  private _watchDevicePixelRatio() {
    window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener(
      "change",
      () => {
        log.debug(`devicePixelRatio changed to ${window.devicePixelRatio}`);
        this.resizeHandler(this.input.canvasSize);
        this._watchDevicePixelRatio();
      },
      { once: true },
    );
  }

  public dispose(): void {
    log.warn(`Disposing renderer`);
    this.removeAllListeners();

    this.settings.off("update");
    this.input.off("resize", this.resizeHandler);
    this.input.off("click", this.clickHandler);
    this.controls.dispose();

    for (const extension of this.sceneExtensions.values()) {
      extension.dispose();
    }
    this.sceneExtensions.clear();

    this.labelPool.dispose();
    this.markerPool.dispose();
    this.picker.dispose();
    this.input.dispose();
    this.gl.dispose();
  }

  public getPixelRatio(): number {
    return this.gl.getPixelRatio();
  }

  /**
   * Clears internal state such as the TransformTree and removes Renderables from SceneExtensions.
   * This is useful when seeking to a new playback position or when a new data source is loaded.
   */
  public clear(): void {
    // This must be cleared before calling `SceneExtension#removeAllRenderables()` to allow
    // extensions to add errors back afterward
    this.settings.errors.clear();

    for (const extension of this.sceneExtensions.values()) {
      extension.removeAllRenderables();
    }
  }

  private addSceneExtension(extension: SceneExtension): void {
    if (this.sceneExtensions.has(extension.extensionId)) {
      throw new Error(`Attempted to add duplicate extensionId "${extension.extensionId}"`);
    }
    this.sceneExtensions.set(extension.extensionId, extension);
    this.scene.add(extension);
  }

  public updateConfig(updateHandler: (draft: RendererConfig) => void): void {
    this.config = produce(this.config, updateHandler);
    this.emit("configChange", this);
  }

  /** Updates the settings tree for core settings to account for any changes in the config. */
  public updateCoreSettings(): void {
    this.coreSettings.updateSettingsTree();
  }

  public addDatatypeSubscriptions<T>(
    datatypes: Iterable<string>,
    subscription: RendererSubscription<T> | MessageHandler<T>,
  ): void {
    const genericSubscription =
      subscription instanceof Function
        ? { handler: subscription as MessageHandler<unknown> }
        : (subscription as RendererSubscription);
    for (const datatype of datatypes) {
      let handlers = this.datatypeHandlers.get(datatype);
      if (!handlers) {
        handlers = [];
        this.datatypeHandlers.set(datatype, handlers);
      }
      if (!handlers.includes(genericSubscription)) {
        handlers.push(genericSubscription);
      }
    }
    this.emit("datatypeHandlersChanged", this);
  }

  public addTopicSubscription<T>(
    topic: string,
    subscription: RendererSubscription<T> | MessageHandler<T>,
  ): void {
    const genericSubscription =
      subscription instanceof Function
        ? { handler: subscription as MessageHandler<unknown> }
        : (subscription as RendererSubscription);
    let handlers = this.topicHandlers.get(topic);
    if (!handlers) {
      handlers = [];
      this.topicHandlers.set(topic, handlers);
    }
    if (!handlers.includes(genericSubscription)) {
      handlers.push(genericSubscription);
    }
    this.emit("topicHandlersChanged", this);
  }

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
    this.customLayerActions.set(options.layerId, { action, handler });

    // "Topics" settings tree node
    const topics: SettingsTreeEntry = {
      path: ["topics"],
      node: {
        enableVisibilityFilter: true,
        label: "Topics",
        defaultExpansionState: "expanded",
        actions: [
          { id: "show-all", type: "action", label: "Show All" },
          { id: "hide-all", type: "action", label: "Hide All" },
        ],
        children: this.settings.tree()["topics"]?.children,
        handler: this.handleTopicsAction,
      },
    };

    // "Custom Layers" settings tree node
    const layerCount = Object.keys(this.config.layers).length;
    const customLayers: SettingsTreeEntry = {
      path: ["layers"],
      node: {
        label: `Custom Layers${layerCount > 0 ? ` (${layerCount})` : ""}`,
        children: this.settings.tree()["layers"]?.children,
        actions: Array.from(this.customLayerActions.values()).map((entry) => entry.action),
        handler: this.handleCustomLayersAction,
      },
    };

    this.settings.setNodesForKey(RENDERER_ID, [topics, customLayers]);
  }

  private defaultFrameId(): string | undefined {
    const allFrames = this.transformTree.frames();
    if (allFrames.size === 0) {
      return undefined;
    }

    // Top priority is the followFrameId
    if (this.followFrameId != undefined) {
      return this.transformTree.hasFrame(this.followFrameId) ? this.followFrameId : undefined;
    }

    // Prefer frames from [REP-105](https://www.ros.org/reps/rep-0105.html)
    for (const frameId of DEFAULT_FRAME_IDS) {
      const frame = this.transformTree.frame(frameId);
      if (frame) {
        return frame.id;
      }
    }

    // Choose the root frame with the most children
    const rootsToCounts = new Map<string, number>();
    for (const frame of allFrames.values()) {
      const rootId = frame.root().id;
      rootsToCounts.set(rootId, (rootsToCounts.get(rootId) ?? 0) + 1);
    }
    const rootsArray = Array.from(rootsToCounts.entries());
    const rootId = rootsArray.sort((a, b) => b[1] - a[1])[0]?.[0];
    return rootId;
  }

  /** Enable or disable object selection mode */
  // eslint-disable-next-line @foxglove/no-boolean-parameters
  public setPickingEnabled(enabled: boolean): void {
    this._pickingEnabled = enabled;
    if (!enabled) {
      this.setSelectedRenderable(undefined);
    }
  }

  /** Update the color scheme and background color, rebuilding any materials as necessary */
  public setColorScheme(colorScheme: "dark" | "light", backgroundColor: string | undefined): void {
    this.colorScheme = colorScheme;

    const bgColor = backgroundColor ? stringToRgb(tempColor, backgroundColor) : undefined;

    for (const extension of this.sceneExtensions.values()) {
      extension.setColorScheme(colorScheme, bgColor);
    }

    if (colorScheme === "dark") {
      this.gl.setClearColor(bgColor ?? DARK_BACKDROP);
      this.outlineMaterial.color.set(DARK_OUTLINE);
      this.outlineMaterial.needsUpdate = true;
      this.instancedOutlineMaterial.color.set(DARK_OUTLINE);
      this.instancedOutlineMaterial.needsUpdate = true;
      this.selectionBackdrop.setColor(DARK_BACKDROP, 0.8);
    } else {
      this.gl.setClearColor(bgColor ?? LIGHT_BACKDROP);
      this.outlineMaterial.color.set(LIGHT_OUTLINE);
      this.outlineMaterial.needsUpdate = true;
      this.instancedOutlineMaterial.color.set(LIGHT_OUTLINE);
      this.instancedOutlineMaterial.needsUpdate = true;
      this.selectionBackdrop.setColor(LIGHT_BACKDROP, 0.8);
    }
  }

  /** Update the list of topics and rebuild all settings nodes when the identity
   * of the topics list changes */
  public setTopics(topics: ReadonlyArray<Topic> | undefined): void {
    const changed = this.topics !== topics;
    this.topics = topics;
    if (changed) {
      // Rebuild topicsByName
      this.topicsByName = topics ? new Map(topics.map((topic) => [topic.name, topic])) : undefined;

      // Rebuild the settings nodes for all scene extensions
      for (const extension of this.sceneExtensions.values()) {
        this.settings.setNodesForKey(extension.extensionId, extension.settingsNodes());
      }
    }
  }

  public setParameters(parameters: ReadonlyMap<string, ParameterValue> | undefined): void {
    const changed = this.parameters !== parameters;
    this.parameters = parameters;
    if (changed) {
      this.emit("parametersChange", parameters, this);
    }
  }

  public setVariables(variables: ReadonlyMap<string, VariableValue>): void {
    const changed = this.variables !== variables;
    this.variables = variables;
    if (changed) {
      this.emit("variablesChange", variables, this);
    }
  }

  public updateCustomLayersCount(): void {
    const layerCount = Object.keys(this.config.layers).length;
    const label = `Custom Layers${layerCount > 0 ? ` (${layerCount})` : ""}`;
    this.settings.setLabel(["layers"], label);
  }

  /** Translate a CameraState to the three.js coordinate system */
  private _updateCameras(cameraState: CameraState): void {
    const targetOffset = tempVec3;
    targetOffset.fromArray(cameraState.targetOffset);

    const phi = THREE.MathUtils.degToRad(cameraState.phi);
    const theta = -THREE.MathUtils.degToRad(cameraState.thetaOffset);

    // Always update the perspective camera even if the current mode is orthographic. This is needed
    // to make the OrbitControls work properly since they track the perspective camera.
    // https://github.com/foxglove/studio/issues/4138

    // Convert the camera spherical coordinates (radius, phi, theta) to Cartesian (X, Y, Z)
    tempSpherical.set(cameraState.distance, phi, theta);
    this.perspectiveCamera.position.setFromSpherical(tempSpherical).applyAxisAngle(UNIT_X, PI_2);
    this.perspectiveCamera.position.add(targetOffset);

    // Convert the camera spherical coordinates (phi, theta) to a quaternion rotation
    this.perspectiveCamera.quaternion.setFromEuler(tempEuler.set(phi, 0, theta, "ZYX"));
    this.perspectiveCamera.fov = cameraState.fovy;
    this.perspectiveCamera.near = cameraState.near;
    this.perspectiveCamera.far = cameraState.far;
    this.perspectiveCamera.aspect = this.aspect;
    this.perspectiveCamera.updateProjectionMatrix();

    this.controls.target.copy(targetOffset);

    if (cameraState.perspective) {
      // Unlock the polar angle (pitch axis)
      this.controls.minPolarAngle = 0;
      this.controls.maxPolarAngle = Math.PI;
    } else {
      // Lock the polar angle during 2D mode
      const curPolarAngle = THREE.MathUtils.degToRad(this.config.cameraState.phi);
      this.controls.minPolarAngle = this.controls.maxPolarAngle = curPolarAngle;

      this.orthographicCamera.position.set(targetOffset.x, targetOffset.y, cameraState.far / 2);
      this.orthographicCamera.quaternion.setFromAxisAngle(UNIT_Z, theta);
      this.orthographicCamera.left = (-cameraState.distance / 2) * this.aspect;
      this.orthographicCamera.right = (cameraState.distance / 2) * this.aspect;
      this.orthographicCamera.top = cameraState.distance / 2;
      this.orthographicCamera.bottom = -cameraState.distance / 2;
      this.orthographicCamera.near = cameraState.near;
      this.orthographicCamera.far = cameraState.far;
      this.orthographicCamera.updateProjectionMatrix();
    }
  }

  public setCameraState(cameraState: CameraState): void {
    this._isUpdatingCameraState = true;
    this._updateCameras(cameraState);
    // only active for follow pose mode because it introduces strange behavior into the other modes
    // due to the fact that they are manipulating the camera after update with the `cameraGroup`
    if (this.followMode === "follow-pose") {
      this.controls.update();
    }
    this._isUpdatingCameraState = false;
  }

  public getCameraState(): CameraState {
    return {
      perspective: this.config.cameraState.perspective,
      distance: this.controls.getDistance(),
      phi: THREE.MathUtils.radToDeg(this.controls.getPolarAngle()),
      thetaOffset: THREE.MathUtils.radToDeg(-this.controls.getAzimuthalAngle()),
      targetOffset: [this.controls.target.x, this.controls.target.y, this.controls.target.z],
      target: this.config.cameraState.target,
      targetOrientation: this.config.cameraState.targetOrientation,
      fovy: this.config.cameraState.fovy,
      near: this.config.cameraState.near,
      far: this.config.cameraState.far,
    };
  }

  public setSelectedRenderable(selection: PickedRenderable | undefined): void {
    if (this.selectedRenderable === selection) {
      return;
    }

    const prevSelected = this.selectedRenderable;
    if (prevSelected) {
      // Deselect the previously selected renderable
      deselectObject(prevSelected.renderable);
      log.debug(`Deselected ${prevSelected.renderable.id} (${prevSelected.renderable.name})`);
    }

    this.selectedRenderable = selection;

    if (selection) {
      // Select the newly selected renderable
      selectObject(selection.renderable);
      log.debug(
        `Selected ${selection.renderable.id} (${selection.renderable.name}) (instance=${selection.instanceIndex})`,
      );
    }

    this.emit("selectedRenderable", selection, this);

    if (!DEBUG_PICKING) {
      this.animationFrame();
    }
  }

  private activeCamera(): THREE.PerspectiveCamera | THREE.OrthographicCamera {
    return this.config.cameraState.perspective ? this.perspectiveCamera : this.orthographicCamera;
  }

  public addMessageEvent(messageEvent: Readonly<MessageEvent<unknown>>, datatype: string): void {
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
        const frameId = marker.header?.frame_id ?? "";
        this.addCoordinateFrame(frameId);
      }
    } else if (Array.isArray(maybeHasEntities.entities)) {
      // If this message has an array called entities, scrape frame_id from all entities
      for (const entity of maybeHasEntities.entities) {
        const frameId = entity.frame_id ?? "";
        this.addCoordinateFrame(frameId);
      }
    } else if (typeof maybeHasFrameId.frame_id === "string") {
      // If this message has a top-level frame_id, scrape it
      this.addCoordinateFrame(maybeHasFrameId.frame_id);
    }

    handleMessage(messageEvent, this.topicHandlers.get(messageEvent.topic));
    handleMessage(messageEvent, this.datatypeHandlers.get(datatype));
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

  private addFrameTransform(transform: FrameTransform): void {
    const parentId = transform.parent_frame_id;
    const childId = transform.child_frame_id;
    const stamp = toNanoSec(transform.timestamp);
    const t = transform.translation;
    const q = transform.rotation;

    this.addTransform(parentId, childId, stamp, t, q);
  }

  private addTransformMessage(tf: TransformStamped): void {
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
  ): void {
    const t = translation;
    const q = rotation;

    const transform = new Transform([t.x, t.y, t.z], [q.x, q.y, q.z, q.w]);
    const updated = this.transformTree.addTransform(childFrameId, parentFrameId, stamp, transform);

    if (updated) {
      this.coordinateFrameList = this.transformTree.frameList();
      this.emit("transformTreeUpdated", this);
    }

    // Check if the transform history for this frame is at capacity and show an error if so. This
    // error can't be cleared until the scene is reloaded
    const frame = this.transformTree.getOrCreateFrame(childFrameId);
    if (frame.transformsSize() === frame.maxCapacity) {
      this.settings.errors.add(
        ["transforms", `frame:${childFrameId}`],
        TF_OVERFLOW,
        `Transform history is at capacity (${frame.maxCapacity}), TFs will be dropped`,
      );
    }
  }

  // Callback handlers

  public animationFrame = (): void => {
    this._animationFrame = undefined;
    this.frameHandler(this.currentTime);
  };

  public queueAnimationFrame(): void {
    if (this._animationFrame == undefined) {
      this._animationFrame = requestAnimationFrame(this.animationFrame);
    }
  }

  private frameHandler = (currentTime: bigint): void => {
    this.currentTime = currentTime;
    this._updateFrames(currentTime);
    this._updateResolution();

    this.gl.clear();
    this.emit("startFrame", currentTime, this);

    const camera = this.activeCamera();
    camera.layers.set(LAYER_DEFAULT);
    this.selectionBackdrop.visible = this.selectedRenderable != undefined;

    const renderFrameId = this.renderFrameId;
    const fixedFrameId = this.fixedFrameId;
    if (renderFrameId == undefined || fixedFrameId == undefined) {
      return;
    }

    const renderFrame = this.transformTree.frame(renderFrameId);
    const fixedFrame = this.transformTree.frame(fixedFrameId);

    // If in stationary or follow-position modes
    if (
      this.followMode !== "follow-pose" &&
      this.unfollowPoseSnapshot &&
      renderFrame &&
      fixedFrame
    ) {
      renderFrame.applyLocal(
        snapshotInRenderFrame,
        this.unfollowPoseSnapshot,
        fixedFrame,
        currentTime,
      );
      /**
       * the application of the unfollowPoseSnapshot position and orientation
       * components makes the camera position and rotation static relative to the fixed frame.
       * So when the display frame changes the angle of the camera relative
       * to the scene will not change because only the snapshotPose orientation is applied
       */
      if (this.followMode === "follow-position") {
        // only make orientation static/stationary in this mode
        // the position still follows the frame
        this.cameraGroup.position.set(0, 0, 0);
      } else {
        this.cameraGroup.position.set(
          snapshotInRenderFrame.position.x,
          snapshotInRenderFrame.position.y,
          snapshotInRenderFrame.position.z,
        );
      }
      // this negates the rotation of the changes in renderFrame
      this.cameraGroup.quaternion.set(
        snapshotInRenderFrame.orientation.x,
        snapshotInRenderFrame.orientation.y,
        snapshotInRenderFrame.orientation.z,
        snapshotInRenderFrame.orientation.w,
      );
    }

    for (const sceneExtension of this.sceneExtensions.values()) {
      sceneExtension.startFrame(currentTime, renderFrameId, fixedFrameId);
    }

    this.gl.render(this.scene, camera);

    if (this.selectedRenderable) {
      this.gl.clearDepth();
      camera.layers.set(LAYER_SELECTED);
      this.selectionBackdrop.visible = false;
      this.gl.render(this.scene, camera);
    }

    this.emit("endFrame", currentTime, this);

    this.gl.info.reset();
  };

  private resizeHandler = (size: THREE.Vector2): void => {
    this.gl.setPixelRatio(window.devicePixelRatio);
    this.gl.setSize(size.width, size.height);

    const renderSize = this.gl.getDrawingBufferSize(tempVec2);
    this.aspect = renderSize.width / renderSize.height;
    this._updateCameras(this.config.cameraState);

    log.debug(`Resized renderer to ${renderSize.width}x${renderSize.height}`);
    this.animationFrame();
  };

  private clickHandler = (cursorCoords: THREE.Vector2): void => {
    if (!this._pickingEnabled) {
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
    const camera = this.activeCamera();
    const selections: PickedRenderable[] = [];
    let curSelection: PickedRenderable | undefined;
    while (
      (curSelection = this._pickSingleObject(cursorCoords)) &&
      selections.length < MAX_SELECTIONS
    ) {
      selections.push(curSelection);
      curSelection.renderable.visible = false;
      this.gl.render(this.scene, camera);
    }

    // Put everything back to normal and render one last frame
    for (const selection of selections) {
      selection.renderable.visible = true;
    }
    if (!DEBUG_PICKING) {
      this.animationFrame();
    }

    log.debug(`Clicked ${selections.length} renderable(s)`);
    this.emit("renderablesClicked", selections, cursorCoords, this);
  };

  private handleFrameTransform = ({ message }: MessageEvent<DeepPartial<FrameTransform>>): void => {
    // foxglove.FrameTransform - Ingest the list of transforms into our TF tree
    const transform = normalizeFrameTransform(message);
    this.addFrameTransform(transform);
  };

  private handleTFMessage = ({ message }: MessageEvent<DeepPartial<TFMessage>>): void => {
    // tf2_msgs/TFMessage - Ingest the list of transforms into our TF tree
    const tfMessage = normalizeTFMessage(message);
    for (const tf of tfMessage.transforms) {
      this.addTransformMessage(tf);
    }
  };

  private handleTransformStamped = ({
    message,
  }: MessageEvent<DeepPartial<TransformStamped>>): void => {
    // geometry_msgs/TransformStamped - Ingest this single transform into our TF tree
    const tf = normalizeTransformStamped(message);
    this.addTransformMessage(tf);
  };

  private handleTopicsAction = (action: SettingsTreeAction): void => {
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

  private handleCustomLayersAction = (action: SettingsTreeAction): void => {
    const path = action.payload.path;
    if (action.action !== "perform-node-action" || path.length !== 1 || path[0] !== "layers") {
      return;
    }
    log.debug(`handleCustomLayersAction(${action.payload.id})`);

    // Remove `-{uuid}` from the actionId to get the layerId
    const actionId = action.payload.id;
    const layerId = actionId.slice(0, -37);
    const instanceId = actionId.slice(-36);

    const entry = this.customLayerActions.get(layerId);
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

  private _pickSingleObject(cursorCoords: THREE.Vector2): PickedRenderable | undefined {
    // Render a single pixel using a fragment shader that writes object IDs as
    // colors, then read the value of that single pixel back
    const objectId = this.picker.pick(cursorCoords.x, cursorCoords.y, this.activeCamera());
    if (objectId === -1) {
      return undefined;
    }

    // Traverse the scene looking for this objectId
    const pickedObject = this.scene.getObjectById(objectId);

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

    let instanceIndex: number | undefined;
    if (renderable.pickableInstances) {
      instanceIndex = this.picker.pickInstance(
        cursorCoords.x,
        cursorCoords.y,
        this.activeCamera(),
        renderable,
      );
      instanceIndex = instanceIndex === -1 ? undefined : instanceIndex;
    }

    return { renderable, instanceIndex };
  }

  /** Tracks the number of frames so we can recompute the defaultFrameId when frames are added. */
  private _lastTransformFrameCount = 0;

  private _updateFrames(currentTime: bigint): void {
    if (
      this.followFrameId != undefined &&
      this.renderFrameId !== this.followFrameId &&
      this.transformTree.hasFrame(this.followFrameId)
    ) {
      // followFrameId is set and is a valid frame, use it
      this.renderFrameId = this.followFrameId;
    } else if (
      this.renderFrameId == undefined ||
      this.transformTree.frames().size !== this._lastTransformFrameCount ||
      !this.transformTree.hasFrame(this.renderFrameId)
    ) {
      // No valid renderFrameId set, or new frames have been added, fall back to selecting the
      // heuristically most valid frame (if any frames are present)
      this.renderFrameId = this.defaultFrameId();
      this._lastTransformFrameCount = this.transformTree.frames().size;

      if (this.renderFrameId == undefined) {
        if (this.followFrameId != undefined) {
          this.settings.errors.add(
            FOLLOW_TF_PATH,
            FRAME_NOT_FOUND,
            `Frame "${this.followFrameId}" not found`,
          );
        } else {
          this.settings.errors.add(FOLLOW_TF_PATH, NO_FRAME_SELECTED, `No coordinate frames found`);
        }
        this.fixedFrameId = undefined;
        return;
      } else {
        log.debug(`Setting render frame to ${this.renderFrameId}`);
        this.settings.errors.remove(FOLLOW_TF_PATH, NO_FRAME_SELECTED);
      }
    }

    const frame = this.transformTree.frame(this.renderFrameId);
    if (!frame) {
      this.renderFrameId = undefined;
      this.fixedFrameId = undefined;
      this.settings.errors.add(
        FOLLOW_TF_PATH,
        FRAME_NOT_FOUND,
        `Frame "${this.renderFrameId}" not found`,
      );
      return;
    } else {
      this.settings.errors.remove(FOLLOW_TF_PATH, FRAME_NOT_FOUND);
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

    // Should only occur on reload when the saved followMode is not follow
    if (this.followMode !== "follow-pose" && !this.unfollowPoseSnapshot) {
      // Snapshot the current pose of the render frame in the fixed frame
      this.unfollowPoseSnapshot = makePose();
      fixedFrame.applyLocal(
        this.unfollowPoseSnapshot,
        this.unfollowPoseSnapshot,
        frame,
        currentTime,
      );
    }
    this.settings.errors.clearPath(FOLLOW_TF_PATH);
  }

  // This should not be called on initialization only on settings changes
  public updateFollowMode(newFollowMode: FollowMode): void {
    if (this.followMode === newFollowMode) {
      return;
    }

    if (!this.renderFrameId || !this.fixedFrameId) {
      this.followMode = newFollowMode;
      return;
    }

    const renderFrame = this.transformTree.frame(this.renderFrameId);
    const fixedFrame = this.transformTree.frame(this.fixedFrameId);

    if (!renderFrame || !fixedFrame) {
      // if this happens it will be set on initialization in _updateFrames
      this.followMode = newFollowMode;
      return;
    }

    // always create a new snapshot when changing frames to minimize old snapshots causing camera jumps
    this.unfollowPoseSnapshot = makePose();
    fixedFrame.applyLocal(
      this.unfollowPoseSnapshot,
      this.unfollowPoseSnapshot,
      renderFrame,
      this.currentTime,
    );

    // reset any applied cameraGroup settings so that they aren't applied in follow mode
    this.cameraGroup.position.set(0, 0, 0);
    this.cameraGroup.quaternion.set(0, 0, 0, 1);
    this.followMode = newFollowMode;
  }

  private _updateResolution(): void {
    const resolution = this.input.canvasSize;
    if (this._prevResolution.equals(resolution)) {
      return;
    }
    this._prevResolution.copy(resolution);

    this.scene.traverse((object) => {
      if ((object as Partial<THREE.Mesh>).material) {
        const mesh = object as THREE.Mesh;
        const material = mesh.material as Partial<LineMaterial>;

        // Update render resolution uniforms
        if (material.resolution) {
          material.resolution.copy(resolution);
        }
        if (material.uniforms?.resolution) {
          material.uniforms.resolution.value = resolution;
        }
      }
    });
  }
}

function handleMessage(
  messageEvent: Readonly<MessageEvent<unknown>>,
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

// Creates a skeleton settings tree. The tree contents are filled in by scene extensions
function baseSettingsTree(): SettingsTreeNodes {
  return {
    general: {},
    scene: {},
    transforms: {},
    topics: {},
    layers: {},
    publish: {},
  };
}
